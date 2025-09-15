import secrets
import hashlib
import base64
from typing import Dict, Optional
from utils.redis_client import RedisClient
from services.near_wallet_service import NEARWalletService
from services.database_service import db_service
from services.cache_service import cache_service
from utils.config import Config
from utils.rpc_retry import WalletCreationError, RPCErrorType
import logging

logger = logging.getLogger(__name__)


class WalletService:
    """Service for managing NEAR wallet creation and operations"""

    def __init__(self):
        self.redis_client = RedisClient()
        self.near_wallet_service = NEARWalletService()

    async def create_wallet(
        self,
        user_id: int,
        user_name: str = None,
        network: str = None,
        robust_mode: bool = None,
    ) -> Dict[str, str]:
        """
        Creates a NEAR wallet for the user with network-specific robustness
        - testnet: Can be simple (fast) or robust (for testing)
        - mainnet: Always robust with retries, error handling, verification

        Args:
            user_id: User ID for wallet creation
            user_name: Optional user name
            network: Network type ("testnet" or "mainnet"). If None, uses config default
            robust_mode: Force robust mode for testnet (None = auto-detect)

        Returns:
            Dict containing wallet information
        """
        if network is None:
            network = "mainnet" if Config.is_mainnet_enabled() else "testnet"

        if network == "mainnet":
            # Use robust retry logic for mainnet
            return await self._create_wallet_with_retry(
                user_id, user_name, network, max_retries=3
            )
        else:
            # For testnet, check if robust mode is requested
            if robust_mode is None:
                robust_mode = getattr(Config, "TESTNET_ROBUST_MODE_ENABLED", False)

            if robust_mode:
                # Use robust retry logic for testnet
                return await self._create_wallet_with_retry(
                    user_id, user_name, network, max_retries=3
                )
            else:
                # Simple creation for testnet
                return await self._create_wallet_simple(user_id, user_name, network)

    async def create_demo_wallet(
        self, user_id: int, user_name: str = None
    ) -> Dict[str, str]:
        """
        Legacy function - redirects to unified create_wallet
        Creates a NEAR wallet for the user based on environment configuration
        - Production: Creates mainnet wallet
        - Development: Creates testnet wallet
        Returns wallet info including account ID and encrypted private key
        """
        logger.info(
            "Using legacy create_demo_wallet - redirecting to unified create_wallet"
        )
        return await self.create_wallet(user_id, user_name)

    async def _create_wallet_simple(
        self, user_id: int, user_name: str, network: str
    ) -> Dict[str, str]:
        """
        Simple wallet creation for testnet (no retries)
        """
        logger.info(f"Creating NEAR {network} wallet for user {user_id} (simple mode)")

        wallet_info = await self.near_wallet_service.create_wallet(user_id, network)

        # Enhanced caching with TTL and fallback
        await cache_service.cache_wallet_creation(user_id, wallet_info)

        # Save to database (non-blocking background task)
        await db_service.save_wallet_async(wallet_info, user_id, user_name)

        logger.info(
            f"Created NEAR {network} wallet for user {user_id}: {wallet_info['account_id']}"
        )
        return wallet_info

    async def _create_wallet_with_retry(
        self,
        user_id: int,
        user_name: str = None,
        network: str = "mainnet",
        max_retries: int = 3,
    ) -> Dict[str, str]:
        """
        Creates a NEAR wallet with retry logic for handling account ID collisions and RPC errors
        """
        last_error = None

        for attempt in range(max_retries):
            try:
                logger.info(
                    f"Creating NEAR {network} wallet for user {user_id} (attempt {attempt + 1})"
                )

                # Use unified wallet creation
                wallet_info = await self.near_wallet_service.create_wallet(
                    user_id, network
                )

                # Enhanced caching with TTL and fallback
                await cache_service.cache_wallet_creation(user_id, wallet_info)

                # Save to database (non-blocking background task)
                await db_service.save_wallet_async(wallet_info, user_id, user_name)

                logger.info(
                    f"Created NEAR {network} wallet for user {user_id}: {wallet_info['account_id']}"
                )
                return wallet_info

            except WalletCreationError as e:
                last_error = e
                error_msg = getattr(e, "message", str(e))
                logger.error(
                    f"Wallet creation failed for user {user_id} (attempt {attempt + 1}): {error_msg}"
                )

                # Don't retry non-retryable errors
                if not e.retryable:
                    logger.error(f"Non-retryable error for user {user_id}: {error_msg}")
                    raise e

                # Don't retry on last attempt
                if attempt == max_retries - 1:
                    logger.error(f"All retry attempts failed for user {user_id}")
                    raise e

                # Log retry information
                logger.info(
                    f"Retrying wallet creation for user {user_id} in {2 ** attempt} seconds..."
                )

            except Exception as e:
                last_error = e
                logger.error(
                    f"Unexpected error creating wallet for user {user_id} (attempt {attempt + 1}): {e}"
                )

                # Don't retry on last attempt
                if attempt == max_retries - 1:
                    logger.error(f"All retry attempts failed for user {user_id}")
                    raise e

        # If we reach here, all retries failed
        if last_error:
            raise last_error
        else:
            raise Exception("Wallet creation failed after all retry attempts")

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

                # Invalidate token inventory cache when balance is refreshed
                # This ensures token inventory is also refreshed when balance changes
                await cache_service.invalidate_token_inventory_cache(account_id)

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
