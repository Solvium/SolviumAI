import redis.asyncio as redis  # Import the asyncio version
import json
import logging
from typing import Optional, Any, Dict
from utils.config import Config

logger = logging.getLogger(__name__)


class RedisClient:
    _instance: Optional[redis.Redis] = None  # Type hint for async client

    @classmethod
    async def get_instance(cls) -> redis.Redis:  # Made async
        if cls._instance is None:
            try:
                # Use redis.asyncio.Redis for an async client
                # Choose local or remote Redis based on environment
                if Config.is_development():
                    # Use local Redis for development
                    cls._instance = redis.Redis(
                        host=Config.REDIS_HOST_LOCAL,
                        port=Config.REDIS_PORT_LOCAL,
                        ssl=Config.REDIS_SSL_LOCAL,
                        password=Config.REDIS_PASSWORD_LOCAL,
                        decode_responses=False,
                    )
                else:
                    # Use remote Redis for production
                    cls._instance = redis.Redis(
                        host=Config.REDIS_HOST,
                        port=Config.REDIS_PORT,
                        ssl=Config.REDIS_SSL,
                        # db=Config.REDIS_DB,
                        password=Config.REDIS_PASSWORD,
                        decode_responses=False,
                    )
                await cls._instance.ping()  # await ping
                if Config.is_development():
                    logger.info(
                        f"Successfully connected to Local Async Redis at {Config.REDIS_HOST_LOCAL}:{Config.REDIS_PORT_LOCAL}"
                    )
                else:
                    logger.info(
                        f"Successfully connected to Remote Async Redis at {Config.REDIS_HOST}:{Config.REDIS_PORT}"
                    )
            except redis.exceptions.ConnectionError as e:
                logger.error(f"Could not connect to Async Redis: {e}")
                cls._instance = None  # Ensure instance is None on failure
                raise  # Re-raise the connection error
            except Exception as e:  # Catch any other exception during init
                logger.error(
                    f"An unexpected error occurred during Async Redis client initialization: {e}"
                )
                cls._instance = None
                raise
        return cls._instance

    @classmethod
    async def set_value(
        cls, key: str, value: Any, ttl_seconds: Optional[int] = None
    ) -> bool:  # Made async
        try:
            r = await cls.get_instance()  # await instance
            if r is None:
                logger.error(
                    f"Redis client not available. Cannot set value for key '{key}'"
                )
                return False
            serialized_value = json.dumps(value)
            if ttl_seconds:
                await r.setex(key, ttl_seconds, serialized_value)  # await setex
            else:
                await r.set(key, serialized_value)  # await set
            logger.debug(f"Set value for key '{key}' with TTL {ttl_seconds}s")
            return True
        except (redis.exceptions.RedisError, TypeError) as e:
            logger.error(f"Error setting value in Async Redis for key '{key}': {e}")
            return False
        except Exception as e:  # Catch unexpected errors
            logger.error(
                f"Unexpected error setting value in Async Redis for key '{key}': {e}"
            )
            return False

    @classmethod
    async def get_value(cls, key: str) -> Optional[Any]:  # Made async
        try:
            r = await cls.get_instance()  # await instance
            if r is None:
                logger.error(
                    f"Redis client not available. Cannot get value for key '{key}'"
                )
                return None
            serialized_value = await r.get(key)  # await get
            if serialized_value:
                logger.debug(f"Retrieved value for key '{key}'")
                return json.loads(serialized_value)
            logger.debug(f"No value found for key '{key}'")
            return None
        except (redis.exceptions.RedisError, TypeError) as e:
            logger.error(f"Error getting value from Async Redis for key '{key}': {e}")
            return None
        except Exception as e:  # Catch unexpected errors
            logger.error(
                f"Unexpected error getting value from Async Redis for key '{key}': {e}"
            )
            return None

    @classmethod
    async def delete_value(cls, key: str) -> bool:  # Made async
        try:
            r = await cls.get_instance()  # await instance
            if r is None:
                logger.error(f"Redis client not available. Cannot delete key '{key}'")
                return False
            result = await r.delete(key)  # await delete
            if result > 0:
                logger.debug(f"Deleted key '{key}' from Async Redis")
            else:
                logger.debug(f"Key '{key}' not found in Async Redis for deletion")
            return result > 0
        except redis.exceptions.RedisError as e:
            logger.error(f"Error deleting value from Async Redis for key '{key}': {e}")
            return False
        except Exception as e:  # Catch unexpected errors
            logger.error(
                f"Unexpected error deleting value from Async Redis for key '{key}': {e}"
            )
            return False

    @classmethod
    async def delete_key(cls, key: str) -> bool:
        """Alias for delete_value method for consistency."""
        return await cls.delete_value(key)

    # User data specific methods (all need to be async and await calls)
    USER_DATA_PREFIX = "user_data:"
    USER_DATA_TTL = 3600 * 24  # 24 hours

    @classmethod
    async def get_user_data(cls, user_id: str) -> Dict[str, Any]:  # Made async
        key = f"{cls.USER_DATA_PREFIX}{user_id}"
        data = await cls.get_value(key)  # await
        return data if isinstance(data, dict) else {}

    @classmethod
    async def update_user_data(
        cls, user_id: str, data_to_update: Dict[str, Any]
    ) -> bool:  # Made async
        key = f"{cls.USER_DATA_PREFIX}{user_id}"
        current_data = await cls.get_user_data(user_id)  # await
        current_data.update(data_to_update)
        return await cls.set_value(
            key, current_data, ttl_seconds=cls.USER_DATA_TTL
        )  # await

    @classmethod
    async def set_user_data_key(
        cls, user_id: str, data_key: str, value: Any
    ) -> bool:  # Made async
        key = f"{cls.USER_DATA_PREFIX}{user_id}"
        current_data = await cls.get_user_data(user_id)  # await
        current_data[data_key] = value
        return await cls.set_value(
            key, current_data, ttl_seconds=cls.USER_DATA_TTL
        )  # await

    @classmethod
    async def get_user_data_key(  # Made async
        cls, user_id: str, data_key: str, default: Optional[Any] = None
    ) -> Optional[Any]:
        current_data = await cls.get_user_data(user_id)  # await
        return current_data.get(data_key, default)

    @classmethod
    async def delete_user_data_key(
        cls, user_id: str, data_key: str
    ) -> bool:  # Made async
        key = f"{cls.USER_DATA_PREFIX}{user_id}"
        current_data = await cls.get_user_data(user_id)  # await
        if data_key in current_data:
            del current_data[data_key]
            return await cls.set_value(
                key, current_data, ttl_seconds=cls.USER_DATA_TTL
            )  # await
        return False

    @classmethod
    async def clear_user_data(cls, user_id: str) -> bool:  # Made async
        key = f"{cls.USER_DATA_PREFIX}{user_id}"
        return await cls.delete_value(key)  # await

    # --- User Quiz Data ---
    USER_QUIZ_DATA_PREFIX = "user_quiz_data:"
    USER_QUIZ_DATA_TTL = 3600 * 6  # 6 hours for active quiz data

    @classmethod
    async def get_user_quiz_data_all(cls, user_id: str, quiz_id: str) -> Dict[str, Any]:
        """Gets all quiz-related data for a user for a specific quiz."""
        key = f"{cls.USER_QUIZ_DATA_PREFIX}{user_id}:{quiz_id}"
        data = await cls.get_value(key)
        return data if isinstance(data, dict) else {}

    @classmethod
    async def set_user_quiz_data(
        cls, user_id: str, quiz_id: str, data_key: str, value: Any
    ) -> bool:
        """Sets a specific key-value pair in a user's data for a quiz."""
        key = f"{cls.USER_QUIZ_DATA_PREFIX}{user_id}:{quiz_id}"
        current_data = await cls.get_user_quiz_data_all(user_id, quiz_id)
        current_data[data_key] = value
        return await cls.set_value(
            key, current_data, ttl_seconds=cls.USER_QUIZ_DATA_TTL
        )

    @classmethod
    async def get_user_quiz_data(
        cls, user_id: str, quiz_id: str, data_key: str, default: Optional[Any] = None
    ) -> Optional[Any]:
        """Gets a specific value from a user's data for a quiz."""
        current_data = await cls.get_user_quiz_data_all(user_id, quiz_id)
        return current_data.get(data_key, default)

    # --- Generic Object Caching ---
    @classmethod
    async def get_cached_object(cls, cache_key: str) -> Optional[Any]:  # Made async
        """Retrieves a cached object from Redis."""
        try:
            r = await cls.get_instance()  # await
            if r is None:
                logger.error(
                    f"Redis client not available. Cannot get cached object for key {cache_key}"
                )
                return None
            value_json = await r.get(cache_key)  # await
            if value_json:
                logger.debug(f"Cache hit for key {cache_key}")
                return json.loads(value_json)
            logger.debug(f"Cache miss for key {cache_key}")
            return None
        except redis.exceptions.ConnectionError as e:
            logger.error(
                f"Connection error getting cached object for key {cache_key}: {e}"
            )
            return None
        except Exception as e:
            logger.error(f"Error getting cached object for key {cache_key}: {e}")
            return None

    @classmethod
    async def set_cached_object(
        cls, cache_key: str, obj: Any, ex: int = 3600
    ) -> bool:  # Made async
        """Caches an object in Redis with an expiration time."""
        try:
            r = await cls.get_instance()  # await
            if r is None:
                logger.error(
                    f"Redis client not available. Cannot set cached object for key {cache_key}"
                )
                return False
            await r.set(cache_key, json.dumps(obj), ex=ex)  # await
            logger.debug(f"Cached object with key {cache_key}")
            return True
        except redis.exceptions.ConnectionError as e:
            logger.error(f"Connection error caching object with key {cache_key}: {e}")
            return False
        except Exception as e:
            logger.error(f"Error caching object with key {cache_key}: {e}")
            return False

    @classmethod
    async def delete_cached_object(cls, cache_key: str) -> bool:  # Made async
        """Deletes a cached object from Redis."""
        try:
            r = await cls.get_instance()  # await
            if r is None:
                logger.error(
                    f"Redis client not available. Cannot delete cached object for key {cache_key}"
                )
                return False
            result = await r.delete(cache_key)  # await
            if result > 0:
                logger.debug(f"Deleted cached object with key {cache_key}")
            else:
                logger.debug(f"Key '{cache_key}' not found in Redis for deletion")
            return result > 0
        except redis.exceptions.ConnectionError as e:
            logger.error(
                f"Connection error deleting cached object with key {cache_key}: {e}"
            )
            return False
        except Exception as e:
            logger.error(f"Error deleting cached object with key {cache_key}: {e}")
            return False

    @classmethod
    async def close(cls):  # New async method to close connection
        if cls._instance:
            try:
                await cls._instance.close()
                logger.info("Async Redis client connection closed.")
            except Exception as e:
                logger.error(f"Error closing Async Redis client connection: {e}")
            finally:
                cls._instance = None

    # PERFORMANCE OPTIMIZATION: Quiz-specific caching methods
    QUIZ_CACHE_PREFIX = "quiz_cache:"
    QUIZ_DETAILS_PREFIX = "quiz_details:"
    QUIZ_PARTICIPANTS_PREFIX = "quiz_participants:"
    QUIZ_LEADERBOARD_PREFIX = "quiz_leaderboard:"
    ACTIVE_QUIZZES_PREFIX = "active_quizzes:"

    @classmethod
    async def cache_quiz_details(
        cls, quiz_id: str, quiz_data: dict, ttl_seconds: int = 3600
    ) -> bool:
        """Cache quiz details with optimized TTL based on quiz state."""
        key = f"{cls.QUIZ_DETAILS_PREFIX}{quiz_id}"
        return await cls.set_value(key, quiz_data, ttl_seconds=ttl_seconds)

    @classmethod
    async def get_cached_quiz_details(cls, quiz_id: str) -> Optional[dict]:
        """Retrieve cached quiz details."""
        key = f"{cls.QUIZ_DETAILS_PREFIX}{quiz_id}"
        return await cls.get_value(key)

    @classmethod
    async def cache_quiz_participants(
        cls, quiz_id: str, participants_data: list, ttl_seconds: int = 300
    ) -> bool:
        """Cache quiz participants list with shorter TTL for real-time updates."""
        key = f"{cls.QUIZ_PARTICIPANTS_PREFIX}{quiz_id}"
        return await cls.set_value(key, participants_data, ttl_seconds=ttl_seconds)

    @classmethod
    async def get_cached_quiz_participants(cls, quiz_id: str) -> Optional[list]:
        """Retrieve cached quiz participants."""
        key = f"{cls.QUIZ_PARTICIPANTS_PREFIX}{quiz_id}"
        return await cls.get_value(key)

    @classmethod
    async def cache_quiz_leaderboard(
        cls, quiz_id: str, leaderboard_data: dict, ttl_seconds: int = 180
    ) -> bool:
        """Cache quiz leaderboard with very short TTL for real-time competition."""
        key = f"{cls.QUIZ_LEADERBOARD_PREFIX}{quiz_id}"
        return await cls.set_value(key, leaderboard_data, ttl_seconds=ttl_seconds)

    @classmethod
    async def get_cached_quiz_leaderboard(cls, quiz_id: str) -> Optional[dict]:
        """Retrieve cached quiz leaderboard."""
        key = f"{cls.QUIZ_LEADERBOARD_PREFIX}{quiz_id}"
        return await cls.get_value(key)

    @classmethod
    async def cache_active_quizzes(
        cls, group_chat_id: str, active_quizzes: list, ttl_seconds: int = 600
    ) -> bool:
        """Cache active quizzes for a group chat."""
        key = f"{cls.ACTIVE_QUIZZES_PREFIX}{group_chat_id}"
        return await cls.set_value(key, active_quizzes, ttl_seconds=ttl_seconds)

    @classmethod
    async def get_cached_active_quizzes(cls, group_chat_id: str) -> Optional[list]:
        """Retrieve cached active quizzes for a group chat."""
        key = f"{cls.ACTIVE_QUIZZES_PREFIX}{group_chat_id}"
        return await cls.get_value(key)

    @classmethod
    async def invalidate_quiz_cache(cls, quiz_id: str) -> bool:
        """Invalidate all cached data related to a specific quiz using batch delete."""
        keys_to_delete = [
            f"{cls.QUIZ_DETAILS_PREFIX}{quiz_id}",
            f"{cls.QUIZ_PARTICIPANTS_PREFIX}{quiz_id}",
            f"{cls.QUIZ_LEADERBOARD_PREFIX}{quiz_id}",
        ]

        try:
            r = await cls.get_instance()
            if r is None:
                logger.error("Redis client not available for batch cache invalidation")
                return False

            # Use Redis pipeline for batch deletion to reduce round trips
            pipe = r.pipeline()
            for key in keys_to_delete:
                pipe.delete(key)
            results = await pipe.execute()

            success_count = sum(1 for result in results if result > 0)
            logger.info(
                f"Batch invalidated {success_count}/{len(keys_to_delete)} cache keys for quiz {quiz_id}"
            )
            return success_count > 0

        except Exception as e:
            logger.error(f"Error in batch cache invalidation for quiz {quiz_id}: {e}")
            # Fallback to individual deletion if batch fails
            success_count = 0
            for key in keys_to_delete:
                if await cls.delete_value(key):
                    success_count += 1

            logger.info(
                f"Fallback invalidated {success_count}/{len(keys_to_delete)} cache keys for quiz {quiz_id}"
            )
            return success_count > 0

    @classmethod
    async def invalidate_group_quiz_cache(cls, group_chat_id: str) -> bool:
        """Invalidate active quizzes cache for a group."""
        key = f"{cls.ACTIVE_QUIZZES_PREFIX}{group_chat_id}"
        return await cls.delete_value(key)

    @classmethod
    async def batch_invalidate_quiz_caches(cls, quiz_ids: list) -> int:
        """Batch invalidate multiple quiz caches for efficiency."""
        invalidated_count = 0
        for quiz_id in quiz_ids:
            if await cls.invalidate_quiz_cache(quiz_id):
                invalidated_count += 1
        return invalidated_count


