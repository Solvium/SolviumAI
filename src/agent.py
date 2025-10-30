import os
import asyncio
from langchain_core.messages import HumanMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from dotenv import find_dotenv, load_dotenv
import getpass
import time
import re

# Performance monitoring import
try:
    from utils.performance_monitor import track_ai_generation
except ImportError:
    # Fallback for when performance monitor is not available
    from contextlib import asynccontextmanager

    @asynccontextmanager
    async def track_ai_generation(metadata=None):
        yield


# Load environment variables from .env file
load_dotenv(find_dotenv())

# Get API key from environment variable or prompt user
GOOGLE_API_KEY = os.getenv("GOOGLE_GEMINI_API_KEY")
if not GOOGLE_API_KEY:
    GOOGLE_API_KEY = getpass.getpass("Enter your Google API key: ")


async def generate_quiz(
    topic: str, num_questions: int = 1, context_text: str = None
) -> str:
    """
    Generate a multiple-choice quiz about a topic.
    """
    async with track_ai_generation(
        {
            "topic": topic,
            "num_questions": num_questions,
            "has_context": bool(context_text),
        }
    ):
        llm = ChatGoogleGenerativeAI(
            model="gemini-2.0-flash", api_key=GOOGLE_API_KEY, temperature=0.75
        )  # Added temperature

        # Preprocess context
        if context_text:
            context_text = preprocess_text(context_text)

        # Unified, meta-prompt with few-shot and robust instructions
        BASIC_SYSTEM = """
You are QuizMasterGPT, an expert educator and fact-checker.
Your primary goal is to produce unique, non-repetitive, evidence-based multiple-choice questions.
Each question should explore a different facet or sub-topic of the main theme.
"""

        FEW_SHOT = """
Example 1 (Definition):
Question: What is the primary consensus mechanism used by the Bitcoin network?
A) Proof of Stake
B) Proof of Work
C) Delegated Proof of Stake
D) Proof of Authority
Correct Answer: B

Example 2 (Application/Concept):
Question: In object-oriented programming, which keyword in JavaScript is fundamental for creating an instance of a class?
A) new
B) constructor
C) this
D) class
Correct Answer: A

Example 3 (Specific Detail):
Question: What is the native token of the Solana blockchain, used for transaction fees and staking?
A) SOL
B) SLP
C) SOLA
D) SNL
Correct Answer: A
"""

        TEMPLATE = """
{few_shot}

Now, generate {num_questions} distinct multiple-choice question(s) exclusively about **{topic}**.

Context (use if relevant, otherwise rely on general knowledge about the topic):
{context}

Strict requirements:
 1. Focus solely on the user-provided topic: **{topic}**. Do NOT include content outside this scope.
 2. Each question MUST cover a different sub-topic or explore a unique angle of **{topic}**. Avoid asking multiple questions about the exact same detail or concept.
 3. Generate EXACTLY four options per question, labeled A) to D).
 4. Ensure only ONE option is correct. State the correct answer clearly as "Correct Answer: [letter]" on a new line immediately after the options for each question.
 5. No repetition of questions or options. All generated content must be original for this request.
 6. Avoid hallucinations: only use verifiable facts. If uncertain about a specific detail, ask a more general question about the topic.
 7. Vary question types. Aim for a mix of:
    - Definitions (e.g., "What is X?")
    - Purpose/Use (e.g., "What is X used for?")
    - Comparisons (e.g., "How does X differ from Y?")
    - Components (e.g., "Which of these is a key part of X?")
    - Characteristics (e.g., "What is a primary characteristic of X?")
 8. Use concise, precise language suitable for advanced learners.
 9. If the topic is blockchain-related, ensure all blockchain-specific facts are accurate and up-to-date.
10. Do NOT include any additional commentary, preamble, or instructions in your output. Output only the formatted questions.
11. Number each question sequentially (e.g., 1., 2., ...).

Format each question exactly like the examples provided (Question, Options A-D, Correct Answer).
"""

        prompt = ChatPromptTemplate.from_template(
            BASIC_SYSTEM + "\n" + TEMPLATE  # FEW_SHOT is now part of the main TEMPLATE
        )

        messages = prompt.format_messages(
            few_shot=FEW_SHOT,  # Pass it here so it's correctly inserted into the TEMPLATE
            topic=topic,
            num_questions=num_questions,
            context=context_text
            or "No additional context provided. Rely on general knowledge for the topic.",
        )

        # Enhanced generation & retry logic with better error handling
        max_attempts = 3
        attempt = 0
        last_exception = None

        while attempt < max_attempts:
            try:
                # Dynamic timeout based on complexity
                base_timeout = 15.0
                question_factor = 0.5 * min(num_questions, 10)
                context_factor = 0.01 * min(len(context_text or ""), 1000)
                timeout = base_timeout * (1 + question_factor + context_factor)

                # Cap maximum timeout at 60 seconds
                timeout = min(timeout, 60.0)

                print(
                    f"[AI] Generating quiz (attempt {attempt + 1}/{max_attempts}, timeout: {timeout:.1f}s)"
                )

                response = await asyncio.wait_for(
                    llm.ainvoke(messages), timeout=timeout
                )

                # Validate response content
                if not response.content or len(response.content.strip()) < 50:
                    raise ValueError("Generated content too short or empty")

                return response.content

            except asyncio.TimeoutError as e:
                last_exception = e
                print(f"[AI] Attempt {attempt + 1} timed out after {timeout:.1f}s")
                attempt += 1
                if attempt < max_attempts:
                    wait_time = 2**attempt  # Exponential backoff
                    print(f"[AI] Waiting {wait_time}s before retry...")
                    await asyncio.sleep(wait_time)

            except Exception as e:
                last_exception = e
                print(f"[AI] Attempt {attempt + 1} failed: {str(e)[:100]}...")
                attempt += 1
                if attempt < max_attempts:
                    await asyncio.sleep(1)

        print(
            f"[AI] All attempts failed, using fallback quiz. Last error: {last_exception}"
        )
        return generate_fallback_quiz(topic, num_questions)


