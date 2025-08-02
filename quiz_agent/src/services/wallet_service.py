import secrets
import hashlib
import base64
from typing import Dict, Optional
from utils.redis_client import RedisClient
import logging

logger = logging.getLogger(__name__)

class WalletService:
    """Service for managing NEAR wallet creation and operations"""
    
    def __init__(self):
        self.redis_client = RedisClient()
    
    async def create_demo_wallet(self, user_id: int) -> Dict[str, str]:
        """
        Creates a demo NEAR wallet for the user
        Returns wallet info including account ID and private key
        """
        try:
            # Generate a random seed for the wallet
            seed = secrets.token_hex(32)
            
            # Create a deterministic account ID based on user_id and seed
            account_id = f"user_{user_id}_{seed[:8]}.testnet"
            
            # Generate a demo private key (in real implementation, this would use proper NEAR key derivation)
            private_key = f"ed25519:{base64.b64encode(seed.encode()).decode()}"
            
            # Create wallet info
            wallet_info = {
                "account_id": account_id,
                "private_key": private_key,
                "public_key": f"ed25519:{base64.b64encode(hashlib.sha256(seed.encode()).digest()).decode()}",
                "balance": "0 NEAR",
                "created_at": str(int(secrets.token_hex(4), 16)),  # Demo timestamp
                "is_demo": True
            }
            
            # Store wallet info in Redis
            await self.redis_client.set_user_data_key(user_id, "wallet", wallet_info)
            await self.redis_client.set_user_data_key(user_id, "wallet_created", "true")
            
            logger.info(f"Created demo wallet for user {user_id}: {account_id}")
            return wallet_info
            
        except Exception as e:
            logger.error(f"Error creating demo wallet for user {user_id}: {e}")
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
        Gets the wallet balance (demo implementation)
        """
        try:
            wallet = await self.get_user_wallet(user_id)
            if wallet:
                return wallet.get("balance", "0 NEAR")
            return "0 NEAR"
        except Exception as e:
            logger.error(f"Error getting wallet balance for user {user_id}: {e}")
            return "0 NEAR"
    
    async def format_wallet_info_message(self, wallet_info: Dict[str, str]) -> str:
        """
        Formats wallet information into a user-friendly message
        """
        message = f"""🔐 **Your NEAR Wallet Created Successfully!**

📋 **Wallet Details:**
• **Account ID:** `{wallet_info['account_id']}`
• **Public Key:** `{wallet_info['public_key']}`
• **Balance:** {wallet_info['balance']}

🔑 **Private Key (SAVE THIS SECURELY!):**
`{wallet_info['private_key']}`

⚠️ **Important Security Notes:**
• Never share your private key with anyone
• Store it in a secure location
• This is a demo wallet for testing purposes
• In production, use proper wallet security measures

🎉 You can now use all bot features that require a wallet!"""
        
        return message 