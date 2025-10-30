import os
import asyncio
import json
import re
from datetime import datetime
from typing import Optional, List
from dataclasses import dataclass
import aiohttp
from dotenv import find_dotenv, load_dotenv
import getpass

# Load environment variables
load_dotenv(find_dotenv())


@dataclass
class QuizConfig:
    """Simple configuration"""

    google_api_key: str
    serper_api_key: Optional[str] = None
    model: str = "gemini-2.0-flash"
    temperature: float = 0.75
    timeout: float = 30.0

    @classmethod
    def from_env(cls):
        google_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GOOGLE_GEMINI_API_KEY")
        if not google_key:
            google_key = getpass.getpass("Enter your Google API key: ")

        serper_key = os.getenv("SERPER_API_KEY")
        if not serper_key:
            print("Note: No Serper API key found. Web search disabled.")

        return cls(google_api_key=google_key, serper_api_key=serper_key)


async def search_project_info(project_name: str, config: QuizConfig) -> str:
    """Get current information about a specific project"""
    if not config.serper_api_key:
        return f"No web search available for {project_name}. Using general knowledge."

    queries = [
        f"{project_name} latest version features 2025",
        f"{project_name} recent updates changes",
        f"{project_name} current status documentation",
    ]

    all_info = []

    try:
        async with aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=10)
        ) as session:
            for query in queries:
                try:
                    payload = {"q": query, "num": 3, "gl": "us", "hl": "en"}

                    async with session.post(
                        "https://google.serper.dev/search",
                        headers={
                            "X-API-KEY": config.serper_api_key,
                            "Content-Type": "application/json",
                        },
                        json=payload,
                    ) as response:
                        if response.status == 200:
                            data = await response.json()
                            for result in data.get("organic", [])[
                                :2
                            ]:  # Top 2 per query
                                snippet = result.get("snippet", "")
                                if snippet and len(snippet) > 50:
                                    all_info.append(f"• {snippet}")
                        else:
                            print(
                                f"Search failed for '{query}': HTTP {response.status}"
                            )

                except Exception as e:
                    print(f"Search error for '{query}': {e}")
                    continue

                # Small delay between searches
                await asyncio.sleep(0.5)

    except Exception as e:
        print(f"Search system error: {e}")
        return f"Web search failed for {project_name}. Using general knowledge."

    if all_info:
        return f"Current information about {project_name}:\n" + "\n".join(all_info[:8])
    else:
        return (
            f"No current information found for {project_name}. Using general knowledge."
        )


def preprocess_text(text: str) -> str:
    """Clean and limit context text"""
    if not text:
        return ""

    # Basic cleanup
    text = re.sub(r"\s+", " ", text.strip())

    # Limit length to prevent token overflow
    if len(text) > 2000:
        text = text[:2000] + "..."

    return text


async def generate_quiz_questions(
    topic: str, num_questions: int, context: str, config: QuizConfig
) -> str:
    """Generate quiz using Gemini with proper error handling"""

    # Import here to avoid startup issues
    try:
        from langchain_openai import ChatOpenAI
        from langchain_google_genai import ChatGoogleGenerativeAI
        from langchain_core.prompts import ChatPromptTemplate
    except ImportError as e:
        raise ImportError(
            f"LangChain required: pip install langchain-google-genai langchain-core"
        ) from e

    # llm = ChatGoogleGenerativeAI(
    #     model=config.model,
    #     api_key=config.google_api_key,
    #     temperature=config.temperature,
    # )

    llm = ChatOpenAI(
        model="gpt-4o-mini",
        api_key=os.getenv("OPENAI_API_KEY"),
        temperature=config.temperature,
    )

    # Advanced prompt for challenging quiz generation
    system_prompt = """You are a Community Quiz Creator, an expert at creating fun, engaging, and accessible quiz questions for a general audience. Your goal is to spark interest and test foundational knowledge in a friendly way.

KEY PRINCIPLES:
- Accessible & Fun: Questions should be understandable to newcomers. Avoid overly technical jargon.
- Foundational Knowledge: Test core concepts and key facts.
- Clear & Concise: Keep questions and options simple and to the point.
- Positive & Encouraging Tone: The quiz should feel like a fun community activity.

GROUNDING:
- You MUST exclusively use the information from the "Context" section below.
- Do NOT use any external knowledge or information from web searches if context is provided.
- If the context is insufficient to create a question, state that as the answer.

QUESTION CATEGORIES TO EMPLOY:

1.  Key Concepts:
    *   Ask about the definition or purpose of a core idea.
    *   Example: "What is the main purpose of a blockchain?"

2.  General Knowledge:
    *   Ask about well-known facts or events related to the topic.
    *   Example: "Which cryptocurrency is the oldest?"

3.  Basic Comparison:
    *   Ask for a simple distinction between two things.
    *   Example: "What is one key difference between a wallet and an exchange?"

STRICT OUTPUT REQUIREMENTS:
- Generate exactly {num_questions} engaging question(s) about {topic}.
- Provide exactly 4 options (A-D).
- Number questions sequentially (1., 2., etc.).
- End each question with "Correct Answer: [letter]".

OUTPUT FORMAT (JSON only):
{{
    "question": "Clear, specific question about {topic}",
    "options": [
        "Option A (correct answer)",
        "Option B (plausible distractor)",
        "Option C (plausible distractor)",
        "Option D (plausible distractor)"
    ],
    "correct_answer": "A, B, C, or D",
}}

{context_instruction}"""

    context_instruction = (
        "**Crucially, you MUST base your questions on the provided context below. The context is the source of truth.**"
        if context.strip()
        else "Use your general knowledge about the topic."
    )

    prompt_text = system_prompt.format(
        num_questions=num_questions,
        topic=topic,
        context_instruction=context_instruction,
    )

    if context.strip():
        prompt_text += f"\n\nContext:\n{context}"

    # Generate with retry logic
    for attempt in range(3):
        try:
            print(f"Generating quiz questions (attempt {attempt + 1}/3)...")

            response = await asyncio.wait_for(
                llm.ainvoke([{"role": "user", "content": prompt_text}]),
                timeout=config.timeout,
            )

            if response.content and len(response.content.strip()) > 100:
                return response.content.strip()
            else:
                raise ValueError("Generated content too short")

        except asyncio.TimeoutError:
            print(f"Timeout on attempt {attempt + 1}")
            if attempt < 2:
                await asyncio.sleep(2**attempt)
        except Exception as e:
            print(f"Generation error on attempt {attempt + 1}: {e}")
            if attempt < 2:
                await asyncio.sleep(1)

    # Final fallback
    return generate_simple_fallback(topic, num_questions)


