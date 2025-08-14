import os
import asyncio
import json
import hashlib
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass
from enum import Enum
import aiohttp
import random

from langchain_core.messages import HumanMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from dotenv import find_dotenv, load_dotenv
import getpass

# Performance monitoring import
try:
    from utils.performance_monitor import track_ai_generation
    from utils.redis_client import RedisClient
except ImportError:
    from contextlib import asynccontextmanager

    @asynccontextmanager
    async def track_ai_generation(metadata=None):
        yield

    class RedisClient:
        @classmethod
        async def get_instance(cls):
            return None


load_dotenv(find_dotenv())


class QuestionType(Enum):
    DEFINITION = "definition"
    APPLICATION = "application"
    COMPARISON = "comparison"
    ANALYSIS = "analysis"
    CURRENT_EVENTS = "current_events"
    PRACTICAL = "practical"
    CONCEPTUAL = "conceptual"
    FACTUAL = "factual"


@dataclass
class SearchResult:
    title: str
    snippet: str
    link: str
    date: Optional[str] = None


@dataclass
class QuizQuestion:
    question: str
    options: Dict[str, str]  # {'A': 'option1', 'B': 'option2', ...}
    correct_answer: str
    explanation: str
    difficulty: str
    question_type: QuestionType
    sources: List[str]


class SerperSearchTool:
    """Enhanced Google Search using Serper API for real-time information"""

    def __init__(self):
        self.api_key = os.getenv("SERPER_API_KEY")
        if not self.api_key:
            self.api_key = getpass.getpass("Enter your Serper API key: ")
        self.base_url = "https://google.serper.dev/search"

    async def search(self, query: str, num_results: int = 5) -> List[SearchResult]:
        """Perform search and return structured results"""
        headers = {"X-API-KEY": self.api_key, "Content-Type": "application/json"}

        payload = {
            "q": query,
            "num": num_results,
            "gl": "us",  # Geographic location
            "hl": "en",  # Language
        }

        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    self.base_url,
                    headers=headers,
                    json=payload,
                    timeout=aiohttp.ClientTimeout(total=10),
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        return self._parse_results(data)
                    else:
                        print(f"Search API error: {response.status}")
                        return []
        except Exception as e:
            print(f"Search failed: {e}")
            return []

    def _parse_results(self, data: dict) -> List[SearchResult]:
        """Parse Serper API response into SearchResult objects"""
        results = []

        # Parse organic results
        for item in data.get("organic", []):
            results.append(
                SearchResult(
                    title=item.get("title", ""),
                    snippet=item.get("snippet", ""),
                    link=item.get("link", ""),
                    date=item.get("date"),
                )
            )

        # Parse knowledge graph if available
        if "knowledgeGraph" in data:
            kg = data["knowledgeGraph"]
            if "description" in kg:
                results.insert(
                    0,
                    SearchResult(
                        title=kg.get("title", ""),
                        snippet=kg.get("description", ""),
                        link=kg.get("website", ""),
                        date=None,
                    ),
                )

        return results


