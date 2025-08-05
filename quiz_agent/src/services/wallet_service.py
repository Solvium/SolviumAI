import secrets
import hashlib
import base64
from typing import Dict, Optional
from utils.redis_client import RedisClient
from services.near_wallet_service import NEARWalletService
from services.database_service import db_service
from services.cache_service import cache_service
import logging

logger = logging.getLogger(__name__)

class WalletService:
    """Service for managing NEAR wallet creation and operations"""
    
    def __init__(self):
        self.redis_client = RedisClient()
        self.near_wallet_service = NEARWalletService()
    
    async def create_demo_wallet(self, user_id: int, user_name: str = None) -> Dict[str, str]:
        """
        Creates a real NEAR testnet wallet for the user
        Returns wallet info including account ID and encrypted private key
        """
        try:
            # Create real NEAR testnet wallet
            wallet_info = await self.near_wallet_service.create_testnet_wallet(user_id)
            
            # Enhanced caching with TTL and fallback
            await cache_service.cache_wallet_creation(user_id, wallet_info)
            
            # Save to database (non-blocking background task)
            await db_service.save_wallet_async(wallet_info, user_id, user_name)
            
            logger.info(f"Created NEAR testnet wallet for user {user_id}: {wallet_info['account_id']}")
            return wallet_info
            
        except Exception as e:
            logger.error(f"Error creating NEAR testnet wallet for user {user_id}: {e}")
            raise
    
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
                logger.debug(f"Falling back to direct database query for user {user_id}")
                wallet_data = await db_service.get_user_wallet(user_id)
                logger.debug(f"Direct DB query result for user {user_id}: {wallet_data}")
                return wallet_data
            except Exception as db_error:
                logger.error(f"Database fallback also failed for user {user_id}: {db_error}")
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
        Robust wallet check with cache-first then database fallback for critical operations
        """
        try:
            # 1. Quick cache check first
            cached_result = await cache_service.has_cached_wallet(user_id)
            if cached_result:
                logger.debug(f"Cache HIT: User {user_id} has wallet in cache")
                return True
            
            # 2. Database check for definitive answer
            logger.debug(f"Cache MISS: Checking database for user {user_id}")
            db_result = await db_service.has_wallet(user_id)
            
            # 3. Update cache if database has wallet but cache doesn't
            if db_result:
                logger.info(f"Database has wallet for user {user_id}, updating cache")
                await cache_service.cache_wallet_creation(user_id, {})
            
            return db_result
            
        except Exception as e:
            logger.error(f"Error in robust wallet check for user {user_id}: {e}")
            return False
    
    async def get_wallet_balance(self, user_id: int, force_refresh: bool = False) -> str:
        """
        Gets the real NEAR testnet wallet balance with caching
        """
        try:
            wallet = await self.get_user_wallet(user_id)
            if wallet and wallet.get("account_id"):
                account_id = wallet["account_id"]
                logger.info(f"Getting balance for account: {account_id}, force_refresh: {force_refresh}")
                
                # Check cache first (unless force refresh)
                if not force_refresh:
                    cached_balance = await cache_service.get_cached_balance(account_id)
                    if cached_balance:
                        logger.info(f"Using cached balance for {account_id}: {cached_balance}")
                        return cached_balance
                
                # Fetch from blockchain
                logger.info(f"Fetching fresh balance from blockchain for {account_id}")
                balance = await self.near_wallet_service.get_account_balance(account_id)
                logger.info(f"Fresh balance from blockchain for {account_id}: {balance}")
                
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
            return await self.near_wallet_service.format_wallet_info_message(wallet_info)
        except Exception as e:
            logger.error(f"Error formatting wallet message: {e}")
            return "❌ Error formatting wallet information. Please contact support." 