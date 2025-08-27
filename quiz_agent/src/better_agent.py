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
    SCENARIO = "scenario"  # New: Real-world scenarios
    CALCULATION = "calculation"  # New: Numerical problems
    SEQUENCE = "sequence"  # New: Order/timeline questions
    EXCEPTION = "exception"  # New: "Which does NOT..." questions


class QuestionComplexity(Enum):
    """Enhanced complexity levels beyond basic difficulty"""

    RECALL = "recall"  # Simple facts
    COMPREHENSION = "comprehension"  # Understanding concepts
    APPLICATION = "application"  # Using knowledge
    ANALYSIS = "analysis"  # Breaking down information
    SYNTHESIS = "synthesis"  # Combining concepts
    EVALUATION = "evaluation"  # Making judgments


class DistractorStrategy(Enum):
    """Different strategies for creating plausible wrong answers"""

    RELATED_CONCEPTS = "related_concepts"  # Similar but different concepts
    PARTIAL_TRUTH = "partial_truth"  # Partially correct but incomplete
    COMMON_MISCONCEPTION = "common_misconception"  # Popular wrong beliefs
    TEMPORAL_CONFUSION = "temporal_confusion"  # Wrong time period
    MAGNITUDE_ERROR = "magnitude_error"  # Wrong numbers/scale
    DOMAIN_CONFUSION = "domain_confusion"  # From related field


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
    complexity: QuestionComplexity
    distractor_strategy: DistractorStrategy
    sources: List[str]
    confidence_score: float = 0.8  # How confident we are in the question quality


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
            "gl": "us",
            "hl": "en",
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

        for item in data.get("organic", []):
            results.append(
                SearchResult(
                    title=item.get("title", ""),
                    snippet=item.get("snippet", ""),
                    link=item.get("link", ""),
                    date=item.get("date"),
                )
            )

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


