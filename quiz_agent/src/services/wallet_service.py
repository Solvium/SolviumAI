import secrets
import hashlib
import base64
from typing import Dict, Optional
from utils.redis_client import RedisClient
from services.near_wallet_service import NEARWalletService
import logging

logger = logging.getLogger(__name__)

class WalletService:
    """Service for managing NEAR wallet creation and operations"""
    
    def __init__(self):
        self.redis_client = RedisClient()
        self.near_wallet_service = NEARWalletService()
    
    async def create_demo_wallet(self, user_id: int) -> Dict[str, str]:
        """
        Creates a real NEAR testnet wallet for the user
        Returns wallet info including account ID and encrypted private key
        """
        try:
            # Create real NEAR testnet wallet
            wallet_info = await self.near_wallet_service.create_testnet_wallet(user_id)
            
            # Store wallet info in Redis
            await self.redis_client.set_user_data_key(user_id, "wallet", wallet_info)
            await self.redis_client.set_user_data_key(user_id, "wallet_created", "true")
            
            logger.info(f"Created NEAR testnet wallet for user {user_id}: {wallet_info['account_id']}")
            return wallet_info
            
        except Exception as e:
            logger.error(f"Error creating NEAR testnet wallet for user {user_id}: {e}")
            raise
    
    async def get_user_wallet(self, user_id: int) -> Optional[Dict[str, str]]:
        """
        Retrieves the user's wallet information from Redis
        """
        try:
            wallet_data = await self.redis_client.get_user_data_key(user_id, "wallet")
            if wallet_data:
                return wallet_data
            return None
        except Exception as e:
            logger.error(f"Error retrieving wallet for user {user_id}: {e}")
            return None
    
    async def has_wallet(self, user_id: int) -> bool:
        """
        Checks if the user already has a wallet
        """
        try:
            wallet_created = await self.redis_client.get_user_data_key(user_id, "wallet_created")
            return wallet_created == "true"
        except Exception as e:
            logger.error(f"Error checking wallet status for user {user_id}: {e}")
            return False
    
    async def get_wallet_balance(self, user_id: int) -> str:
        """
        Gets the real NEAR testnet wallet balance
        """
        try:
            wallet = await self.get_user_wallet(user_id)
            if wallet and wallet.get("account_id"):
                return await self.near_wallet_service.get_account_balance(wallet["account_id"])
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