def generate_fallback_quiz(topic, num_questions=1):
    """Generate a simple fallback quiz when the API fails"""
    questions = []
    for i in range(1, int(num_questions) + 1):
        questions.append(
            f"""Question {i}: Which of the following is most associated with {topic}?
A) First option
B) Second option
C) Third option
D) Fourth option
Correct Answer: A"""
        )

    return "\n\n".join(questions)


# async def generate_tweet(topic):
#     """
#     Generate a concise, engaging tweet about the given topic (max 280 characters).
#     """
#     async with track_ai_generation({"topic": topic, "type": "tweet"}):
#         # Initialize the chat model
#         llm = ChatGoogleGenerativeAI(model="gemini-2.0-flash", api_key=GOOGLE_API_KEY)

#         # Prompt template for a tweet
#         tweet_template = (
#             "Write a concise, engaging tweet about {topic}. "
#             "Keep it under 280 characters and include a friendly tone."
#         )
#         prompt = ChatPromptTemplate.from_template(tweet_template)

#         # Generate the tweet with enhanced timeout and retry logic
#         messages = prompt.format_messages(topic=topic)

#         max_attempts = 2
#         for attempt in range(max_attempts):
#             try:
#                 timeout = 8.0 if attempt == 0 else 12.0  # Longer timeout on retry
#                 print(f"[AI] Generating tweet (attempt {attempt + 1}/{max_attempts})")

#                 response = await asyncio.wait_for(
#                     llm.ainvoke(messages), timeout=timeout
#                 )

#                 # Validate tweet length
#                 if len(response.content) > 280:
#                     print(
#                         f"[AI] Tweet too long ({len(response.content)} chars), retrying..."
#                     )
#                     if attempt < max_attempts - 1:
#                         continue
#                     # Truncate if last attempt
#                     return response.content[:277] + "..."

#                 return response.content

#             except asyncio.TimeoutError:
#                 print(f"[AI] Tweet generation timed out (attempt {attempt + 1})")
#                 if attempt == max_attempts - 1:
#                     return (
#                         f"Check out this interesting topic: {topic} #blockchain #quiz"
#                     )
#                 await asyncio.sleep(1)

