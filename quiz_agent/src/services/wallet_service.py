import secrets
import hashlib
import base64
from typing import Dict, Optional
from utils.redis_client import RedisClient
from services.near_wallet_service import NEARWalletService
from services.database_service import db_service
from services.cache_service import cache_service
from utils.config import Config
import logging

logger = logging.getLogger(__name__)


class WalletService:
    """Service for managing NEAR wallet creation and operations"""

    def __init__(self):
        self.redis_client = RedisClient()
        self.near_wallet_service = NEARWalletService()

    async def create_demo_wallet(
        self, user_id: int, user_name: str = None
    ) -> Dict[str, str]:
        """
        Creates a NEAR wallet for the user based on environment configuration
        - Production: Creates mainnet wallet
        - Development: Creates testnet wallet
        Returns wallet info including account ID and encrypted private key
        """
        return await self._create_wallet_with_retry(user_id, user_name, is_mainnet=False)

    async def create_mainnet_wallet(
        self, user_id: int, user_name: str = None
    ) -> Dict[str, str]:
        """
        Creates a real NEAR mainnet wallet for the user
        Returns wallet info including account ID and encrypted private key
        """
        return await self._create_wallet_with_retry(user_id, user_name, is_mainnet=True)

    async def _create_wallet_with_retry(
        self, user_id: int, user_name: str = None, is_mainnet: bool = False, max_retries: int = 3
    ) -> Dict[str, str]:
        """
        Creates a NEAR wallet with retry logic for handling account ID collisions
        """
        for attempt in range(max_retries):
            try:
                # Determine network based on environment and parameters
                if is_mainnet or Config.is_production():
                    logger.info(
                        f"Creating NEAR mainnet wallet for user {user_id} (attempt {attempt + 1})"
                    )
                    wallet_info = await self.near_wallet_service.create_mainnet_wallet(user_id)
                    network_type = "mainnet"
                else:
                    logger.info(
                        f"Creating NEAR testnet wallet for user {user_id} (attempt {attempt + 1})"
                    )
                    wallet_info = await self.near_wallet_service.create_testnet_wallet(user_id)
                    network_type = "testnet"

                # Enhanced caching with TTL and fallback
                await cache_service.cache_wallet_creation(user_id, wallet_info)

                # Save to database (non-blocking background task)
                await db_service.save_wallet_async(wallet_info, user_id, user_name)

                logger.info(
                    f"Created NEAR {network_type} wallet for user {user_id}: {wallet_info['account_id']}"
                )
                return wallet_info

            except Exception as e:
                logger.error(f"Error creating NEAR wallet for user {user_id} (attempt {attempt + 1}): {e}")
                
                # If this is the last attempt, raise the exception
                if attempt == max_retries - 1:
                    raise
                
                # Log retry attempt
                logger.info(f"Retrying wallet creation for user {user_id} (attempt {attempt + 2}/{max_retries})")
                continue



    async def get_user_wallet(self, user_id: int) -> Optional[Dict[str, str]]:
        """
        Retrieves the user's wallet information with enhanced caching
        """
        try:
            logger.debug(f"Getting wallet for user {user_id}")
            # Use enhanced cache service with database fallback
            wallet_data = await cache_service.get_cached_wallet(user_id)
            logger.debug(f"Retrieved wallet data for user {user_id}: {wallet_data}")
            return wallet_data
        except Exception as e:
            logger.error(f"Error retrieving wallet for user {user_id}: {e}")
            # Fallback to direct database query
            try:
                logger.debug(
                    f"Falling back to direct database query for user {user_id}"
                )
                wallet_data = await db_service.get_user_wallet(user_id)
                logger.debug(
                    f"Direct DB query result for user {user_id}: {wallet_data}"
                )
                return wallet_data
            except Exception as db_error:
                logger.error(
                    f"Database fallback also failed for user {user_id}: {db_error}"
                )
                return None

    async def has_wallet(self, user_id: int) -> bool:
        """
        Checks if the user already has a wallet with enhanced caching
        """
        try:
            return await cache_service.has_cached_wallet(user_id)
        except Exception as e:
            logger.error(f"Error checking wallet status for user {user_id}: {e}")
            return False

    async def has_wallet_robust(self, user_id: int) -> bool:
        """
        Robust wallet check that always validates against database for critical operations
        """
        try:
            # Always check database first for critical operations
            logger.info(
                f"Performing robust wallet check for user {user_id} - checking database"
            )
            db_result = await db_service.has_wallet(user_id)
            logger.info(f"Database check result for user {user_id}: {db_result}")

            # Update cache based on database result
            if db_result:
                logger.info(
                    f"Database confirms wallet exists for user {user_id}, updating cache"
                )
                await cache_service.cache_wallet_creation(user_id, {})
            else:
                logger.info(
                    f"Database confirms no wallet for user {user_id}, clearing any stale cache"
                )
                await cache_service.invalidate_wallet_cache(user_id)

            return db_result

        except Exception as e:
            logger.error(f"Error in robust wallet check for user {user_id}: {e}")
            # On error, try cache as fallback but log the issue
            try:
                cached_result = await cache_service.has_cached_wallet(user_id)
                logger.warning(
                    f"Database check failed for user {user_id}, using cache fallback: {cached_result}"
                )
                return cached_result
            except Exception as cache_error:
                logger.error(
                    f"Both database and cache checks failed for user {user_id}: {cache_error}"
                )
                return False

    async def get_wallet_balance(
        self, user_id: int, force_refresh: bool = False
    ) -> str:
        """
        Gets the real NEAR wallet balance with caching
        Supports both testnet and mainnet based on the wallet's network
        """
        try:
            wallet = await self.get_user_wallet(user_id)
            if wallet and wallet.get("account_id"):
                account_id = wallet["account_id"]
                network = wallet.get("network", "mainnet")
                logger.info(
                    f"Getting balance for account: {account_id} on {network}, force_refresh: {force_refresh}"
                )

                # Check cache first (unless force refresh)
                if not force_refresh:
                    cached_balance = await cache_service.get_cached_balance(account_id)
                    if cached_balance:
                        logger.info(
                            f"Using cached balance for {account_id}: {cached_balance}"
                        )
                        return cached_balance

                # Fetch from blockchain
                logger.info(
                    f"Fetching fresh balance from blockchain for {account_id} on {network}"
                )
                balance = await self.near_wallet_service.get_account_balance(
                    account_id, network
                )
                logger.info(
                    f"Fresh balance from blockchain for {account_id} on {network}: {balance}"
                )

                # Cache the result
                await cache_service.set_cached_balance(account_id, balance)

                return balance
            logger.warning(f"No wallet or account_id found for user {user_id}")
            return "0 NEAR"
        except Exception as e:
            logger.error(f"Error getting wallet balance for user {user_id}: {e}")
            return "0 NEAR"

    async def format_wallet_info_message(self, wallet_info: Dict[str, str]) -> str:
        """
        Formats wallet information into a user-friendly message using NEAR service
        """
        try:
            return await self.near_wallet_service.format_wallet_info_message(
                wallet_info
            )
        except Exception as e:
            logger.error(f"Error formatting wallet message: {e}")
            return "❌ Error formatting wallet information. Please contact support."
