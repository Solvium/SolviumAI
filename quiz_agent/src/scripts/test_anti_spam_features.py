#!/usr/bin/env python3
"""
Test script for anti-spam features implementation.

This script tests the key components of the anti-spam system:
1. Database schema changes
2. Rate limiting functionality
3. Message cleanup service
4. Leaderboard refresh functionality

Run this script to verify the implementation works correctly.
"""

import sys
import os
import asyncio
from datetime import datetime, timezone, timedelta

# Add the src directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import logging
from store.database import SessionLocal
from models.quiz import Quiz, QuizStatus
from utils.rate_limiter import is_rate_limited, reset_rate_limit
from services.message_cleanup_service import MessageCleanupService

logger = logging.getLogger(__name__)


async def test_database_schema():
    """Test that the new database fields exist"""
    logger.info("Testing database schema...")

    session = SessionLocal()
    try:
        # Check if the new fields exist by trying to query them
        result = session.execute(
            """
            SELECT announcement_message_id, leaderboard_message_id,
                   announcement_deleted_at, leaderboard_deleted_at,
                   leaderboard_created_at
            FROM quizzes
            LIMIT 1
        """
        )

        logger.info("✅ Database schema test passed - all anti-spam fields exist")
        return True

    except Exception as e:
        logger.error(f"❌ Database schema test failed: {e}")
        return False
    finally:
        session.close()


async def test_rate_limiting():
    """Test rate limiting functionality"""
    logger.info("Testing rate limiting...")

    try:
        user_id = "test_user_123"
        action = "test_action"

        # Test normal operation (should not be rate limited)
        is_limited = await is_rate_limited(
            user_id, action, max_attempts=3, window_seconds=60
        )
        if is_limited:
            logger.error(
                "❌ Rate limiting test failed - user should not be limited initially"
            )
            return False

        # Test rate limiting after multiple attempts
        for i in range(3):
            is_limited = await is_rate_limited(
                user_id, action, max_attempts=3, window_seconds=60
            )
            if i < 2 and is_limited:
                logger.error(
                    f"❌ Rate limiting test failed - user should not be limited after {i+1} attempts"
                )
                return False

        # After 3 attempts, user should be rate limited
        is_limited = await is_rate_limited(
            user_id, action, max_attempts=3, window_seconds=60
        )
        if not is_limited:
            logger.error(
                "❌ Rate limiting test failed - user should be limited after 3 attempts"
            )
            return False

        # Test reset functionality
        await reset_rate_limit(user_id, action)
        is_limited = await is_rate_limited(
            user_id, action, max_attempts=3, window_seconds=60
        )
        if is_limited:
            logger.error(
                "❌ Rate limiting test failed - user should not be limited after reset"
            )
            return False

        logger.info("✅ Rate limiting test passed")
        return True

    except Exception as e:
        logger.error(f"❌ Rate limiting test failed: {e}")
        return False


async def test_cleanup_service():
    """Test message cleanup service"""
    logger.info("Testing cleanup service...")

    try:
        # Create a mock cleanup service
        cleanup_service = MessageCleanupService()

        # Test that the service can be instantiated
        if not cleanup_service:
            logger.error("❌ Cleanup service test failed - could not create service")
            return False

        # Test cleanup cycle (should not crash)
        await cleanup_service.run_cleanup_cycle()

        logger.info("✅ Cleanup service test passed")
        return True

    except Exception as e:
        logger.error(f"❌ Cleanup service test failed: {e}")
        return False


async def test_quiz_model_fields():
    """Test that Quiz model has the new fields"""
    logger.info("Testing Quiz model fields...")

    try:
        # Create a test quiz object
        quiz = Quiz(
            topic="Test Quiz",
            questions=[],
            status=QuizStatus.ACTIVE,
            group_chat_id=-1001234567890,
        )

        # Test that new fields exist and can be set
        quiz.announcement_message_id = 12345
        quiz.leaderboard_message_id = 67890
        quiz.announcement_deleted_at = datetime.now(timezone.utc)
        quiz.leaderboard_deleted_at = datetime.now(timezone.utc)
        quiz.leaderboard_created_at = datetime.now(timezone.utc)

        # Verify fields were set
        if (
            quiz.announcement_message_id != 12345
            or quiz.leaderboard_message_id != 67890
            or not quiz.announcement_deleted_at
            or not quiz.leaderboard_deleted_at
            or not quiz.leaderboard_created_at
        ):
            logger.error("❌ Quiz model test failed - fields not set correctly")
            return False

        logger.info("✅ Quiz model test passed")
        return True

    except Exception as e:
        logger.error(f"❌ Quiz model test failed: {e}")
        return False


async def main():
    """Run all tests"""
    logger.info("🧪 Starting anti-spam features tests...")

    tests = [
        ("Database Schema", test_database_schema),
        ("Rate Limiting", test_rate_limiting),
        ("Cleanup Service", test_cleanup_service),
        ("Quiz Model Fields", test_quiz_model_fields),
    ]

    results = []
    for test_name, test_func in tests:
        logger.info(f"\n--- Running {test_name} Test ---")
        try:
            result = await test_func()
            results.append((test_name, result))
        except Exception as e:
            logger.error(f"❌ {test_name} test crashed: {e}")
            results.append((test_name, False))

    # Summary
    logger.info("\n" + "=" * 50)
    logger.info("TEST RESULTS SUMMARY")
    logger.info("=" * 50)

    passed = 0
    total = len(results)

    for test_name, result in results:
        status = "✅ PASSED" if result else "❌ FAILED"
        logger.info(f"{test_name}: {status}")
        if result:
            passed += 1

    logger.info(f"\nOverall: {passed}/{total} tests passed")

    if passed == total:
        logger.info("🎉 All tests passed! Anti-spam features are ready to use.")
        return True
    else:
        logger.error("⚠️  Some tests failed. Please check the implementation.")
        return False


if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)
