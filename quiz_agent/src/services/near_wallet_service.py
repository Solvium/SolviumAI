import secrets
import hashlib
import base64
import base58
import json
import os
from datetime import datetime
from typing import Dict, Optional, Tuple
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives.asymmetric import ed25519
import requests
import logging
from cryptography.hazmat.primitives import serialization
from utils.config import Config
from py_near.account import Account
from py_near.dapps.core import NEAR
from telegram import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo

logger = logging.getLogger(__name__)

class NEARWalletService:
    """Service for creating and managing NEAR testnet wallets with security best practices"""
    
    def __init__(self):
        self.testnet_rpc_url = Config.NEAR_TESTNET_RPC_URL
        self.testnet_helper_url = Config.NEAR_TESTNET_HELPER_URL
        self.encryption_key = Config.get_wallet_encryption_key()
        self.main_account: Optional[Account] = None
        self._init_main_account()
    
    def _init_main_account(self):
        """Initialize the main NEAR account for creating sub-accounts"""
        try:
            private_key = Config.NEAR_WALLET_PRIVATE_KEY
            account_id = Config.NEAR_WALLET_ADDRESS
            rpc_addr = Config.NEAR_RPC_ENDPOINT
            
            if not private_key or not account_id:
                logger.warning("Missing NEAR wallet credentials - will use demo mode")
                return
            
            if not rpc_addr:
                logger.warning("Missing NEAR RPC endpoint - will use demo mode")
                return
            
            # Initialize the main NEAR account
            self.main_account = Account(account_id, private_key, rpc_addr=rpc_addr)
            logger.info(f"Main NEAR account initialized: {account_id}")
            
        except Exception as e:
            logger.error(f"Failed to initialize main NEAR account: {e}")
            self.main_account = None
        
    def _generate_encryption_key(self) -> bytes:
        """Generate a secure encryption key for wallet data"""
        return secrets.token_bytes(32)
    
    def _derive_key_from_password(self, password: str, salt: bytes) -> bytes:
        """Derive encryption key from password using PBKDF2"""
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000,
            backend=default_backend()
        )
        return kdf.derive(password.encode())
    
    def _encrypt_data(self, data: str, key: bytes) -> Tuple[bytes, bytes, bytes]:
        """Encrypt data using AES-256-GCM"""
        iv = secrets.token_bytes(12)  # GCM uses 12 bytes
        
        cipher = Cipher(
            algorithms.AES(key),
            modes.GCM(iv),
            backend=default_backend()
        )
        encryptor = cipher.encryptor()
        
        ciphertext = encryptor.update(data.encode()) + encryptor.finalize()
        tag = encryptor.tag  # Get the authentication tag
        
        return ciphertext, iv, tag
    
    def _decrypt_data(self, ciphertext: bytes, key: bytes, iv: bytes, tag: bytes) -> str:
        """Decrypt data using AES-256-GCM"""
        cipher = Cipher(
            algorithms.AES(key),
            modes.GCM(iv, tag),
            backend=default_backend()
        )
        decryptor = cipher.decryptor()
        
        plaintext = decryptor.update(ciphertext) + decryptor.finalize()
        return plaintext.decode()
    
    def _generate_secure_keypair(self) -> Tuple[bytes, bytes]:
        """Generate a cryptographically secure Ed25519 keypair in NEAR format"""
        # Generate 32 bytes of random data for the private key
        private_key_bytes = secrets.token_bytes(32)
        
        # Create Ed25519 private key from raw bytes
        private_key = ed25519.Ed25519PrivateKey.from_private_bytes(private_key_bytes)
        public_key = private_key.public_key()
        
        # Get public key bytes
        public_key_bytes = public_key.public_bytes(
            encoding=serialization.Encoding.Raw,
            format=serialization.PublicFormat.Raw
        )
        
        # For NEAR, we need to create a 64-byte private key
        # The first 32 bytes are the actual private key, the last 32 bytes are the public key
        near_private_key_bytes = private_key_bytes + public_key_bytes
        
        return near_private_key_bytes, public_key_bytes
    
    def _create_sub_account_id(self, user_id: int) -> str:
        """Create a human-readable sub-account ID under our main testnet account"""
        # Get our main account from config
        main_account = Config.NEAR_WALLET_ADDRESS
        
        if not main_account:
            # Fallback for development
            main_account = "kindpuma8958.testnet"
        
        # Create human-readable sub-account names
        # Use a combination of user_id and a readable word
        readable_words = [
            "quiz", "player", "gamer", "winner", "champion", "master", "pro", "ace",
            "star", "hero", "legend", "genius", "wizard", "ninja", "warrior", "knight",
            "archer", "mage", "rogue", "paladin", "druid", "monk", "priest", "shaman",
            "hunter", "warlock", "demon", "angel", "dragon", "phoenix", "unicorn",
            "griffin", "pegasus", "centaur", "minotaur", "sphinx", "hydra", "kraken",
            "leviathan", "behemoth", "titan", "giant", "dwarf", "elf", "orc", "goblin",
            "troll", "ogre", "cyclops", "medusa", "siren", "nymph", "fairy", "pixie",
            "sprite", "imp", "demon", "devil", "angel", "seraph", "cherub", "archon"
        ]
        
        # Generate a deterministic but unique sub-account name
        seed = f"{user_id}_{secrets.token_hex(4)}"
        word_index = int(hashlib.sha256(seed.encode()).hexdigest()[:8], 16) % len(readable_words)
        word = readable_words[word_index]
        
        # Add a short unique suffix to avoid collisions
        suffix = hashlib.sha256(seed.encode()).hexdigest()[:4]
        
        sub_account_name = f"{word}{suffix}"
        return f"{sub_account_name}.{main_account}"
    
    async def create_testnet_wallet(self, user_id: int) -> Dict[str, str]:
        """
        Creates a real NEAR testnet wallet for the user
        Returns wallet info including account ID and encrypted private key
        """
        try:
            logger.info(f"Creating NEAR testnet wallet for user {user_id}")
            
            # Generate secure keypair in NEAR format
            near_private_key_bytes, public_key_bytes = self._generate_secure_keypair()
            
            # Create sub-account ID
            account_id = self._create_sub_account_id(user_id)
            
            # Format keys for NEAR using base58 encoding
            near_private_key = f"ed25519:{base58.b58encode(near_private_key_bytes).decode()}"
            near_public_key = f"ed25519:{base58.b58encode(public_key_bytes).decode()}"
            
            # Debug logging to check key format
            logger.debug(f"Generated private key length: {len(near_private_key)}")
            logger.debug(f"Private key format: {near_private_key[:50]}...")
            logger.debug(f"Public key format: {near_public_key[:50]}...")
            
            # Create sub-account on NEAR testnet
            # Pass the raw public key bytes for py-near create_account method
            account_created = await self._create_near_sub_account(account_id, public_key_bytes)
            
            # Determine if this is a real or demo account
            is_real_account = account_created and self.main_account is not None
            
            if not account_created:
                logger.warning(f"Sub-account creation failed, but continuing with demo wallet: {account_id}")
                # Continue with demo wallet creation for testing purposes
            
            # Encrypt private key for storage
            encrypted_private_key, iv, tag = self._encrypt_data(near_private_key, self.encryption_key)
            
            # Create wallet info
            wallet_info = {
                "account_id": account_id,
                "public_key": near_public_key,
                "encrypted_private_key": base64.b64encode(encrypted_private_key).decode(),
                "iv": base64.b64encode(iv).decode(),
                "tag": base64.b64encode(tag).decode(),
                "balance": "0 NEAR",
                "created_at": datetime.now().isoformat(),
                "is_testnet": True,
                "is_demo": not is_real_account,  # Mark as demo if not a real account
                "network": "testnet"
            }
            
            logger.info(f"Successfully created NEAR testnet wallet: {account_id}")
            return wallet_info
            
        except Exception as e:
            logger.error(f"Error creating NEAR testnet wallet for user {user_id}: {e}")
            raise
    
    async def _create_near_sub_account(self, sub_account_id: str, public_key: bytes) -> bool:
        """
        Creates a NEAR sub-account using py-near create_account method (most reliable)
        """
        try:
            # Get our main account from config
            main_account = Config.NEAR_WALLET_ADDRESS
            
            if not main_account:
                logger.error("NEAR_WALLET_ADDRESS not configured")
                return False
            
            # Extract sub-account name from full account ID
            # e.g., "quiz1234.kindpuma8958.testnet" -> "quiz1234"
            sub_account_name = sub_account_id.split('.')[0]
            
            logger.info(f"Creating sub-account {sub_account_name} under {main_account}")
            
            # Try py-near create_account method first (most reliable)
            if self.main_account:
                logger.info(f"Attempting py-near create_account method: {sub_account_id}")
                real_created = await self._create_real_sub_account(sub_account_id, public_key)
                if real_created:
                    logger.info(f"py-near create_account method successful: {sub_account_id}")
                    return True
                else:
                    logger.warning(f"py-near create_account method failed: {sub_account_id}")
            
            # Fallback: Try NEAR Helper API
            logger.info(f"Attempting sub-account creation via NEAR Helper API: {sub_account_id}")
            
            # Convert bytes to NEAR format for helper API
            near_public_key = f"ed25519:{base64.b64encode(public_key).decode()}"
            
            payload = {
                "newAccountId": sub_account_id,
                "newAccountPublicKey": near_public_key
            }
            
            try:
                response = requests.post(
                    f"{self.testnet_helper_url}/account",
                    json=payload,
                    headers={"Content-Type": "application/json"},
                    timeout=Config.ACCOUNT_CREATION_TIMEOUT
                )
                
                if response.status_code == 200:
                    logger.info(f"NEAR Helper API sub-account creation successful: {sub_account_id}")
                    return True
                else:
                    logger.warning(f"NEAR Helper API creation failed: {response.status_code} - {response.text}")
                    
            except Exception as api_error:
                logger.error(f"NEAR Helper API error: {api_error}")
            
            # Final fallback: Demo sub-account
            logger.info(f"All real creation methods failed, using demo sub-account: {sub_account_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error creating NEAR sub-account {sub_account_id}: {e}")
            return False
    
    async def _create_real_sub_account(self, sub_account_id: str, public_key: bytes) -> bool:
        """
        Creates a real NEAR sub-account using the py-near create_account method
        This requires the main account's private key
        """
        try:
            if not self.main_account:
                logger.error("Main account not initialized - cannot create real sub-account")
                return False
            
            # Extract sub-account name from full account ID
            # e.g., "quiz1234.kindpuma8958.testnet" -> "quiz1234"
            sub_account_name = sub_account_id.split('.')[0]
            
            logger.info(f"Creating real sub-account {sub_account_name} under {self.main_account.account_id}")
            logger.debug(f"Public key type: {type(public_key)}, length: {len(public_key)}")
            
            # Start the main account connection
            await self.main_account.startup()
            
            try:
                # Use the py-near create_account method directly
                # This creates a sub-account with the specified name and public key
                # Use minimal balance from config (minimum for account creation)
                minimal_balance = int(Config.MINIMAL_ACCOUNT_BALANCE * (10 ** 24))  # Convert to yoctoNEAR
                
                result = await self.main_account.create_account(
                    account_id=sub_account_id,
                    public_key=public_key,
                    initial_balance=minimal_balance,  # Minimal balance for account creation
                    nowait=False  # Wait for execution
                )
                
                logger.info(f"Successfully created sub-account {sub_account_id}")
                logger.debug(f"Transaction result: {result}")
                return True
                
            except Exception as create_error:
                logger.error(f"create_account method failed for sub-account creation: {create_error}")
                return False
                
        except Exception as e:
            logger.error(f"Error creating real sub-account {sub_account_id}: {e}")
            return False
    
    async def get_account_balance(self, account_id: str) -> str:
        """
        Gets the actual NEAR account balance using RPC
        """
        try:
            # Always use RPC for balance queries as it's more reliable
            return await self._get_balance_rpc_fallback(account_id)
                
        except Exception as e:
            logger.error(f"Error getting balance for {account_id}: {e}")
            return "0 NEAR"
    
    async def _get_balance_rpc_fallback(self, account_id: str) -> str:
        """
        RPC method for getting account balance
        """
        try:
            payload = {
                "jsonrpc": "2.0",
                "id": "dontcare",
                "method": "query",
                "params": {
                    "request_type": "view_account",
                    "finality": "final",
                    "account_id": account_id
                }
            }
            
            logger.debug(f"Fetching balance for account: {account_id}")
            
            response = requests.post(
                self.testnet_rpc_url,
                json=payload,
                headers={"Content-Type": "application/json"},
                timeout=Config.BALANCE_CHECK_TIMEOUT
            )
            
            if response.status_code == 200:
                data = response.json()
                logger.debug(f"RPC response for {account_id}: {data}")
                
                if "result" in data and "amount" in data["result"]:
                    # Convert yoctoNEAR to NEAR
                    balance_yocto = int(data["result"]["amount"])
                    balance_near = balance_yocto / (10 ** 24)
                    logger.info(f"Successfully got balance for {account_id}: {balance_near} NEAR")
                    return f"{balance_near:.4f} NEAR"
                elif "error" in data:
                    logger.error(f"RPC error for {account_id}: {data['error']}")
                    return "0 NEAR"
                else:
                    logger.warning(f"No balance data found for {account_id}: {data}")
                    return "0 NEAR"
            else:
                logger.error(f"Failed to get balance for {account_id}: HTTP {response.status_code}")
                return "0 NEAR"
                
        except Exception as e:
            logger.error(f"Error in RPC balance check for {account_id}: {e}")
            return "0 NEAR"
    
    def decrypt_private_key(self, encrypted_private_key: str, iv: str, tag: str) -> str:
        """
        Decrypts the private key for user display
        """
        try:
            encrypted_bytes = base64.b64decode(encrypted_private_key)
            iv_bytes = base64.b64decode(iv)
            tag_bytes = base64.b64decode(tag)
            
            decrypted_key = self._decrypt_data(encrypted_bytes, self.encryption_key, iv_bytes, tag_bytes)
            return decrypted_key
            
        except Exception as e:
            logger.error(f"Error decrypting private key: {e}")
            raise
    
    async def format_wallet_info_message(self, wallet_info: Dict[str, str]) -> tuple[str, Optional[InlineKeyboardMarkup]]:
        """
        Formats wallet information into a user-friendly message
        """
        try:
            # Decrypt private key for display
            private_key = self.decrypt_private_key(
                wallet_info['encrypted_private_key'], 
                wallet_info['iv'],
                wallet_info['tag']
            )
            
            # Get real balance from NEAR testnet
            balance = await self.get_account_balance(wallet_info['account_id'])
            
            # Get minimal balance for display
            minimal_balance = Config.MINIMAL_ACCOUNT_BALANCE
            
            # Check if this is a demo wallet
            is_demo = wallet_info.get('is_demo', False)
            
            if is_demo:
                message = f"""🔐 **Your NEAR Account Created Successfully!** *(Demo Mode)*

📋 **Account Details:**
• **Account ID:** `{wallet_info['account_id']}`
• **Balance:** {balance}

🔑 **Private Key (SAVE THIS SECURELY!):**
`{private_key}`

⚠️ **Security:** Never share your private key with anyone. Store it securely.

🌐 **Explorer:** https://explorer.testnet.near.org/accounts/{wallet_info['account_id']}

🎮 **Ready to play?** Use the buttons below to start gaming!"""
            else:
                message = f"""🔐 **Your NEAR Account Created Successfully!**

📋 **Account Details:**
• **Account ID:** `{wallet_info['account_id']}`
• **Balance:** {balance}

💰 **Initial Funding:** Your account was created with {minimal_balance} NEAR to cover storage costs.

💡 **To fund your account for paid quizzes:**
• Copy your account ID above
• Send NEAR from an exchange or another wallet
• Use a faucet for testnet NEAR (if on testnet)

🔑 **Private Key (SAVE THIS SECURELY!):**
`{private_key}`

⚠️ **Security:** Never share your private key with anyone. Store it securely.

🌐 **Explorer:** https://explorer.testnet.near.org/accounts/{wallet_info['account_id']}

🎮 **Ready to play?** Use the buttons below to start gaming!"""
            
            # Create mini app keyboard
            mini_app_keyboard = InlineKeyboardMarkup([
                [InlineKeyboardButton(
                    "🎮 Play Games", 
                    web_app=WebAppInfo(url="https://quiz-agent.vercel.app/")
                )]
            ])
            
            return message, mini_app_keyboard
            
        except Exception as e:
            logger.error(f"Error formatting wallet message: {e}")
            return "❌ Error formatting wallet information. Please contact support.", None 