class QuestionDiversityEngine:
    """Ensures question diversity and prevents repetition"""

    def __init__(self):
        self.used_patterns = set()
        self.question_types_used = []
        self.max_same_type = 2  # Max consecutive questions of same type

    def reset(self):
        """Reset the diversity engine for a new quiz session"""
        self.question_types_used = []
        self.used_patterns = {}  # Change from set to dict for counting
        print("🔄 Diversity engine reset for new session")

    def get_next_question_type(
        self, topic: str, search_results: List[SearchResult]
    ) -> QuestionType:
        """Intelligently select DIVERSE question types to ensure variety"""

        # Enforce strict diversity - never repeat the same type twice in a row
        last_type = self.question_types_used[-1] if self.question_types_used else None

        # Create comprehensive question type pool for maximum variety
        all_types = [
            QuestionType.DEFINITION,  # "What is X?"
            QuestionType.FACTUAL,  # "Which of these is true about X?"
            QuestionType.CONCEPTUAL,  # "How does X work?"
            QuestionType.COMPARISON,  # "How does X differ from Y?"
            QuestionType.ANALYSIS,  # "Why is X important?"
            QuestionType.APPLICATION,  # "When would you use X?"
            QuestionType.PRACTICAL,  # "How do you implement X?"
            QuestionType.CURRENT_EVENTS,  # "What's the latest with X?"
        ]

        # Remove the last used type to prevent immediate repetition
        available_types = [t for t in all_types if t != last_type]

        # Prioritize types we haven't used yet in this session
        unused_types = [t for t in available_types if t not in self.question_types_used]

        # Select from unused types first, then from available types
        if unused_types:
            selected_type = random.choice(unused_types)
        else:
            selected_type = random.choice(available_types)

        self.question_types_used.append(selected_type)
        print(f"🎲 Selected question type: {selected_type.value}")

        return selected_type

    def _is_recent_date(self, date_str: str) -> bool:
        """Check if date is within last 6 months"""
        try:
            # Simple heuristic - you might want to improve date parsing
            return "2024" in date_str or "2025" in date_str
        except:
            return False

    def generate_pattern_key(self, question: str) -> str:
        """Generate a less aggressive pattern key to avoid over-filtering"""
        # Only check for very specific patterns to avoid blocking good questions
        words = question.lower().split()

        # Look for exact question start patterns only
        if len(words) >= 3:
            first_three = " ".join(words[:3])
            return first_three

        return " ".join(words[:2])  # Very loose pattern matching

    def is_pattern_used(self, question: str) -> bool:
        """Check if identical question pattern was already used (very lenient)"""
        pattern = self.generate_pattern_key(question)

        # Only block if we've seen this EXACT pattern 2+ times
        pattern_count = self.used_patterns.get(pattern, 0)
        if pattern_count >= 2:
            return True

        # Track the pattern
        self.used_patterns[pattern] = pattern_count + 1
        return False