class AdvancedQuestionDiversityEngine:
    """Enhanced diversity engine with sophisticated pattern detection"""

    def __init__(self):
        self.used_patterns = {}
        self.question_structures = []
        self.concept_usage = {}  # Track which concepts we've tested
        self.complexity_distribution = []
        self.distractor_strategies_used = []
        self.semantic_fingerprints = set()  # Track semantic similarity

    def reset(self):
        """Reset for new quiz session"""
        self.question_structures = []
        self.complexity_distribution = []
        self.distractor_strategies_used = []
        self.concept_usage = {}
        self.semantic_fingerprints = set()
        print("🔄 Advanced diversity engine reset")

    def get_next_question_profile(self, topic: str, context_analysis: dict) -> tuple:
        """Get diverse question type, complexity, and distractor strategy"""

        # Ensure variety in question types
        question_type = self._select_diverse_question_type()

        # Select complexity based on distribution and difficulty
        complexity = self._select_balanced_complexity()

        # Choose distractor strategy based on question type and previous usage
        distractor_strategy = self._select_distractor_strategy(question_type)

        # Track usage
        self.complexity_distribution.append(complexity)
        self.distractor_strategies_used.append(distractor_strategy)

        return question_type, complexity, distractor_strategy

    def _select_diverse_question_type(self) -> QuestionType:
        """Select question type ensuring maximum variety"""
        all_types = list(QuestionType)

        # Get types not used in last 3 questions
        recent_types = [q.split("_")[0] for q in self.question_structures[-3:]]
        available_types = [t for t in all_types if t.value not in recent_types]

        if not available_types:
            available_types = all_types

        # Weight towards less used types
        type_counts = {}
        for structure in self.question_structures:
            qtype = structure.split("_")[0]
            type_counts[qtype] = type_counts.get(qtype, 0) + 1

        # Select least used type
        min_count = min([type_counts.get(t.value, 0) for t in available_types])
        least_used_types = [
            t for t in available_types if type_counts.get(t.value, 0) == min_count
        ]

        selected = random.choice(least_used_types)
        self.question_structures.append(
            f"{selected.value}_{len(self.question_structures)}"
        )

        return selected

    def _select_balanced_complexity(self) -> QuestionComplexity:
        """Ensure balanced complexity distribution"""
        complexities = list(QuestionComplexity)

        if len(self.complexity_distribution) < 3:
            # Early questions can be any complexity
            return random.choice(complexities)

        # Check distribution balance
        complexity_counts = {}
        for comp in self.complexity_distribution:
            complexity_counts[comp] = complexity_counts.get(comp, 0) + 1

        # Prefer least used complexity levels
        min_count = min([complexity_counts.get(c, 0) for c in complexities])
        balanced_choices = [
            c for c in complexities if complexity_counts.get(c, 0) == min_count
        ]

        return random.choice(balanced_choices)

    def _select_distractor_strategy(
        self, question_type: QuestionType
    ) -> DistractorStrategy:
        """Select distractor strategy based on question type and variety"""

        # Map question types to suitable distractor strategies
        type_to_strategies = {
            QuestionType.DEFINITION: [
                DistractorStrategy.RELATED_CONCEPTS,
                DistractorStrategy.PARTIAL_TRUTH,
            ],
            QuestionType.FACTUAL: [
                DistractorStrategy.MAGNITUDE_ERROR,
                DistractorStrategy.TEMPORAL_CONFUSION,
            ],
            QuestionType.CONCEPTUAL: [
                DistractorStrategy.COMMON_MISCONCEPTION,
                DistractorStrategy.PARTIAL_TRUTH,
            ],
            QuestionType.APPLICATION: [
                DistractorStrategy.DOMAIN_CONFUSION,
                DistractorStrategy.RELATED_CONCEPTS,
            ],
            QuestionType.CURRENT_EVENTS: [
                DistractorStrategy.TEMPORAL_CONFUSION,
                DistractorStrategy.MAGNITUDE_ERROR,
            ],
            QuestionType.SCENARIO: [
                DistractorStrategy.PARTIAL_TRUTH,
                DistractorStrategy.COMMON_MISCONCEPTION,
            ],
            QuestionType.CALCULATION: [
                DistractorStrategy.MAGNITUDE_ERROR,
                DistractorStrategy.RELATED_CONCEPTS,
            ],
        }

        suitable_strategies = type_to_strategies.get(
            question_type, list(DistractorStrategy)
        )

        # Avoid recently used strategies
        recent_strategies = self.distractor_strategies_used[-2:]
        available_strategies = [
            s for s in suitable_strategies if s not in recent_strategies
        ]

        if not available_strategies:
            available_strategies = suitable_strategies

        return random.choice(available_strategies)

    def generate_semantic_fingerprint(self, question: str) -> str:
        """Generate semantic fingerprint to detect similar questions"""
        # Extract key words and create semantic signature
        import re

        words = re.findall(r"\b[a-zA-Z]{4,}\b", question.lower())
        key_words = [
            w
            for w in words
            if w
            not in [
                "what",
                "which",
                "when",
                "where",
                "how",
                "does",
                "will",
                "would",
                "could",
                "should",
            ]
        ]
        return "_".join(sorted(set(key_words[:5])))

    def is_semantically_similar(self, question: str) -> bool:
        """Check if question is semantically similar to previous ones"""
        fingerprint = self.generate_semantic_fingerprint(question)

        if fingerprint in self.semantic_fingerprints:
            return True

        self.semantic_fingerprints.add(fingerprint)
        return False


