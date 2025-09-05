"""
Rate Limiting Utility for Anti-Spam Features

This utility helps prevent spam by limiting user actions within time windows.
"""

import asyncio
import logging
import time
from typing import Dict, Optional
from utils.redis_client import RedisClient

logger = logging.getLogger(__name__)


class RateLimiter:
    """Rate limiter for preventing spam actions"""

    def __init__(self):
        self.redis_client = RedisClient()

    async def is_rate_limited(
        self, user_id: str, action: str, max_attempts: int = 3, window_seconds: int = 60
    ) -> bool:
        """
        Check if a user is rate limited for a specific action

        Args:
            user_id: User ID to check
            action: Action type (e.g., 'quiz_not_found', 'leaderboard_request')
            max_attempts: Maximum attempts allowed in the window
            window_seconds: Time window in seconds

        Returns:
            True if rate limited, False if allowed
        """
        try:
            key = f"rate_limit:{action}:{user_id}"

            # Get current attempts
            attempts = await self.redis_client.get_value(key)
            if attempts is None:
                attempts = 0
            else:
                attempts = int(attempts)

            # Check if rate limited
            if attempts >= max_attempts:
                logger.info(
                    f"Rate limited user {user_id} for action {action} ({attempts}/{max_attempts})"
                )
                return True

            # Increment attempts
            await self.redis_client.set_value(
                key, str(attempts + 1), ttl_seconds=window_seconds
            )

            return False

        except Exception as e:
            logger.error(f"Error checking rate limit: {e}")
            return False  # Allow on error to avoid blocking users

    async def reset_rate_limit(self, user_id: str, action: str):
        """Reset rate limit for a user and action"""
        try:
            key = f"rate_limit:{action}:{user_id}"
            await self.redis_client.delete_value(key)
            logger.info(f"Reset rate limit for user {user_id} action {action}")
        except Exception as e:
            logger.error(f"Error resetting rate limit: {e}")

    async def get_remaining_attempts(
        self, user_id: str, action: str, max_attempts: int = 3
    ) -> int:
        """Get remaining attempts for a user and action"""
        try:
            key = f"rate_limit:{action}:{user_id}"
            attempts = await self.redis_client.get_value(key)
            if attempts is None:
                return max_attempts
            return max(0, max_attempts - int(attempts))
        except Exception as e:
            logger.error(f"Error getting remaining attempts: {e}")
            return max_attempts


# Global instance
rate_limiter = RateLimiter()


async def is_rate_limited(
    user_id: str, action: str, max_attempts: int = 3, window_seconds: int = 60
) -> bool:
    """Check if user is rate limited"""
    return await rate_limiter.is_rate_limited(
        user_id, action, max_attempts, window_seconds
    )


async def reset_rate_limit(user_id: str, action: str):
    """Reset rate limit for user"""
    await rate_limiter.reset_rate_limit(user_id, action)


async def get_remaining_attempts(
    user_id: str, action: str, max_attempts: int = 3
) -> int:
    """Get remaining attempts for user"""
    return await rate_limiter.get_remaining_attempts(user_id, action, max_attempts)