def generate_simple_fallback(topic: str, num_questions: int) -> str:
    """Generate a basic fallback quiz when AI generation fails"""
    fallback = f"""# {topic} Quiz (Fallback)

Unfortunately, the AI generation failed. Here's a basic question to get you started:

1. Question: What is {topic} primarily used for?
A) General purpose applications
B) Specific domain solutions
C) Educational purposes
D) All of the above
Correct Answer: D

Please try generating again or check your API configuration."""

    return fallback


def format_quiz_output(topic: str, content: str, has_search: bool) -> str:
    """Format the final quiz output"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M")

    header = f"""# {topic} Quiz
Generated on: {timestamp}
Search-enhanced: {"Yes" if has_search else "No"}

---

"""
    return header + content


async def generate_quiz(
    topic: str,
    num_questions: int = 3,
    context_text: str = None,
    use_current_info: bool = True,
) -> str:
    """
    Main function to generate a quiz.

    Args:
        topic: The subject for the quiz
        num_questions: Number of questions to generate
        context_text: Additional context to include
        use_current_info: Whether to search for current project information
    """
    config = QuizConfig.from_env()

    print(f"🎯 Generating {num_questions} question(s) about: {topic}")

    # Build context
    context_parts = []

    if context_text:
        context_parts.append(f"User Context:\n{preprocess_text(context_text)}")

    # Add current info if requested, available, and no specific context is given
    search_used = False
    if use_current_info and not context_text and config.serper_api_key:
        print("🔍 Searching for current project information...")
        current_info = await search_project_info(topic, config)
        if "No current information found" not in current_info:
            context_parts.append(f"Current Information:\n{current_info}")
            search_used = True
            print("✅ Current information added to context")
        else:
            print("⚠️ No current information found, using general knowledge")

    final_context = "\n\n".join(context_parts)

    # Generate the quiz
    print("🤖 Generating quiz questions...")
    try:
        quiz_content = await generate_quiz_questions(
            topic, num_questions, final_context, config
        )
        result = format_quiz_output(topic, quiz_content, search_used)
        print("✅ Quiz generation completed!")
        return result

    except Exception as e:
        print(f"❌ Quiz generation failed: {e}")
        return generate_simple_fallback(topic, num_questions)


# Simple CLI interface
async def main():
    """Interactive CLI for quiz generation"""
    print("=== Quiz Generator ===\n")

    topic = input("Enter topic/project name: ").strip()
    if not topic:
        print("Topic is required!")
        return

    try:
        num_q = input("Number of questions (default 3): ").strip()
        num_questions = int(num_q) if num_q.isdigit() and int(num_q) > 0 else 3
    except:
        num_questions = 3

    # Ask about current info
    current_info = input(
        "Include current/recent information? (y/n, default n): "
    ).lower()
    use_current = current_info == "y"

    # Optional context
    context = input("Any additional context? (press enter to skip): ").strip()
    context = context if context else None

    print(f"\n🚀 Starting generation...")

    # Generate quiz
    quiz = await generate_quiz(
        topic=topic,
        num_questions=num_questions,
        context_text=context,
        # use_current_info=use_current,
    )

    print(quiz)


if __name__ == "__main__":
    asyncio.run(main())