class AdvancedQuizGenerator:
    """Enhanced quiz generator with sophisticated question variety"""

    def __init__(self):
        self.search_tool = SerperSearchTool()
        self.diversity_engine = AdvancedQuestionDiversityEngine()

        self.llm = ChatGoogleGenerativeAI(
            model="gemini-2.0-flash",
            api_key=os.getenv("GOOGLE_GEMINI_API_KEY")
            or getpass.getpass("Enter your Google API key: "),
            temperature=0.4,  # Slightly higher for more creativity
            max_tokens=1000,
            top_p=0.9,
        )

    async def generate_quiz(
        self,
        topic: str,
        num_questions: int = 1,
        difficulty: str = "medium",
        force_refresh: bool = False,
        context_text: str = None,
    ) -> List[QuizQuestion]:
        """Generate sophisticated, non-repetitive quiz questions"""

        async with track_ai_generation(
            {
                "topic": topic,
                "num_questions": num_questions,
                "difficulty": difficulty,
                "has_context": bool(context_text),
            }
        ):
            print(
                f"🎯 Generating {num_questions} sophisticated questions about '{topic}'"
            )

            # Reset diversity engine
            self.diversity_engine.reset()

            # Analyze context for better question generation
            context_analysis = self._analyze_context(context_text, topic)

            # Get search results
            search_results = await self._get_comprehensive_search_results(
                topic, context_analysis
            )

            # Generate questions with advanced diversity
            questions = await self._generate_sophisticated_questions(
                topic,
                num_questions,
                difficulty,
                search_results,
                context_text,
                context_analysis,
            )

            # Quality filter - remove low confidence questions
            high_quality_questions = [q for q in questions if q.confidence_score >= 0.7]

            print(f"✅ Generated {len(high_quality_questions)} high-quality questions")
            return high_quality_questions

    def _analyze_context(self, context_text: str, topic: str) -> dict:
        """Analyze context to identify key concepts and themes"""
        analysis = {
            "key_concepts": [],
            "technical_terms": [],
            "dates_mentioned": [],
            "numbers_mentioned": [],
            "complexity_indicators": [],
            "domain": "general",
        }

        if not context_text:
            return analysis

        # Simple analysis (could be enhanced with NLP)
        import re

        # Extract technical terms (capitalized words, acronyms)
        technical_terms = re.findall(r"\b[A-Z][A-Z0-9]{2,}\b", context_text)
        analysis["technical_terms"] = list(set(technical_terms))

        # Extract dates
        dates = re.findall(r"\b\d{4}\b|\b\d{1,2}/\d{1,2}/\d{2,4}\b", context_text)
        analysis["dates_mentioned"] = dates

        # Extract numbers
        numbers = re.findall(
            r"\b\d+(?:\.\d+)?(?:%|\s*percent|\s*million|\s*billion)?\b", context_text
        )
        analysis["numbers_mentioned"] = numbers[:10]  # Limit to first 10

        # Identify complexity indicators
        complexity_words = [
            "algorithm",
            "methodology",
            "framework",
            "implementation",
            "architecture",
        ]
        analysis["complexity_indicators"] = [
            w for w in complexity_words if w.lower() in context_text.lower()
        ]

        return analysis

    async def _get_comprehensive_search_results(
        self, topic: str, context_analysis: dict
    ) -> List[SearchResult]:
        """Get diverse, up-to-date search results with real-time information focus"""

        from datetime import datetime

        current_year = datetime.now().year
        current_month = datetime.now().strftime("%B %Y")

        # Enhanced search queries prioritizing recent information
        base_queries = [
            f"{topic} latest news {current_year}",
            f"{topic} recent developments {current_month}",
            f"{topic} breaking news today",
            f"{topic} current trends {current_year}",
            f"{topic} updates this year",
            f"{topic} new research {current_year}",
            f"{topic} recent breakthroughs",
            f'"{topic}" site:news.google.com',
            f'"{topic}" site:techcrunch.com OR site:wired.com',
            f"{topic} definition explanation 2024 2025",
        ]

        # Add context-specific real-time queries
        if context_analysis["technical_terms"]:
            tech_terms = " ".join(context_analysis["technical_terms"][:2])
            base_queries.extend(
                [
                    f"{topic} {tech_terms} latest {current_year}",
                    f"{tech_terms} news {current_year}",
                    f"{topic} {tech_terms} recent developments",
                ]
            )

        if context_analysis["dates_mentioned"]:
            # Look for updates since the most recent date mentioned
            recent_date = max(context_analysis["dates_mentioned"])
            base_queries.extend(
                [
                    f"{topic} updates since {recent_date}",
                    f"{topic} news after {recent_date}",
                    f"{topic} developments {recent_date} to {current_year}",
                ]
            )

        # Add domain-specific real-time searches
        if any(
            term in topic.lower()
            for term in ["ai", "artificial intelligence", "machine learning"]
        ):
            base_queries.extend(
                [
                    f"{topic} latest models {current_year}",
                    f"{topic} recent papers {current_year}",
                    f'"{topic}" site:arxiv.org',
                ]
            )
        elif any(term in topic.lower() for term in ["crypto", "blockchain", "bitcoin"]):
            base_queries.extend(
                [
                    f"{topic} price news today",
                    f"{topic} regulatory news {current_year}",
                    f'"{topic}" site:coindesk.com OR site:cointelegraph.com',
                ]
            )
        elif any(term in topic.lower() for term in ["stock", "finance", "market"]):
            base_queries.extend(
                [
                    f"{topic} market news today",
                    f"{topic} earnings {current_year}",
                    f'"{topic}" site:bloomberg.com OR site:reuters.com',
                ]
            )

        print(f"🔍 Executing {len(base_queries)} real-time searches for '{topic}'...")

        # Execute searches in parallel with timeout for speed
        search_tasks = [
            asyncio.wait_for(self.search_tool.search(query, num_results=4), timeout=8.0)
            for query in base_queries
        ]

        search_results_lists = await asyncio.gather(
            *search_tasks, return_exceptions=True
        )

        # Process and prioritize recent results
        all_results = []
        seen_urls = set()
        recent_results = []
        older_results = []

        for results in search_results_lists:
            if isinstance(results, list):
                for result in results:
                    if result.link not in seen_urls and len(result.snippet) > 30:
                        seen_urls.add(result.link)
                        # Prioritize recent content
                        if self._is_recent_content(result):
                            recent_results.append(result)
                        else:
                            older_results.append(result)

        # Combine with recent results first
        all_results = recent_results + older_results

        print(
            f"📊 Found {len(recent_results)} recent sources, {len(older_results)} older sources"
        )
        return all_results[:15]  # More sources for comprehensive coverage

    def _is_recent_content(self, result: SearchResult) -> bool:
        """Enhanced detection of recent content"""
        if not result.date:
            # Check for recent indicators in title/snippet
            recent_indicators = [
                "2025",
                "2024",
                "today",
                "yesterday",
                "this week",
                "this month",
                "recently",
                "latest",
                "breaking",
                "just",
                "new",
                "current",
                "updated",
                "fresh",
                "recent",
                "now",
            ]
            text_to_check = (result.title + " " + result.snippet).lower()
            return any(indicator in text_to_check for indicator in recent_indicators)

        try:
            # Parse various date formats
            date_str = result.date.lower()
            current_year = datetime.now().year
            current_month = datetime.now().month

            # Check for current year
            if str(current_year) in date_str or str(current_year - 1) in date_str:
                return True

            # Check for recent time indicators
            recent_terms = ["hour", "day", "week", "month", "ago"]
            if any(term in date_str for term in recent_terms):
                return True

        except:
            pass

        return False

    async def _generate_sophisticated_questions(
        self,
        topic: str,
        num_questions: int,
        difficulty: str,
        search_results: List[SearchResult],
        context_text: str,
        context_analysis: dict,
    ) -> List[QuizQuestion]:
        """Generate questions with advanced variety and sophistication"""

        tasks = []
        question_profiles = []

        for i in range(num_questions):
            # Get diverse question profile
            question_type, complexity, distractor_strategy = (
                self.diversity_engine.get_next_question_profile(topic, context_analysis)
            )

            question_profiles.append((question_type, complexity, distractor_strategy))

            # Create generation task
            task = self._generate_sophisticated_single_question(
                topic,
                question_type,
                complexity,
                distractor_strategy,
                difficulty,
                search_results,
                context_text,
                context_analysis,
                i + 1,
            )
            tasks.append(task)

        # Execute in parallel
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Filter and validate results
        questions = []
        for i, result in enumerate(results):
            if isinstance(result, QuizQuestion):
                # Check semantic similarity
                if not self.diversity_engine.is_semantically_similar(result.question):
                    questions.append(result)
                    print(
                        f"✅ Question {len(questions)}: {question_profiles[i][0].value} ({question_profiles[i][1].value})"
                    )
                else:
                    print(f"⚠️ Question {i+1} too similar to previous questions")
            else:
                print(f"❌ Question {i+1} generation failed")

        return questions

    async def _generate_sophisticated_single_question(
        self,
        topic: str,
        question_type: QuestionType,
        complexity: QuestionComplexity,
        distractor_strategy: DistractorStrategy,
        difficulty: str,
        search_results: List[SearchResult],
        context_text: str,
        context_analysis: dict,
        question_number: int,
    ) -> Optional[QuizQuestion]:
        """Generate a single sophisticated question with advanced prompting"""

        # Build comprehensive context
        search_context = self._build_advanced_search_context(
            search_results, question_type
        )

        if context_text:
            processed_context = self._extract_relevant_context(
                context_text, question_type, context_analysis
            )
            combined_context = f"SEARCH RESULTS:\n{search_context}\n\nADDITIONAL CONTEXT:\n{processed_context}"
        else:
            combined_context = search_context

        # Create sophisticated prompt
        prompt = self._create_sophisticated_prompt(
            topic,
            question_type,
            complexity,
            distractor_strategy,
            difficulty,
            combined_context,
            context_analysis,
            question_number,
        )

        try:
            response = await asyncio.wait_for(self.llm.ainvoke(prompt), timeout=20.0)
            content = response.content.strip()

            # Extract JSON
            if "```json" in content:
                start = content.find("```json") + 7
                end = content.find("```", start)
                content = content[start:end] if end > start else content[start:]

            question_data = json.loads(content.strip())

            # Validate required fields
            required_fields = [
                "question",
                "options",
                "correct_answer",
                "explanation",
                "confidence_score",
            ]
            if not all(field in question_data for field in required_fields):
                return None

            # Validate options
            options = question_data["options"]
            if len(options) != 4:
                return None

            # Check option length and rephrase if needed
            options_dict = {
                "A": options[0],
                "B": options[1],
                "C": options[2],
                "D": options[3],
            }

            if any(len(opt) > 90 for opt in options_dict.values()):
                options_dict = await self._rephrase_options(
                    question_data["question"], options_dict
                )

            return QuizQuestion(
                question=question_data["question"],
                options=options_dict,
                correct_answer=question_data["correct_answer"],
                explanation=question_data["explanation"],
                difficulty=difficulty,
                question_type=question_type,
                complexity=complexity,
                distractor_strategy=distractor_strategy,
                sources=[r.link for r in search_results[:3]],
                confidence_score=question_data.get("confidence_score", 0.8),
            )

        except Exception as e:
            print(f"❌ Question {question_number} failed: {str(e)[:50]}...")
            return None

    def _create_sophisticated_prompt(
        self,
        topic: str,
        question_type: QuestionType,
        complexity: QuestionComplexity,
        distractor_strategy: DistractorStrategy,
        difficulty: str,
        context: str,
        context_analysis: dict,
        question_number: int,
    ) -> List:
        """Create sophisticated prompts with emphasis on current, up-to-date information"""

        from datetime import datetime

        current_date = datetime.now().strftime("%B %d, %Y")
        current_year = datetime.now().year

        # Advanced question templates based on type and complexity
        question_templates = {
            QuestionType.DEFINITION: {
                QuestionComplexity.RECALL: f"What is the current understanding of {topic}?",
                QuestionComplexity.COMPREHENSION: f"Based on recent developments, which statement best captures {topic}?",
                QuestionComplexity.ANALYSIS: f"How has the definition of {topic} evolved in {current_year}?",
            },
            QuestionType.CURRENT_EVENTS: {
                QuestionComplexity.COMPREHENSION: f"What recent development in {topic} has been most significant?",
                QuestionComplexity.ANALYSIS: f"Which trend in {topic} is currently shaping the field in {current_year}?",
                QuestionComplexity.EVALUATION: f"What is the most likely impact of recent {topic} developments?",
            },
            QuestionType.SCENARIO: {
                QuestionComplexity.APPLICATION: f"Given current trends, when would {topic} be most effectively applied?",
                QuestionComplexity.ANALYSIS: f"What current factor would be most critical when implementing {topic}?",
                QuestionComplexity.EVALUATION: f"How should {topic} be evaluated in today's context?",
            },
            QuestionType.EXCEPTION: {
                QuestionComplexity.COMPREHENSION: f"Which of the following is NOT true about {topic} as of {current_year}?",
                QuestionComplexity.ANALYSIS: f"Which scenario would NOT benefit from current {topic} approaches?",
            },
        }

        # Distractor strategy instructions
        distractor_instructions = {
            DistractorStrategy.RELATED_CONCEPTS: "Create distractors using recent concepts from the same domain but clearly different from the correct answer",
            DistractorStrategy.PARTIAL_TRUTH: "Make distractors partially correct but missing crucial recent developments or containing outdated information",
            DistractorStrategy.COMMON_MISCONCEPTION: "Use current misconceptions or popular but incorrect beliefs about recent developments",
            DistractorStrategy.MAGNITUDE_ERROR: "Create distractors with incorrect recent numbers, scales, or quantities from current data",
            DistractorStrategy.TEMPORAL_CONFUSION: "Use distractors with wrong recent time periods, dates, or current sequential information",
            DistractorStrategy.DOMAIN_CONFUSION: "Include recent concepts from related but different fields as distractors",
        }

        # Build sophisticated system prompt with emphasis on current information
        system_prompt = f"""You are an expert quiz creator specializing in challenging, up-to-date questions that test current knowledge and understanding.

CURRENT DATE: {current_date}
TOPIC: {topic}
QUESTION TYPE: {question_type.value}
COMPLEXITY LEVEL: {complexity.value}
DIFFICULTY: {difficulty}
DISTRACTOR STRATEGY: {distractor_strategy.value}

REAL-TIME CONTEXT INFORMATION:
{context[:1000]}

CRITICAL REAL-TIME REQUIREMENTS:
1. PRIORITIZE RECENT INFORMATION: Use the most current data, developments, and trends from the context
2. CREATE {complexity.value}-level questions that test current understanding of {topic}
3. INCORPORATE LATEST DEVELOPMENTS: Reference specific recent events, numbers, dates, or breakthroughs mentioned in the context
4. {distractor_instructions[distractor_strategy]}
5. ENSURE CURRENCY: Make sure the question reflects the current state of {topic}, not outdated information
6. USE SPECIFIC RECENT DETAILS: Include concrete recent examples, statistics, or developments
7. Each option must be exactly 90 characters or less

ADVANCED CURRENT-AWARENESS INSTRUCTIONS:
- Question should test knowledge of recent developments, not just historical facts
- Incorporate specific recent data points, dates, or statistics from the context
- Reference current trends, latest research, or breaking developments
- Ensure distractors reflect recent but incorrect information, not obviously outdated concepts
- Make the question relevant to someone following {topic} in {current_year}

QUALITY REQUIREMENTS FOR UP-TO-DATE QUESTIONS:
- Question cannot be answered correctly without recent knowledge
- Distractors should include recent but incorrect information
- Test understanding of current implications, not just basic definitions
- Reference specific recent developments from the provided context
- Avoid questions that could be answered with old information

TEMPORAL FOCUS:
- If asking about developments: focus on {current_year} and late 2024
- If asking about trends: emphasize current and emerging patterns
- If asking about data: use the most recent figures available
- If asking about predictions: base on current information and trajectories

OUTPUT FORMAT (JSON only):
{{
    "question": "Current, specific, challenging question about recent {topic} developments",
    "options": [
        "Correct recent answer (max 90 chars)",
        "Recent but wrong distractor 1 (max 90 chars)",
        "Recent but wrong distractor 2 (max 90 chars)",
        "Recent but wrong distractor 3 (max 90 chars)"
    ],
    "correct_answer": "A",
    "explanation": "Detailed explanation referencing recent sources and current developments, explaining why other recent options are wrong",
    "confidence_score": 0.9
}}"""

        return [HumanMessage(content=system_prompt)]

    def _build_advanced_search_context(
        self, search_results: List[SearchResult], question_type: QuestionType
    ) -> str:
        """Build context optimized for specific question types"""
        if not search_results:
            return "No additional context available."

        # Select most relevant results based on question type
        if question_type == QuestionType.CURRENT_EVENTS:
            # Prioritize recent results
            sorted_results = sorted(
                search_results, key=lambda x: x.date or "0000", reverse=True
            )
        elif question_type in [QuestionType.FACTUAL, QuestionType.CALCULATION]:
            # Prioritize results with numbers/data
            sorted_results = [
                r for r in search_results if any(char.isdigit() for char in r.snippet)
            ] + [
                r
                for r in search_results
                if not any(char.isdigit() for char in r.snippet)
            ]
        else:
            sorted_results = search_results

        context_parts = []
        for i, result in enumerate(sorted_results[:6], 1):
            snippet = (
                result.snippet[:250] + "..."
                if len(result.snippet) > 250
                else result.snippet
            )
            context_parts.append(f"Source {i}: {snippet}")

        return "\n\n".join(context_parts)

    def _extract_relevant_context(
        self, context_text: str, question_type: QuestionType, context_analysis: dict
    ) -> str:
        """Extract most relevant parts of context for the question type"""
        if not context_text:
            return ""

        # Simple extraction based on question type
        sentences = context_text.split(". ")

        if (
            question_type == QuestionType.FACTUAL
            and context_analysis["numbers_mentioned"]
        ):
            # Focus on sentences with numbers
            relevant_sentences = [
                s
                for s in sentences
                if any(num in s for num in context_analysis["numbers_mentioned"])
            ]
        elif (
            question_type == QuestionType.CURRENT_EVENTS
            and context_analysis["dates_mentioned"]
        ):
            # Focus on sentences with dates
            relevant_sentences = [
                s
                for s in sentences
                if any(date in s for date in context_analysis["dates_mentioned"])
            ]
        elif context_analysis["technical_terms"]:
            # Focus on sentences with technical terms
            relevant_sentences = [
                s
                for s in sentences
                if any(
                    term.lower() in s.lower()
                    for term in context_analysis["technical_terms"]
                )
            ]
        else:
            # Use first few sentences
            relevant_sentences = sentences[:5]

        relevant_context = ". ".join(relevant_sentences[:5])
        return (
            relevant_context[:600] + "..."
            if len(relevant_context) > 600
            else relevant_context
        )

    async def _rephrase_options(
        self, question: str, options: Dict[str, str]
    ) -> Dict[str, str]:
        """Rephrase options to fit character limit while maintaining sophistication"""
        options_list = list(options.values())
        options_text = "\n".join([f"- {v}" for v in options_list])

        rephrase_prompt = f"""Rephrase these quiz options to be maximum 90 characters each while maintaining their meaning and sophistication level:

Question: {question}

Options to rephrase:
{options_text}

Requirements:
- Maximum 90 characters per option
- Maintain technical accuracy
- Keep the relative difficulty level
- Preserve the distinctiveness of each option

Return ONLY JSON:
{{
    "rephrased_options": [
        "Option 1 (max 90 chars)",
        "Option 2 (max 90 chars)",
        "Option 3 (max 90 chars)",
        "Option 4 (max 90 chars)"
    ]
}}"""

        try:
            response = await self.llm.ainvoke([HumanMessage(content=rephrase_prompt)])
            content = response.content.strip()

            if "```json" in content:
                start = content.find("```json") + 7
                end = content.find("```", start)
                content = content[start:end] if end > start else content[start:]

            rephrased_data = json.loads(content.strip())
            rephrased_list = rephrased_data.get("rephrased_options", [])

            if len(rephrased_list) == 4:
                return {
                    "A": rephrased_list[0][:90],
                    "B": rephrased_list[1][:90],
                    "C": rephrased_list[2][:90],
                    "D": rephrased_list[3][:90],
                }
        except:
            pass

        # Fallback: simple truncation
        return {
            key: value[:87] + "..." if len(value) > 90 else value
            for key, value in options.items()
        }

    def _preprocess_context_text(self, context_text: str) -> str:
        """Preprocess context text for optimal use"""
        if not context_text:
            return ""

        # Remove excessive whitespace and normalize
        import re

        cleaned = re.sub(r"\s+", " ", context_text.strip())

        # Limit size for performance while keeping key information
        if len(cleaned) > 2000:
            # Try to find natural break points
            sentences = cleaned.split(". ")
            truncated = ""
            for sentence in sentences:
                if len(truncated + sentence) > 2000:
                    break
                truncated += sentence + ". "
            return truncated

        return cleaned


