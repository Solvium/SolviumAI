"""
Metadata and Balance Cache Service

This service provides caching for:
1. Token metadata (symbol, decimals, name, icon) - 24h TTL (rarely changes)
2. Account balances (NEAR and tokens) - 30s TTL (needs to be fresh)
3. Token inventory lists - 30s TTL (needs to be fresh)
"""

import json
import time
import logging
from typing import Optional, Dict, List
from utils.redis_client import RedisClient
from utils.config import Config

logger = logging.getLogger(__name__)


class MetadataCacheService:
    """
    Cache service for token metadata and balances with different TTLs.

    Caching Strategy:
    - Token Metadata (symbol, decimals, name): 24h TTL - rarely changes
    - Account Balances (NEAR/tokens): 30s TTL - needs freshness
    - Token Inventory: 30s TTL - needs freshness
    """

    def __init__(self):
        self.redis_client = RedisClient()
        self.metadata_ttl = Config.METADATA_CACHE_TTL  # 24 hours
        self.balance_ttl = Config.BALANCE_CACHE_TTL  # 30 seconds
        self.inventory_ttl = Config.TOKEN_INVENTORY_CACHE_TTL  # 30 seconds

    # ==================== Token Metadata Caching (24h TTL) ====================

    async def get_token_metadata(self, contract_id: str) -> Optional[Dict]:
        """
        Get cached token metadata (symbol, decimals, name, icon).

        Args:
            contract_id: Token contract address

        Returns:
            Metadata dict or None if not cached
        """
        try:
            cache_key = f"metadata:{contract_id}"
            cached = await self.redis_client.get(cache_key)

            if cached:
                logger.info(f"Metadata cache HIT for {contract_id}")
                return json.loads(cached)

            logger.info(f"Metadata cache MISS for {contract_id}")
            return None

        except Exception as e:
            logger.error(f"Error getting cached metadata for {contract_id}: {e}")
            return None

    async def set_token_metadata(self, contract_id: str, metadata: Dict) -> bool:
        """
        Cache token metadata for 24 hours.

        Args:
            contract_id: Token contract address
            metadata: Dict containing symbol, decimals, name, icon

        Returns:
            True if cached successfully, False otherwise
        """
        try:
            cache_key = f"metadata:{contract_id}"
            await self.redis_client.setex(
                cache_key, self.metadata_ttl, json.dumps(metadata)
            )
            logger.info(
                f"Cached metadata for {contract_id} (TTL: {self.metadata_ttl}s)"
            )
            return True

        except Exception as e:
            logger.error(f"Error caching metadata for {contract_id}: {e}")
            return False

    async def invalidate_token_metadata(self, contract_id: str) -> bool:
        """
        Manually invalidate cached metadata for a token.

        Args:
            contract_id: Token contract address

        Returns:
            True if invalidated successfully
        """
        try:
            cache_key = f"metadata:{contract_id}"
            await self.redis_client.delete(cache_key)
            logger.info(f"Invalidated metadata cache for {contract_id}")
            return True

        except Exception as e:
            logger.error(f"Error invalidating metadata for {contract_id}: {e}")
            return False

    # ==================== Account Balance Caching (30s TTL) ====================

    async def get_account_balance(self, account_id: str) -> Optional[str]:
        """
        Get cached NEAR account balance (30s TTL for freshness).

        Args:
            account_id: NEAR account ID

        Returns:
            Balance string (e.g., "1.2345 NEAR") or None if not cached
        """
        try:
            cache_key = f"balance:near:{account_id}"
            cached = await self.redis_client.get(cache_key)

            if cached:
                logger.debug(f"Balance cache HIT for {account_id}")
                return cached

            logger.debug(f"Balance cache MISS for {account_id}")
            return None

        except Exception as e:
            logger.error(f"Error getting cached balance for {account_id}: {e}")
            return None

    async def set_account_balance(self, account_id: str, balance: str) -> bool:
        """
        Cache NEAR account balance for 30 seconds.

        Args:
            account_id: NEAR account ID
            balance: Balance string (e.g., "1.2345 NEAR")

        Returns:
            True if cached successfully
        """
        try:
            cache_key = f"balance:near:{account_id}"
            await self.redis_client.setex(cache_key, self.balance_ttl, balance)
            logger.debug(f"Cached balance for {account_id} (TTL: {self.balance_ttl}s)")
            return True

        except Exception as e:
            logger.error(f"Error caching balance for {account_id}: {e}")
            return False

    async def get_token_balance(
        self, account_id: str, contract_id: str
    ) -> Optional[str]:
        """
        Get cached token balance for a specific account and token.

        Args:
            account_id: NEAR account ID
            contract_id: Token contract address

        Returns:
            Balance string or None if not cached
        """
        try:
            cache_key = f"balance:token:{account_id}:{contract_id}"
            cached = await self.redis_client.get(cache_key)

            if cached:
                logger.debug(f"Token balance cache HIT for {account_id}:{contract_id}")
                return cached

            logger.debug(f"Token balance cache MISS for {account_id}:{contract_id}")
            return None

        except Exception as e:
            logger.error(
                f"Error getting cached token balance for {account_id}:{contract_id}: {e}"
            )
            return None

    async def set_token_balance(
        self, account_id: str, contract_id: str, balance: str
    ) -> bool:
        """
        Cache token balance for 30 seconds.

        Args:
            account_id: NEAR account ID
            contract_id: Token contract address
            balance: Balance string

        Returns:
            True if cached successfully
        """
        try:
            cache_key = f"balance:token:{account_id}:{contract_id}"
            await self.redis_client.setex(cache_key, self.balance_ttl, balance)
            logger.debug(
                f"Cached token balance for {account_id}:{contract_id} (TTL: {self.balance_ttl}s)"
            )
            return True

        except Exception as e:
            logger.error(
                f"Error caching token balance for {account_id}:{contract_id}: {e}"
            )
            return False

    # ==================== Token Inventory Caching (30s TTL) ====================

    async def get_token_inventory(self, account_id: str) -> Optional[List[Dict]]:
        """
        Get cached token inventory (list of all tokens).

        Args:
            account_id: NEAR account ID

        Returns:
            List of token dicts or None if not cached
        """
        try:
            cache_key = f"inventory:{account_id}"
            cached = await self.redis_client.get(cache_key)

            if cached:
                logger.info(f"Token inventory cache HIT for {account_id}")
                return json.loads(cached)

            logger.info(f"Token inventory cache MISS for {account_id}")
            return None

        except Exception as e:
            logger.error(f"Error getting cached inventory for {account_id}: {e}")
            return None

    async def set_token_inventory(self, account_id: str, inventory: List[Dict]) -> bool:
        """
        Cache token inventory for 30 seconds.

        Args:
            account_id: NEAR account ID
            inventory: List of token dicts

        Returns:
            True if cached successfully
        """
        try:
            cache_key = f"inventory:{account_id}"
            await self.redis_client.setex(
                cache_key, self.inventory_ttl, json.dumps(inventory)
            )
            logger.info(
                f"Cached token inventory for {account_id} (TTL: {self.inventory_ttl}s)"
            )
            return True

        except Exception as e:
            logger.error(f"Error caching inventory for {account_id}: {e}")
            return False

    async def invalidate_token_inventory(self, account_id: str) -> bool:
        """
        Manually invalidate cached token inventory.

        Args:
            account_id: NEAR account ID

        Returns:
            True if invalidated successfully
        """
        try:
            cache_key = f"inventory:{account_id}"
            await self.redis_client.delete(cache_key)
            logger.info(f"Invalidated token inventory cache for {account_id}")
            return True

        except Exception as e:
            logger.error(f"Error invalidating inventory for {account_id}: {e}")
            return False

    # ==================== Utility Methods ====================

    async def clear_all_balances(self, account_id: str) -> bool:
        """
        Clear all cached balances for an account (NEAR + all tokens).
        Useful after transactions.

        Args:
            account_id: NEAR account ID

        Returns:
            True if cleared successfully
        """
        try:
            # Clear NEAR balance
            await self.redis_client.delete(f"balance:near:{account_id}")

            # Clear token inventory (which includes all token balances)
            await self.invalidate_token_inventory(account_id)

            logger.info(f"Cleared all balance caches for {account_id}")
            return True

        except Exception as e:
            logger.error(f"Error clearing balances for {account_id}: {e}")
            return False

    async def get_cache_stats(self) -> Dict:
        """
        Get cache statistics for monitoring.

        Returns:
            Dict with cache configuration and stats
        """
        return {
            "metadata_ttl_seconds": self.metadata_ttl,
            "balance_ttl_seconds": self.balance_ttl,
            "inventory_ttl_seconds": self.inventory_ttl,
            "metadata_ttl_human": f"{self.metadata_ttl / 3600:.1f}h",
            "balance_ttl_human": f"{self.balance_ttl}s",
            "inventory_ttl_human": f"{self.inventory_ttl}s",
        }


# Global instance for convenience
_metadata_cache_service = None


def get_metadata_cache_service() -> MetadataCacheService:
    """Get or create global MetadataCacheService instance"""
    global _metadata_cache_service
    if _metadata_cache_service is None:
        _metadata_cache_service = MetadataCacheService()
    return _metadata_cache_service