# Example usage (if __name__ == "__main__"):
# This part would also need to be adapted to run within an asyncio event loop, e.g.:
# async def main_test():
#   # ... your test calls using await RedisClient.method() ...
# if __name__ == "__main__":
#   asyncio.run(main_test())
# For now, commenting out the synchronous test block
# if __name__ == "__main__":
#     # Basic test
#     logging.basicConfig(level=logging.DEBUG)
#     test_user_id = "12345_test"
#
#     # Clear any old data
#     RedisClient.clear_user_data(test_user_id)
#
#     # Test setting and getting user data
#     print(f"Initial data for {test_user_id}: {RedisClient.get_user_data(test_user_id)}")
#
#     RedisClient.set_user_data_key(test_user_id, "name", "Test User")
#     RedisClient.set_user_data_key(test_user_id, "state", "awaiting_something")
#     print(f"After setting name and state: {RedisClient.get_user_data(test_user_id)}")
#
#     name = RedisClient.get_user_data_key(test_user_id, "name")
#     state = RedisClient.get_user_data_key(test_user_id, "state")
#     print(f"Retrieved name: {name}, state: {state}")
#
#     RedisClient.delete_user_data_key(test_user_id, "state")
#     print(f"After deleting state: {RedisClient.get_user_data(test_user_id)}")
#
#     non_existent = RedisClient.get_user_data_key(
#         test_user_id, "non_existent_key", "default_val"
#     )
#     print(f"Non-existent key with default: {non_existent}")
#
#     RedisClient.update_user_data(test_user_id, {"age": 30, "city": "Testville"})
#     print(f"After bulk update: {RedisClient.get_user_data(test_user_id)}")
#
#     # Test general purpose set/get/delete
#     RedisClient.set_value("my_general_key", {"data": "some_info"}, ttl_seconds=60)
#     retrieved_general = RedisClient.get_value("my_general_key")
#     print(f"Retrieved general key: {retrieved_general}")
#     RedisClient.delete_value("my_general_key")
#     retrieved_general_after_delete = RedisClient.get_value("my_general_key")
#     print(f"Retrieved general key after delete: {retrieved_general_after_delete}")
#
#     print("Basic RedisClient tests complete.")