# Convenience function for backward compatibility
async def generate_quiz(
    topic: str,
    num_questions: int = 1,
    difficulty: str = "medium",
    context_text: str = None,
) -> str:
    """Generate quiz and return formatted string"""
    generator = AdvancedQuizGenerator()
    questions = await generator.generate_quiz(
        topic, num_questions, difficulty, context_text=context_text
    )

    formatted_questions = []
    for i, q in enumerate(questions, 1):
        options_text = "\n".join(
            [f"{key}) {value}" for key, value in q.options.items()]
        )
        complexity_info = f" [{q.complexity.value}]" if hasattr(q, "complexity") else ""
        formatted_questions.append(
            f"Question {i}{complexity_info}: {q.question}\n{options_text}\n"
            f"Correct Answer: {q.correct_answer}\n"
            f"Explanation: {q.explanation}\n"
            f"Confidence: {q.confidence_score:.1f}"
        )

    return "\n\n".join(formatted_questions)


if __name__ == "__main__":
    import asyncio

    async def main():
        print("🎯 Advanced Quiz Generator - Interactive Mode")
        print("=" * 50)

        # Get user input
        topic = input("Enter topic for quiz questions: ").strip()
        if not topic:
            print("❌ Topic cannot be empty. Exiting.")
            return

        try:
            num_questions = int(input("Enter number of questions (1-10): ").strip())
            if num_questions < 1 or num_questions > 10:
                print("❌ Number of questions must be between 1 and 10. Using default of 3.")
                num_questions = 3
        except ValueError:
            print("❌ Invalid number. Using default of 3 questions.")
            num_questions = 3

        difficulty = input("Enter difficulty (easy/medium/hard) [default: medium]: ").strip().lower()
        if difficulty not in ['easy', 'medium', 'hard']:
            print("Using default difficulty: medium")
            difficulty = "medium"

        context_text = input("Enter additional context (optional, press Enter to skip): ").strip()
        if not context_text:
            context_text = None

        print(f"\n🚀 Generating {num_questions} {difficulty} questions about '{topic}'...")
        print("This may take a moment...\n")

        # Initialize generator
        generator = AdvancedQuizGenerator()

        try:
            # Generate questions
            questions = await generator.generate_quiz(
                topic=topic,
                num_questions=num_questions,
                difficulty=difficulty,
                context_text=context_text,
            )

            # Display results
            print("\n" + "=" * 50)
            print("📝 GENERATED QUIZ QUESTIONS")
            print("=" * 50)

            for i, q in enumerate(questions, 1):
                print(f"\nQuestion {i}:")
                print(f"Type: {q.question_type.value} | Complexity: {q.complexity.value}")
                print(f"Difficulty: {q.difficulty} | Confidence: {q.confidence_score:.1f}")
                print(f"\n{q.question}")

                for key, value in q.options.items():
                    print(f"{key}) {value}")

                print(f"\n✅ Correct Answer: {q.correct_answer}")
                print(f"💡 Explanation: {q.explanation}")

                if q.sources:
                    print(f"📚 Sources: {', '.join(q.sources[:2])}")

                print("-" * 40)

            print(f"\n✅ Successfully generated {len(questions)} questions!")

        except Exception as e:
            print(f"❌ Error generating questions: {str(e)}")
            print("Please check your API keys and internet connection.")

    # Run the async main function
    asyncio.run(main())