class AdvancedQuizGenerator:
    """Enhanced quiz generator with real-time search and diversity"""

    def __init__(self):
        self.search_tool = SerperSearchTool()
        self.diversity_engine = QuestionDiversityEngine()

        # LLM configuration optimized for speed and quality
        self.llm = ChatGoogleGenerativeAI(
            model="gemini-2.0-flash",
            api_key=os.getenv("GOOGLE_GEMINI_API_KEY")
            or getpass.getpass("Enter your Google API key: "),
            temperature=0.3,  # Lower for faster, more consistent responses
            max_tokens=800,  # Reduced tokens for faster generation
            top_p=0.8,  # Focus on most likely tokens
        )

    async def generate_quiz(
        self,
        topic: str,
        num_questions: int = 1,
        difficulty: str = "medium",
        force_refresh: bool = False,
        context_text: str = None,
    ) -> List[QuizQuestion]:
        """Generate diverse, up-to-date quiz questions with search results + optional context"""

        async with track_ai_generation(
            {
                "topic": topic,
                "num_questions": num_questions,
                "difficulty": difficulty,
                "force_refresh": force_refresh,
                "has_context": bool(context_text),
                "context_length": len(context_text) if context_text else 0,
            }
        ):
            print(
                f"🎯 Generating {num_questions} questions about '{topic}' ({difficulty})"
            )
            if context_text:
                print(f"📄 Using additional context ({len(context_text)} chars)")

            # 🚀 SPEED OPTIMIZATION: Parallel search + generation pipeline
            start_time = asyncio.get_event_loop().time()

            # Start search immediately (always get fresh search results)
            search_task = asyncio.create_task(self._get_enhanced_search_results(topic))

            # Generate questions as soon as search completes
            search_results = await search_task
            questions = await self._generate_diverse_questions(
                topic, num_questions, difficulty, search_results, context_text
            )

            end_time = asyncio.get_event_loop().time()
            total_time = end_time - start_time

            print(f"🏁 Generated {len(questions)} questions in {total_time:.2f}s")
            print(f"⚡ Speed: {len(questions)/total_time:.1f} questions/second")

            return questions

    def _validate_and_trim_options(self, options: dict) -> dict:
        """Ensure all options are within 90 characters"""
        return {
            key: value[:87] + "..." if len(value) > 90 else value
            for key, value in options.items()
        }

    async def _rephrase_options(
        self, question: str, options: Dict[str, str]
    ) -> Dict[str, str]:
        """Rephrase options to be under 90 characters using an LLM call."""
        options_list = list(options.values())
        options_text = "\n".join([f"- {v}" for v in options_list])

        rephrase_prompt = f"""The following quiz options are too long. Rephrase them to be a maximum of 90 characters each, while keeping the original meaning and the order of the options.

Original Question: {question}

Original Options to Rephrase:
{options_text}

Return ONLY a JSON object with a single key "rephrased_options" which is an array of 4 strings, each under 90 characters. The order must be preserved.

Example format:
{{
    "rephrased_options": [
        "Rephrased option 1 (max 90 chars)",
        "Rephrased option 2 (max 90 chars)",
        "Rephrased option 3 (max 90 chars)",
        "Rephrased option 4 (max 90 chars)"
    ]
}}
"""
        response = await self.llm.ainvoke([HumanMessage(content=rephrase_prompt)])
        content = response.content.strip()

        if "```json" in content:
            start = content.find("```json") + 7
            end = content.find("```", start)
            content = content[start:end] if end > start else content[start:]
        content = content.strip()

        rephrased_data = json.loads(content)
        rephrased_list = rephrased_data.get("rephrased_options", [])

        if len(rephrased_list) == 4:
            # Final check, if still too long, trim as a last resort.
            if any(len(opt) > 90 for opt in rephrased_list):
                print(
                    "⚠️ Rephrasing failed to meet length constraint, trimming as fallback."
                )
                return self._validate_and_trim_options(
                    {
                        "A": rephrased_list[0],
                        "B": rephrased_list[1],
                        "C": rephrased_list[2],
                        "D": rephrased_list[3],
                    }
                )

            return {
                "A": rephrased_list[0],
                "B": rephrased_list[1],
                "C": rephrased_list[2],
                "D": rephrased_list[3],
            }
        else:
            print("Rephrasing returned incorrect number of options. Trimming.")
            return self._validate_and_trim_options(options)

    async def _get_enhanced_search_results(self, topic: str) -> List[SearchResult]:
        """Get comprehensive search results with parallel processing for speed"""
        search_queries = [
            f"{topic} definition explanation",
            f"{topic} latest news 2025",
            f"{topic} how it works",
        ]

        print(f"🔍 Running {len(search_queries)} parallel searches...")

        # Execute all searches in parallel for maximum speed
        start_time = asyncio.get_event_loop().time()
        search_tasks = [
            self.search_tool.search(query, num_results=3) for query in search_queries
        ]

        search_results_lists = await asyncio.gather(
            *search_tasks, return_exceptions=True
        )
        end_time = asyncio.get_event_loop().time()

        print(f"⚡ Search completed in {(end_time - start_time):.2f}s")

        # Combine and deduplicate results
        all_results = []
        seen_urls = set()
        for results in search_results_lists:
            if isinstance(results, list):
                for result in results:
                    if result.link not in seen_urls:
                        seen_urls.add(result.link)
                        all_results.append(result)

        unique_results = all_results[:8]  # Limit to 8 best results
        print(f"📄 Found {len(unique_results)} unique sources")

        return unique_results

    async def _generate_diverse_questions(
        self,
        topic: str,
        num_questions: int,
        difficulty: str,
        search_results: List[SearchResult],
        context_text: str = None,
    ) -> List[QuizQuestion]:
        """Generate questions with parallel processing, using search results + optional context"""

        # Reset diversity engine for this session
        self.diversity_engine.reset()

        # Create tasks for parallel generation
        tasks = []
        question_types = []

        print(f"🚀 Preparing {num_questions} questions for parallel generation...")

        for i in range(num_questions):
            question_type = self.diversity_engine.get_next_question_type(
                topic, search_results
            )
            question_types.append(question_type)

            # Select relevant search results for this question
            relevant_results = self._select_relevant_results(
                question_type, search_results
            )

            task = self._generate_single_question(
                topic, question_type, difficulty, relevant_results, i + 1, context_text
            )
            tasks.append(task)

        # Execute all questions in parallel for maximum speed
        start_time = asyncio.get_event_loop().time()
        results = await asyncio.gather(*tasks, return_exceptions=True)
        end_time = asyncio.get_event_loop().time()

        print(f"⚡ Parallel generation completed in {(end_time - start_time):.2f}s")

        # Filter successful results and avoid only exact duplicates
        questions = []
        failed_indices = []

        for i, result in enumerate(results):
            if isinstance(result, QuizQuestion):
                # More lenient duplicate checking
                if not self.diversity_engine.is_pattern_used(result.question):
                    questions.append(result)
                    print(f"✅ Question {len(questions)}: {question_types[i].value}")
                else:
                    print(
                        f"⚠️ Similar pattern detected for question {i + 1}, but continuing..."
                    )
                    # Still accept the question if we have room for duplicates
                    if len(questions) < num_questions:
                        questions.append(result)
                        print(
                            f"✅ Accepted question {len(questions)} despite similarity"
                        )
            elif isinstance(result, Exception):
                print(f"❌ Question {i + 1} failed: {str(result)[:50]}...")
                failed_indices.append(i)

        # If we don't have enough questions, retry failed ones
        if len(questions) < num_questions and failed_indices:
            print(f"🔄 Retrying {len(failed_indices)} failed questions...")
            retry_tasks = []
            for i in failed_indices[: num_questions - len(questions)]:
                task = self._generate_single_question(
                    topic, question_types[i], difficulty, search_results, i + 1
                )
                retry_tasks.append(task)

            if retry_tasks:
                retry_results = await asyncio.gather(
                    *retry_tasks, return_exceptions=True
                )
                for result in retry_results:
                    if (
                        isinstance(result, QuizQuestion)
                        and len(questions) < num_questions
                    ):
                        questions.append(result)
                        print(f"✅ Retry success! Question {len(questions)}")

        return questions

    def _select_relevant_results(
        self, question_type: QuestionType, search_results: List[SearchResult]
    ) -> List[SearchResult]:
        """Select most relevant search results for question type - ensure at least 3 sources"""
        if question_type == QuestionType.CURRENT_EVENTS:
            # Prioritise recent results but ensure minimum 3 sources
            recent_results = [
                r
                for r in search_results
                if r.date and self.diversity_engine._is_recent_date(r.date)
            ]
            if len(recent_results) >= 3:
                return recent_results[:5]
            else:
                # Supplement with general results to reach 3 minimum
                return search_results[: max(5, 3)]
        elif question_type == QuestionType.DEFINITION:
            # Prioritise knowledge graph and definition results, but ensure 3+ sources
            return search_results[: max(5, 3)]
        else:
            # Always use at least 3 sources for comprehensive coverage
            return search_results[: max(5, 3)]

    async def _generate_single_question(
        self,
        topic: str,
        question_type: QuestionType,
        difficulty: str,
        search_results: List[SearchResult],
        question_number: int,
        context_text: str = None,
    ) -> Optional[QuizQuestion]:
        """Generate a single question using search results + optional context"""

        # Build comprehensive context from search results + additional context
        search_context = self._build_search_context(search_results)

        # Combine search results with additional context if provided
        if context_text:
            # Preprocess context text (limit size for speed)
            processed_context = self._preprocess_context_text(context_text)
            combined_context = f"SEARCH RESULTS:\n{search_context}\n\nADDITIONAL CONTEXT:\n{processed_context}"
        else:
            combined_context = search_context

        # Create prompt with combined context
        prompt = self._create_type_specific_prompt(
            topic, question_type, difficulty, combined_context, question_number
        )

        try:
            # 🚀 SPEED: Increased timeout to 15s for better success rate
            response = await asyncio.wait_for(self.llm.ainvoke(prompt), timeout=15.0)

            # 🚀 SPEED: Minimal processing
            content = response.content.strip()

            # Quick JSON extraction
            if "```json" in content:
                start = content.find("```json") + 7
                end = content.find("```", start)
                content = content[start:end] if end > start else content[start:]

            content = content.strip()

            # 🚀 SPEED: Fast JSON parsing with fallback
            try:
                question_data = json.loads(content)
            except json.JSONDecodeError:
                print(
                    f"🔄 Question {question_number}: JSON failed, trying text extraction..."
                )
                # Quick text extraction fallback
                question_data = self._fast_extract_question(content)
                if not question_data:
                    print(f"❌ Question {question_number}: Text extraction also failed")
                    return None

            # Validate we have the required fields
            if not all(
                key in question_data
                for key in ["question", "options", "correct_answer"]
            ):
                print(f"❌ Question {question_number}: Missing required fields")
                return None

            if len(question_data["options"]) < 4:
                print(
                    f"❌ Question {question_number}: Not enough options ({len(question_data['options'])})"
                )
                return None

            # 🚀 SPEED: Direct construction with Telegram option length validation
            options = {
                "A": question_data["options"][0],
                "B": question_data["options"][1],
                "C": question_data["options"][2],
                "D": question_data["options"][3],
            }

            # Check if any option exceeds the character limit
            if any(len(opt) > 90 for opt in options.values()):
                print(
                    f"⚠️ Question {question_number}: Options exceed 90 chars, rephrasing..."
                )
                try:
                    options = await self._rephrase_options(
                        question_data["question"], options
                    )
                except Exception as e:
                    print(f"Rephrasing failed: {e}. Trimming as fallback.")
                    options = self._validate_and_trim_options(options)

            return QuizQuestion(
                question=question_data["question"],
                options=options,
                correct_answer=question_data["correct_answer"],
                explanation=question_data.get("explanation", ""),
                difficulty=difficulty,
                question_type=question_type,
                sources=[
                    r.link for r in search_results[:3]
                ],  # Reference first 3 sources used
            )

        except asyncio.TimeoutError:
            print(
                f"⏰ Question {question_number} timed out (15s) - trying simple fallback"
            )
            # Create a simple fallback question
            return self._create_fallback_question(
                topic, question_type, difficulty, question_number
            )
        except Exception as e:
            print(f"❌ Question {question_number} failed: {str(e)[:50]}...")
            return self._create_fallback_question(
                topic, question_type, difficulty, question_number
            )

    def _create_fallback_question(
        self,
        topic: str,
        question_type: QuestionType,
        difficulty: str,
        question_number: int,
    ) -> QuizQuestion:
        """Create a simple fallback question when AI generation fails"""

        # Simple question templates for different types
        if question_type == QuestionType.DEFINITION:
            question = f"What is {topic}?"
            options = [
                f"A technical concept related to {topic}",
                f"A completely unrelated concept",
                f"An outdated technology",
                f"A marketing term only",
            ]
            correct_answer = "A"
        elif question_type == QuestionType.APPLICATION:
            question = f"What is a common use case for {topic}?"
            options = [
                f"Practical applications in the field",
                f"Only theoretical research",
                f"Completely unrelated uses",
                f"Historical purposes only",
            ]
            correct_answer = "A"
        else:
            question = f"Which statement about {topic} is most accurate?"
            options = [
                f"It is an important concept in its field",
                f"It has no practical applications",
                f"It is completely obsolete",
                f"It only exists in theory",
            ]
            correct_answer = "A"

        options = self._validate_and_trim_options(
            {
                "A": options[0],
                "B": options[1],
                "C": options[2],
                "D": options[3],
            }
        )

        return QuizQuestion(
            question=question,
            options=options,
            correct_answer=correct_answer,
            explanation=f"This is a fallback answer about {topic}.",
            difficulty=difficulty,
            question_type=question_type,
            sources=[],
        )

    def _build_search_context(self, search_results: List[SearchResult]) -> str:
        """Build comprehensive context from at least 3 search results"""
        if not search_results:
            return "No additional context available."

        # 🌐 USE AT LEAST 3 SOURCES: Use top 3-5 results for comprehensive coverage
        min_sources = min(len(search_results), 5)  # Use up to 5 sources
        context_parts = []

        for i, result in enumerate(search_results[:min_sources], 1):
            # Keep reasonable snippet length for comprehensive info
            snippet = (
                result.snippet[:200] + "..."
                if len(result.snippet) > 200
                else result.snippet
            )
            # Include source information for reference
            context_parts.append(f"Source {i} ({result.title}): {snippet}")

        context = "\n\n".join(context_parts)
        print(f"📚 Using {min_sources} sources for context generation")

        return context

    def _fast_extract_question(self, text: str) -> Optional[Dict]:
        """Ultra-fast question extraction for speed optimization"""
        try:
            # Quick regex patterns for common formats
            import re

            # Pattern 1: JSON-like structure
            question_match = re.search(r'"question":\s*"([^"]+)"', text)
            options_match = re.search(r'"options":\s*\[(.*?)\]', text, re.DOTALL)
            answer_match = re.search(r'"correct_answer":\s*"([^"]+)"', text)

            if question_match and options_match and answer_match:
                # Extract options quickly
                options_text = options_match.group(1)
                options = [opt.strip().strip('"') for opt in options_text.split(",")]
                options = [opt for opt in options if opt]  # Remove empty

                if len(options) >= 4:
                    return {
                        "question": question_match.group(1),
                        "options": options[:4],
                        "correct_answer": answer_match.group(1),
                        "explanation": "Generated answer",
                    }

            # Pattern 2: Simple text format (last resort)
            lines = text.split("\n")
            question_line = next((line for line in lines if "?" in line), None)

            if question_line:
                return {
                    "question": question_line.strip(),
                    "options": ["Option A", "Option B", "Option C", "Option D"],
                    "correct_answer": "A",
                    "explanation": "Fallback answer",
                }

        except Exception:
            pass

        return None

    def _create_type_specific_prompt(
        self,
        topic: str,
        question_type: QuestionType,
        difficulty: str,
        context: str,
        question_number: int,
    ) -> List:
        """Create highly diverse, type-specific prompts to ensure variety"""

        # Extract different facts from context for each question type
        context_sentences = context.split(". ")
        context_slice = (
            context_sentences[question_number % len(context_sentences)]
            if context_sentences
            else context
        )

        # Highly specific prompt templates for maximum diversity
        type_prompts = {
            QuestionType.DEFINITION: {
                "focus": "fundamental meaning and core concept",
                "question_starter": f"What is {topic}",
                "context_use": "definition and basic explanation",
            },
            QuestionType.FACTUAL: {
                "focus": "specific facts, numbers, dates, or technical details",
                "question_starter": f"Which fact about {topic} is correct",
                "context_use": "specific data points and statistics",
            },
            QuestionType.CONCEPTUAL: {
                "focus": "how it works, underlying mechanisms",
                "question_starter": f"How does {topic} function",
                "context_use": "process and methodology information",
            },
            QuestionType.COMPARISON: {
                "focus": "differences from alternatives or competitors",
                "question_starter": f"What distinguishes {topic} from",
                "context_use": "comparative advantages and differences",
            },
            QuestionType.ANALYSIS: {
                "focus": "significance, impact, or importance",
                "question_starter": f"Why is {topic} significant",
                "context_use": "benefits, implications, and importance",
            },
            QuestionType.APPLICATION: {
                "focus": "real-world uses and practical applications",
                "question_starter": f"When is {topic} most commonly used",
                "context_use": "use cases and practical examples",
            },
            QuestionType.PRACTICAL: {
                "focus": "implementation steps and requirements",
                "question_starter": f"What is required to implement {topic}",
                "context_use": "practical requirements and setup",
            },
            QuestionType.CURRENT_EVENTS: {
                "focus": "recent developments and latest trends",
                "question_starter": f"What recent advancement involves {topic}",
                "context_use": "current news and recent developments",
            },
        }

        prompt_info = type_prompts[question_type]

        # Create unique question for this specific type and context
        question_templates = {
            QuestionType.DEFINITION: f"What is {topic}?",
            QuestionType.FACTUAL: f"Which statement about {topic} is accurate?",
            QuestionType.CONCEPTUAL: f"How does {topic} work?",
            QuestionType.COMPARISON: f"What distinguishes {topic} from alternatives?",
            QuestionType.ANALYSIS: f"Why is {topic} significant?",
            QuestionType.APPLICATION: f"Where is {topic} commonly used?",
            QuestionType.PRACTICAL: f"What is needed to implement {topic}?",
            QuestionType.CURRENT_EVENTS: f"What is a recent development in {topic}?",
        }

        # Use minimal context for speed but ensure we have good coverage
        short_context = context[:500] + "..." if len(context) > 500 else context

        # Ultra-simple prompt for maximum speed and success
        system_prompt = f"""Create a {difficulty} quiz question about {topic}.

Question style: {question_templates[question_type]}

SOURCES TO USE:
{short_context}

INSTRUCTIONS:
- Combine information from the provided sources above
- Also use your built-in knowledge about {topic}
- Create a comprehensive question that tests understanding
- Ensure the question is accurate and well-informed
- Make distractors plausible but clearly wrong
- Each option must be phrased in such a way that it is succinct and has a character limit of 90
- IMPORTANT: Each option has a limit of 90 characters. Create options that fit into that.
- CRITICAL: Each option must be exactly 90 characters or less (no trimming or ellipses)

IMPORTANT: Return ONLY valid JSON:
{{
    "question": "Direct, comprehensive question about {topic}?",
    "options": ["Correct answer (max 90 chars)", "Wrong option 1 (max 90 chars)", "Wrong option 2 (max 90 chars)", "Wrong option 3 (max 90 chars)"],
    "correct_answer": "A",
    "explanation": "Why this is correct, referencing sources and general knowledge"
}}"""

        return [HumanMessage(content=system_prompt)]

    def _validate_and_trim_options(self, options: dict) -> dict:
        """Ensure all options are within 90 characters"""
        return {
            key: value[:87] + "..." if len(value) > 90 else value
            for key, value in options.items()
        }


# Convenience function for backward compatibility
async def generate_quiz(
    topic: str,
    num_questions: int = 1,
    difficulty: str = "medium",
    context_text: str = None,
) -> str:
    """Generate quiz and return formatted string (backward compatibility)"""
    generator = AdvancedQuizGenerator()
    questions = await generator.generate_quiz(
        topic, num_questions, difficulty, context_text=context_text
    )

    # Format as string
    formatted_questions = []
    for i, q in enumerate(questions, 1):
        options_text = "\n".join(
            [f"{key}) {value}" for key, value in q.options.items()]
        )
        formatted_questions.append(
            f"Question {i}: {q.question}\n{options_text}\nCorrect Answer: {q.correct_answer}"
        )

    return "\n\n".join(formatted_questions)