#             except Exception as e:
#                 print(f"[AI] Tweet generation error: {str(e)[:50]}...")
#                 if attempt == max_attempts - 1:
#                     return f"Exploring {topic} today! #learning #quiz"
#                 await asyncio.sleep(1)

#         return f"Discover more about {topic}! 🧠 #mentalmazequiz"


def preprocess_text(text):
    """Clean and prepare text for quiz generation by removing links, markdown, and other noise."""
    # Remove links in markdown format [text](url)
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)

    # Remove standalone URLs
    text = re.sub(r"https?://\S+", "", text)

    # Remove multiple newlines
    text = re.sub(r"\n{3,}", "\n\n", text)

    # Remove markdown headers
    text = re.sub(r"#{1,6}\s+", "", text)

    # Replace bullet points with clean format
    text = re.sub(r"^\s*[\*\-•]\s*", "- ", text, flags=re.MULTILINE)

    # Clean up any trailing/leading whitespace
    text = text.strip()

    return text


# Example usage
if __name__ == "__main__":
    topic = input("Enter a topic for the quiz: ")
    quiz = asyncio.run(generate_quiz(topic))
    print("\nGenerated Quiz:")
    result = quiz
    print(result)
import os
import asyncio
import json
import random
import logging
import sys
from datetime import datetime
from typing import Dict, List, Optional, Union
from dataclasses import dataclass
from enum import Enum
import aiohttp
import re
from pathlib import Path

# Try to import langchain components with fallbacks
try:
    from langchain_core.messages import HumanMessage
    from langchain_google_genai import ChatGoogleGenerativeAI
    from langchain_core.prompts import ChatPromptTemplate

    LANGCHAIN_AVAILABLE = True
except ImportError as e:
    print(f"Warning: LangChain not available: {e}")
    print("Install with: pip install langchain-core langchain-google-genai")
    LANGCHAIN_AVAILABLE = False

# Try to import dotenv with fallback
try:
    from dotenv import find_dotenv, load_dotenv

    DOTENV_AVAILABLE = True
except ImportError:
    print(
        "Warning: python-dotenv not available. Install with: pip install python-dotenv"
    )
    DOTENV_AVAILABLE = False

# Performance monitoring import with fallback
try:
    from utils.performance_monitor import track_ai_generation

    PERFORMANCE_MONITOR_AVAILABLE = True
except ImportError:
    from contextlib import asynccontextmanager

    @asynccontextmanager
    async def track_ai_generation(metadata=None):
        yield

    PERFORMANCE_MONITOR_AVAILABLE = False


