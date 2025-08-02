import json
import logging
from typing import Optional, Dict, Any
from utils.redis_client import RedisClient
from services.database_service import db_service

logger = logging.getLogger(__name__)


class CacheService:
    """Comprehensive caching service for wallet and user data"""
    
    def __init__(self):
        self.redis_client = RedisClient()
        
        # Cache TTL settings (in seconds)
        self.WALLET_CACHE_TTL = 3600  # 1 hour
        self.USER_CACHE_TTL = 1800    # 30 minutes
        self.BALANCE_CACHE_TTL = 300  # 5 minutes
        self.SESSION_CACHE_TTL = 7200 # 2 hours
    
    async def get_cached_wallet(self, user_id: int) -> Optional[Dict[str, Any]]:
        """
        Get wallet from cache with database fallback
        """
        try:
            # Try Redis cache first
            cache_key = f"wallet:{user_id}"
            cached_data = await self.redis_client.get(cache_key)
            
            if cached_data:
                wallet_data = json.loads(cached_data)
                logger.debug(f"Cache HIT for wallet user {user_id}")
                return wallet_data
            
            # Cache miss - try database
            logger.debug(f"Cache MISS for wallet user {user_id}, checking database")
            db_wallet = await db_service.get_user_wallet(user_id)
            
            if db_wallet:
                # Cache the result
                await self.set_cached_wallet(user_id, db_wallet)
                logger.info(f"Retrieved wallet from database and cached for user {user_id}")
                return db_wallet
            
            return None
            
        except Exception as e:
            logger.error(f"Error getting cached wallet for user {user_id}: {e}")
            return None
    
    async def set_cached_wallet(self, user_id: int, wallet_data: Dict[str, Any]) -> bool:
        """
        Cache wallet data with TTL
        """
        try:
            cache_key = f"wallet:{user_id}"
            await self.redis_client.set_value(
                cache_key, 
                wallet_data,
                ttl_seconds=self.WALLET_CACHE_TTL
            )
            logger.debug(f"Cached wallet data for user {user_id}")
            return True
        except Exception as e:
            logger.error(f"Error caching wallet for user {user_id}: {e}")
            return False
    
    async def invalidate_wallet_cache(self, user_id: int) -> bool:
        """
        Invalidate wallet cache when data changes
        """
        try:
            cache_key = f"wallet:{user_id}"
            await self.redis_client.delete(cache_key)
            logger.debug(f"Invalidated wallet cache for user {user_id}")
            return True
        except Exception as e:
            logger.error(f"Error invalidating wallet cache for user {user_id}: {e}")
            return False
    
    async def get_cached_balance(self, account_id: str) -> Optional[str]:
        """
        Get cached balance with short TTL
        """
        try:
            cache_key = f"balance:{account_id}"
            cached_balance = await self.redis_client.get(cache_key)
            
            if cached_balance:
                logger.debug(f"Cache HIT for balance {account_id}")
                return cached_balance
            
            return None
            
        except Exception as e:
            logger.error(f"Error getting cached balance for {account_id}: {e}")
            return None
    
    async def set_cached_balance(self, account_id: str, balance: str) -> bool:
        """
        Cache balance with short TTL
        """
        try:
            cache_key = f"balance:{account_id}"
            await self.redis_client.set_value(cache_key, balance, ttl_seconds=self.BALANCE_CACHE_TTL)
            logger.debug(f"Cached balance for {account_id}: {balance}")
            return True
        except Exception as e:
            logger.error(f"Error caching balance for {account_id}: {e}")
            return False
    
    async def get_cached_user(self, user_id: int) -> Optional[Dict[str, Any]]:
        """
        Get cached user data
        """
        try:
            cache_key = f"user:{user_id}"
            cached_data = await self.redis_client.get(cache_key)
            
            if cached_data:
                user_data = json.loads(cached_data)
                logger.debug(f"Cache HIT for user {user_id}")
                return user_data
            
            return None
            
        except Exception as e:
            logger.error(f"Error getting cached user for {user_id}: {e}")
            return None
    
    async def set_cached_user(self, user_id: int, user_data: Dict[str, Any]) -> bool:
        """
        Cache user data
        """
        try:
            cache_key = f"user:{user_id}"
            await self.redis_client.set_value(
                cache_key, 
                user_data,
                ttl_seconds=self.USER_CACHE_TTL
            )
            logger.debug(f"Cached user data for {user_id}")
            return True
        except Exception as e:
            logger.error(f"Error caching user for {user_id}: {e}")
            return False
    
    async def cache_wallet_creation(self, user_id: int, wallet_info: Dict[str, Any]) -> bool:
        """
        Cache wallet immediately after creation
        """
        try:
            # Cache wallet data
            await self.set_cached_wallet(user_id, wallet_info)
            
            # Cache user wallet status
            await self.redis_client.set_value(
                f"wallet_created:{user_id}",
                "true",
                ttl_seconds=self.SESSION_CACHE_TTL
            )
            
            # Cache wallet info in legacy format for compatibility
            await self.redis_client.set_user_data_key(user_id, "wallet", wallet_info)
            await self.redis_client.set_user_data_key(user_id, "wallet_created", "true")
            
            logger.info(f"Cached wallet creation for user {user_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error caching wallet creation for user {user_id}: {e}")
            return False
    
    async def has_cached_wallet(self, user_id: int) -> bool:
        """
        Check if user has wallet in cache
        """
        try:
            # Check Redis cache first
            wallet_created = await self.redis_client.get(f"wallet_created:{user_id}")
            if wallet_created == "true":
                return True
            
            # Check legacy Redis format
            wallet_created = await self.redis_client.get_user_data_key(user_id, "wallet_created")
            if wallet_created == "true":
                return True
            
            # Check database as fallback
            return await db_service.has_wallet(user_id)
            
        except Exception as e:
            logger.error(f"Error checking cached wallet for user {user_id}: {e}")
            return False
    
    async def clear_user_cache(self, user_id: int) -> bool:
        """
        Clear all cached data for a user
        """
        try:
            cache_keys = [
                f"wallet:{user_id}",
                f"user:{user_id}",
                f"wallet_created:{user_id}",
                f"balance:*"  # Will need pattern matching
            ]
            
            for key in cache_keys:
                await self.redis_client.delete(key)
            
            logger.info(f"Cleared all cache for user {user_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error clearing cache for user {user_id}: {e}")
            return False


# Global cache service instance
cache_service = CacheService() 