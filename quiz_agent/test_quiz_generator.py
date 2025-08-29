#!/usr/bin/env python3
"""
Test script for the robust quiz generator
Demonstrates various usage patterns and error handling
"""

import asyncio
import sys
import os

# Add the src directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))

from better_agent import (
    AdvancedQuizGenerator,
    Config,
    generate_quiz,
    generate_quiz_simple,
)


async def test_basic_generation():
    """Test basic quiz generation"""
    print("=" * 60)
    print("TEST 1: Basic Quiz Generation")
    print("=" * 60)

    try:
        config = Config()
        generator = AdvancedQuizGenerator(config)

        questions = await generator.generate_quiz(
            topic="Python Programming", num_questions=2, difficulty="medium"
        )

        print(f"Generated {len(questions)} questions:")
        for i, q in enumerate(questions, 1):
            print(f"\nQuestion {i}:")
            print(f"Q: {q.question}")
            for key, value in q.options.items():
                print(f"  {key}) {value}")
            print(f"Correct Answer: {q.correct_answer}")
            print(f"Explanation: {q.explanation}")
            print(f"Type: {q.question_type.value}")
            print(f"Difficulty: {q.difficulty}")

    except Exception as e:
        print(f"Error in basic generation: {e}")


async def test_with_context():
    """Test quiz generation with provided context"""
    print("\n" + "=" * 60)
    print("TEST 2: Quiz Generation with Context")
    print("=" * 60)

    context = """
    Machine Learning is a subset of artificial intelligence that focuses on algorithms
    that can learn and make predictions from data. It includes supervised learning,
    unsupervised learning, and reinforcement learning. Popular frameworks include
    TensorFlow, PyTorch, and scikit-learn.
    """

    try:
        result = await generate_quiz(
            topic="Machine Learning",
            num_questions=1,
            difficulty="easy",
            context_text=context,
        )

        print("Generated quiz with context:")
        print(result)

    except Exception as e:
        print(f"Error in context generation: {e}")


async def main():
    """Run all tests"""
    print("🧪 Starting Quiz Generator Tests")
    print("Make sure you have set up your API keys!")
    print("You can set them as environment variables:")
    print("  - GOOGLE_GEMINI_API_KEY")
    print("  - SERPER_API_KEY")
    print("Or you'll be prompted to enter them.")
    print()

    tests = [
        test_basic_generation,
        test_with_context,
    
    ]

    for test in tests:
        try:
            await test()
        except Exception as e:
            print(f"Test failed: {e}")

        print("\n" + "-" * 40)

    print("\n✅ All tests completed!")


if __name__ == "__main__":
    asyncio.run(main())