# Setup logging
def setup_logging(level: str = "INFO") -> logging.Logger:
    """Setup logging configuration"""
    logger = logging.getLogger("quiz_generator")
    logger.setLevel(getattr(logging, level.upper(), logging.INFO))

    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        formatter = logging.Formatter(
            "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)

    return logger


logger = setup_logging()

# Load environment variables
if DOTENV_AVAILABLE:
    load_dotenv(find_dotenv())


# Configuration class
@dataclass
class Config:
    """Configuration for the quiz generator"""

    google_api_key: Optional[str] = None
    serper_api_key: Optional[str] = None
    model_name: str = "gemini-2.5-flash-lite"
    temperature: float = 0.4
    max_tokens: int = 1000
    search_timeout: int = 8
    llm_timeout: int = 15
    max_retries: int = 3
    log_level: str = "INFO"

    def __post_init__(self):
        # Load API keys from environment or prompt user
        if not self.google_api_key:
            self.google_api_key = os.getenv("GOOGLE_GEMINI_API_KEY")
            if not self.google_api_key:
                try:
                    import getpass

                    self.google_api_key = getpass.getpass(
                        "Enter your Google Gemini API key: "
                    )
                except Exception as e:
                    logger.error(f"Failed to get API key: {e}")
                    raise ValueError("Google Gemini API key is required")

        if not self.serper_api_key:
            self.serper_api_key = os.getenv("SERPER_API_KEY")
            if not self.serper_api_key:
                try:
                    import getpass

                    self.serper_api_key = getpass.getpass("Enter your Serper API key: ")
                except Exception as e:
                    logger.warning(f"Serper API key not available: {e}")
                    logger.warning("Search functionality will be limited")


class QuestionType(Enum):
    DEFINITION = "definition"
    APPLICATION = "application"
    COMPARISON = "comparison"
    ANALYSIS = "analysis"
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
    options: Dict[str, str]
    correct_answer: str
    explanation: str
    difficulty: str
    question_type: QuestionType
    sources: List[str]
    confidence_score: float = 0.8


class SerperSearchTool:
    """Simple, reliable search tool with robust error handling"""

    def __init__(self, config: Config):
        self.config = config
        self.api_key = config.serper_api_key
        self.base_url = "https://google.serper.dev/search"
        self.session: Optional[aiohttp.ClientSession] = None

    async def __aenter__(self):
        """Async context manager entry"""
        self.session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=self.config.search_timeout)
        )
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        if self.session:
            await self.session.close()

    async def search(self, query: str, num_results: int = 5) -> List[SearchResult]:
        """Perform search and return structured results with retry logic"""
        if not self.api_key:
            logger.warning("No Serper API key available, skipping search")
            return []

        headers = {"X-API-KEY": self.api_key, "Content-Type": "application/json"}
        payload = {"q": query, "num": num_results, "gl": "us", "hl": "en"}

        for attempt in range(self.config.max_retries):
            try:
                if not self.session:
                    self.session = aiohttp.ClientSession(
                        timeout=aiohttp.ClientTimeout(total=self.config.search_timeout)
                    )

                async with self.session.post(
                    self.base_url,
                    headers=headers,
                    json=payload,
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        results = self._parse_results(data)
                        logger.info(
                            f"Search successful for '{query}': {len(results)} results"
                        )
                        return results
                    elif response.status == 401:
                        logger.error("Invalid Serper API key")
                        return []
                    elif response.status == 429:
                        logger.warning("Rate limited, retrying...")
                        await asyncio.sleep(2**attempt)  # Exponential backoff
                        continue
                    else:
                        logger.error(f"Search API error: {response.status}")
                        return []

            except asyncio.TimeoutError:
                logger.warning(f"Search timeout on attempt {attempt + 1}")
                if attempt == self.config.max_retries - 1:
                    return []
                await asyncio.sleep(1)
            except Exception as e:
                logger.error(f"Search failed on attempt {attempt + 1}: {e}")
                if attempt == self.config.max_retries - 1:
                    return []
                await asyncio.sleep(1)

        return []

    def _parse_results(self, data: dict) -> List[SearchResult]:
        """Parse Serper API response into SearchResult objects"""
        results = []
        try:
            for item in data.get("organic", []):
                results.append(
                    SearchResult(
                        title=item.get("title", ""),
                        snippet=item.get("snippet", ""),
                        link=item.get("link", ""),
                        date=item.get("date"),
                    )
                )
        except Exception as e:
            logger.error(f"Failed to parse search results: {e}")

        return results


class AdvancedQuizGenerator:
    """Balanced quiz generator combining reliability with smart features"""

    def __init__(self, config: Optional[Config] = None):
        self.config = config or Config()
        self.used_concepts = set()  # Simple diversity tracking

        if not LANGCHAIN_AVAILABLE:
            raise ImportError(
                "LangChain is required for quiz generation. Install with: pip install langchain-core langchain-google-genai"
            )

        self.llm = ChatGoogleGenerativeAI(
            model=self.config.model_name,
            api_key=self.config.google_api_key,
            temperature=self.config.temperature,
            max_tokens=self.config.max_tokens,
        )

    async def generate_quiz(
        self,
        topic: str,
        num_questions: int = 1,
        difficulty: str = "medium",
        force_refresh: bool = False,
        context_text: str = None,
        include_current_info: bool = True,
    ) -> List[QuizQuestion]:
        """Generate quiz with option for current info and robust error handling"""

        if not topic or not topic.strip():
            logger.error("Topic cannot be empty")
            return []

        topic = topic.strip()
        num_questions = max(1, min(num_questions, 10))  # Limit to reasonable range

        logger.info(f"🎯 Generating {num_questions} questions about '{topic}'")

        async with track_ai_generation(
            {
                "topic": topic,
                "num_questions": num_questions,
                "difficulty": difficulty,
                "has_context": bool(context_text),
                "include_current": include_current_info,
            }
        ):
            # Reset for new quiz
            self.used_concepts.clear()

            # Get search context if needed
            search_context = ""
            if not context_text or include_current_info:
                try:
                    async with SerperSearchTool(self.config) as search_tool:
                        search_context = await self._get_search_context(
                            topic, include_current_info, search_tool
                        )
                except Exception as e:
                    logger.warning(f"Failed to get search context: {e}")
                    search_context = f"Topic: {topic} (using general knowledge)"

            # Generate questions
            questions = []
            for i in range(num_questions):
                try:
                    question = await self._generate_single_question(
                        topic, i + 1, difficulty, context_text, search_context
                    )
                    if question:
                        questions.append(question)
                    else:
                        logger.warning(f"Failed to generate question {i + 1}")
                except Exception as e:
                    logger.error(f"Error generating question {i + 1}: {e}")
                    continue

            logger.info(f"✅ Generated {len(questions)} questions successfully")
            return questions

    async def _get_search_context(
        self,
        topic: str,
        include_current: bool = False,
        search_tool: SerperSearchTool = None,
    ) -> str:
        """Get balanced search context with error handling"""

        if not search_tool:
            logger.warning("No search tool available")
            return f"Topic: {topic} (using general knowledge)"

        # Base queries for general coverage
        queries = [
            f"{topic} definition explanation",
            f"{topic} examples applications",
            f"{topic} key concepts",
        ]

        # Add current info queries only if requested
        if include_current:
            current_year = datetime.now().year
            queries.extend(
                [
                    f"{topic} latest developments {current_year}",
                    f"{topic} recent news {current_year}",
                ]
            )

        logger.info(f"🔍 Searching for {topic} context...")

        # Execute searches
        all_results = []
        for query in queries:
            try:
                results = await asyncio.wait_for(
                    search_tool.search(query, 3), timeout=6.0
                )
                all_results.extend(results)
            except asyncio.TimeoutError:
                logger.warning(f"Search timeout for query: {query}")
                continue
            except Exception as e:
                logger.warning(f"Search failed for query '{query}': {e}")
                continue

        # Build context
        if not all_results:
            return f"Topic: {topic} (using general knowledge)"

        context_parts = []
        for i, result in enumerate(all_results[:8], 1):
            snippet = (
                result.snippet[:200] + "..."
                if len(result.snippet) > 200
                else result.snippet
            )
            context_parts.append(f"Source {i}: {snippet}")

        return "\n".join(context_parts)

    async def _generate_single_question(
        self,
        topic: str,
        question_num: int,
        difficulty: str,
        context_text: str,
        search_context: str,
    ) -> Optional[QuizQuestion]:
        """Generate a single high-quality question with retry logic"""

        # Select question type with simple diversity
        question_types = list(QuestionType)
        question_type = random.choice(question_types)

        # Build comprehensive context
        full_context = []
        if context_text:
            full_context.append(
                f"PROVIDED CONTEXT:\n{self._preprocess_text(context_text)[:800]}"
            )
        if search_context:
            full_context.append(f"SEARCH CONTEXT:\n{search_context[:600]}")

        context_str = (
            "\n".join(full_context)
            if full_context
            else f"Topic: {topic} (general knowledge)"
        )

        # Create focused prompt
        prompt = self._create_focused_prompt(
            topic, question_type, difficulty, context_str, question_num
        )

        # Retry logic for question generation
        for attempt in range(self.config.max_retries):
            try:
                response = await asyncio.wait_for(
                    self.llm.ainvoke(prompt), timeout=self.config.llm_timeout
                )
                question = self._parse_question_response(
                    response.content, topic, question_type, difficulty
                )
                if question:
                    return question
                else:
                    logger.warning(f"Failed to parse question on attempt {attempt + 1}")

            except asyncio.TimeoutError:
                logger.warning(f"LLM timeout on attempt {attempt + 1}")
                if attempt == self.config.max_retries - 1:
                    break
                await asyncio.sleep(1)
            except Exception as e:
                logger.error(
                    f"Question generation failed on attempt {attempt + 1}: {e}"
                )
                if attempt == self.config.max_retries - 1:
                    break
                await asyncio.sleep(1)

        logger.error(
            f"❌ Failed to generate question {question_num} after {self.config.max_retries} attempts"
        )
        return None

    def _create_focused_prompt(
        self,
        topic: str,
        question_type: QuestionType,
        difficulty: str,
        context: str,
        question_num: int,
    ) -> List:
        """Create clear, focused prompt without over-engineering"""

        type_instructions = {
            QuestionType.DEFINITION: "Ask what something is or means",
            QuestionType.APPLICATION: "Ask how something is used or applied",
            QuestionType.COMPARISON: "Ask about differences or similarities",
            QuestionType.ANALYSIS: "Ask why or how something works",
            QuestionType.PRACTICAL: "Ask about real-world implementation",
            QuestionType.CONCEPTUAL: "Ask about underlying principles",
            QuestionType.FACTUAL: "Ask about specific facts or data",
        }

        system_prompt = f"""You are an expert quiz creator. Generate ONE high-quality multiple-choice question about {topic}.

TOPIC: {topic}
QUESTION TYPE: {question_type.value} - {type_instructions[question_type]}
DIFFICULTY: {difficulty}
QUESTION NUMBER: {question_num}

CONTEXT INFORMATION:
{context[:1200]}

REQUIREMENTS:
1. Create ONE question specifically about {topic}
2. Focus on the {question_type.value} aspect
3. Generate exactly 4 options (A, B, C, D)
4. Make sure only ONE option is clearly correct
5. Each option should be concise (under 90 characters)
6. Avoid repetitive or overly similar options
7. Base the question on the provided context when possible
8. Make it appropriate for {difficulty} difficulty level

QUALITY STANDARDS:
- Question should be clear and unambiguous
- Distractors should be plausible but clearly wrong
- Test genuine understanding, not obscure trivia
- Avoid questions that could have multiple correct answers

OUTPUT FORMAT (JSON only):
{{
    "question": "Clear, specific question about {topic}",
    "options": [
        "Option A (correct answer)",
        "Option B (plausible distractor)",
        "Option C (plausible distractor)",
        "Option D (plausible distractor)"
    ],
    "correct_answer": "A",
    "explanation": "Clear explanation of why A is correct and others are wrong",
    "confidence_score": 0.9
}}

Generate the question now:"""

        return [HumanMessage(content=system_prompt)]

    def _parse_question_response(
        self, content: str, topic: str, question_type: QuestionType, difficulty: str
    ) -> Optional[QuizQuestion]:
        """Parse LLM response into QuizQuestion object with robust error handling"""
        try:
            # Extract JSON from response
            if "```json" in content:
                start = content.find("```json") + 7
                end = content.find("```", start)
                content = content[start:end] if end > start else content[start:]
            elif "```" in content:
                start = content.find("```") + 3
                end = content.find("```", start)
                content = content[start:end] if end > start else content[start:]

            # Clean the content
            content = content.strip()
            if content.startswith("```"):
                content = content[3:]
            if content.endswith("```"):
                content = content[:-3]

            data = json.loads(content.strip())

            # Validate required fields
            required_fields = ["question", "options", "correct_answer", "explanation"]
            if not all(field in data for field in required_fields):
                logger.error(
                    f"Missing required fields in response: {list(data.keys())}"
                )
                return None

            # Validate options
            options = data["options"]
            if not isinstance(options, list) or len(options) != 4:
                logger.error(f"Invalid options format: {options}")
                return None

            # Build options dictionary
            options_dict = {}
            for i, option in enumerate(options):
                if not isinstance(option, str):
                    logger.error(f"Invalid option type: {type(option)}")
                    return None
                key = chr(65 + i)  # A, B, C, D
                options_dict[key] = option[:90]  # Ensure length limit

            # Validate correct answer
            correct_answer = str(data["correct_answer"]).upper()
            if correct_answer not in ["A", "B", "C", "D"]:
                logger.warning(
                    f"Invalid correct answer '{correct_answer}', defaulting to 'A'"
                )
                correct_answer = "A"

            return QuizQuestion(
                question=data["question"],
                options=options_dict,
                correct_answer=correct_answer,
                explanation=data["explanation"],
                difficulty=difficulty,
                question_type=question_type,
                sources=[],  # Could add source tracking if needed
                confidence_score=float(data.get("confidence_score", 0.8)),
            )

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON response: {e}")
            logger.debug(f"Response content: {content[:200]}...")
            return None
        except Exception as e:
            logger.error(f"Failed to parse question: {e}")
            return None

    def _preprocess_text(self, text: str) -> str:
        """Clean and prepare text"""
        if not text:
            return ""

        try:
            # Remove markdown links
            text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
            # Remove URLs
            text = re.sub(r"https?://\S+", "", text)
            # Clean whitespace
            text = re.sub(r"\s+", " ", text)
            # Remove markdown headers
            text = re.sub(r"#{1,6}\s+", "", text)

            return text.strip()
        except Exception as e:
            logger.error(f"Failed to preprocess text: {e}")
            return text.strip() if text else ""


# Convenience function matching your original interface
async def generate_quiz(
    topic: str,
    num_questions: int = 1,
    difficulty: str = "medium",
    context_text: str = None,
    include_current_info: bool = False,
    config: Optional[Config] = None,
) -> str:
    """Generate quiz and return formatted string with error handling"""
    try:
        generator = AdvancedQuizGenerator(config)
        questions = await generator.generate_quiz(
            topic, num_questions, difficulty, context_text, include_current_info
        )

        if not questions:
            return f"Failed to generate quiz for topic: {topic}"

        formatted_questions = []
        for i, q in enumerate(questions, 1):
            options_text = "\n".join(
                [f"{key}) {value}" for key, value in q.options.items()]
            )
            formatted_questions.append(
                f"Question {i}: {q.question}\n{options_text}\n"
                f"Correct Answer: {q.correct_answer}\n"
                f"Explanation: {q.explanation}"
            )

        return "\n".join(formatted_questions)
    except Exception as e:
        logger.error(f"Quiz generation failed: {e}")
        return f"Error generating quiz for topic '{topic}': {str(e)}"


# Keep the original simple function as fallback
async def generate_quiz_simple(
    topic: str,
    num_questions: int = 1,
    context_text: str = None,
    config: Optional[Config] = None,
) -> str:
    """Simple version using your original approach with error handling"""

    if not LANGCHAIN_AVAILABLE:
        return "LangChain is required for quiz generation"

    try:
        async with track_ai_generation(
            {
                "topic": topic,
                "num_questions": num_questions,
                "has_context": bool(context_text),
                "method": "simple",
            }
        ):
            config = config or Config()
            llm = ChatGoogleGenerativeAI(
                model=config.model_name,
                api_key=config.google_api_key,
                temperature=0.75,
            )

            if context_text:
                context_text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", context_text)

            BASIC_SYSTEM = """You are QuizMasterGPT, an expert educator and fact-checker.
Your primary goal is to produce unique, evidence-based multiple-choice questions.
Each question should explore a different aspect of the main theme."""

            TEMPLATE = """
Generate {num_questions} distinct multiple-choice question(s) about **{topic}**.

Context (use if relevant, otherwise rely on general knowledge):
{context}

Requirements:
1. Focus solely on: **{topic}**
2. Each question covers a different aspect of **{topic}**
3. Generate EXACTLY four options per question (A-D)
4. Only ONE correct answer per question
5. State "Correct Answer: [letter]" after each question
6. No repetition between questions
7. Use verifiable facts only
8. Vary question types (definitions, applications, comparisons, etc.)
9. Concise, clear language
10. Number questions sequentially

Format:
Question 1: [question text]
A) [option]
B) [option]
C) [option]
D) [option]
Correct Answer: [letter]
"""

            prompt = ChatPromptTemplate.from_template(BASIC_SYSTEM + "\n" + TEMPLATE)
            messages = prompt.format_messages(
                topic=topic,
                num_questions=num_questions,
                context=context_text
                or f"No additional context. Use general knowledge about {topic}.",
            )

            response = await asyncio.wait_for(llm.ainvoke(messages), timeout=20.0)
            return response.content
    except Exception as e:
        logger.error(f"Simple generation failed: {e}")
        return f"Failed to generate quiz about {topic}: {str(e)}"
