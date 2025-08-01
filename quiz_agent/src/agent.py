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
    print(quiz)
