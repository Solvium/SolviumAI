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
from utils.rpc_retry import (
    rpc_call_with_retry,
    WalletCreationError,
    RPCErrorType,
    AccountVerificationError,
)
from services.wallet_creation_queue import wallet_creation_queue

logger = logging.getLogger(__name__)


class NEARWalletService:
    """Service for creating and managing NEAR testnet and mainnet wallets with security best practices"""

    def __init__(self):
        self.testnet_rpc_url = Config.NEAR_TESTNET_RPC_URL
        self.testnet_helper_url = Config.NEAR_TESTNET_HELPER_URL
        self.mainnet_rpc_url = Config.NEAR_MAINNET_RPC_URL
        self.encryption_key = Config.get_wallet_encryption_key()
        self.main_account: Optional[Account] = None
        self._init_main_account()

        # Collision tracking for monitoring
        self.collision_count = 0
        self.total_attempts = 0

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
            backend=default_backend(),
        )
        return kdf.derive(password.encode())

    def _encrypt_data(self, data: str, key: bytes) -> Tuple[bytes, bytes, bytes]:
        """Encrypt data using AES-256-GCM"""
        iv = secrets.token_bytes(12)  # GCM uses 12 bytes

        cipher = Cipher(algorithms.AES(key), modes.GCM(iv), backend=default_backend())
        encryptor = cipher.encryptor()

        ciphertext = encryptor.update(data.encode()) + encryptor.finalize()
        tag = encryptor.tag  # Get the authentication tag

        return ciphertext, iv, tag

    def _decrypt_data(
        self, ciphertext: bytes, key: bytes, iv: bytes, tag: bytes
    ) -> str:
        """Decrypt data using AES-256-GCM"""
        cipher = Cipher(
            algorithms.AES(key), modes.GCM(iv, tag), backend=default_backend()
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
            encoding=serialization.Encoding.Raw, format=serialization.PublicFormat.Raw
        )

        # For NEAR, we need to create a 64-byte private key
        # The first 32 bytes are the actual private key, the last 32 bytes are the public key
        near_private_key_bytes = private_key_bytes + public_key_bytes

        return near_private_key_bytes, public_key_bytes

    async def _create_unique_account_id(
        self, user_id: int, is_mainnet: bool = False, max_retries: int = 5
    ) -> str:
        """
        Create a unique account ID with retry logic to handle collisions
        """
        from services.database_service import db_service

        for attempt in range(max_retries):
            self.total_attempts += 1

            # Generate account ID
            if is_mainnet:
                account_id = self._create_mainnet_sub_account_id(user_id)
            else:
                account_id = self._create_sub_account_id(user_id)

            # Check if account ID is available in database
            is_available = await db_service.is_account_id_available(account_id)

            if is_available:
                logger.debug(
                    f"Generated unique account ID: {account_id} (attempt {attempt + 1})"
                )
                return account_id
            else:
                self.collision_count += 1
                collision_rate = (
                    (self.collision_count / self.total_attempts) * 100
                    if self.total_attempts > 0
                    else 0
                )
                logger.warning(
                    f"Account ID collision detected: {account_id} (attempt {attempt + 1}/{max_retries}) "
                    f"Collision rate: {collision_rate:.2f}%"
                )
                if attempt == max_retries - 1:
                    logger.error(
                        f"Failed to generate unique account ID after {max_retries} attempts for user {user_id}"
                    )
                    raise Exception(
                        f"Unable to generate unique account ID after {max_retries} attempts"
                    )

        # This should never be reached, but just in case
        raise Exception("Failed to generate unique account ID")

    def get_collision_stats(self) -> Dict[str, float]:
        """
        Get collision statistics for monitoring
        """
        collision_rate = (
            (self.collision_count / self.total_attempts) * 100
            if self.total_attempts > 0
            else 0
        )
        return {
            "total_attempts": self.total_attempts,
            "collision_count": self.collision_count,
            "collision_rate_percent": collision_rate,
        }

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
            "quiz",
            "player",
            "gamer",
            "winner",
            "champion",
            "master",
            "pro",
            "ace",
            "star",
            "hero",
            "legend",
            "genius",
            "wizard",
            "ninja",
            "warrior",
            "knight",
            "archer",
            "mage",
            "rogue",
            "paladin",
            "druid",
            "monk",
            "priest",
            "shaman",
            "hunter",
            "warlock",
            "demon",
            "angel",
            "dragon",
            "phoenix",
            "unicorn",
            "griffin",
            "pegasus",
            "centaur",
            "minotaur",
            "sphinx",
            "hydra",
            "kraken",
            "leviathan",
            "behemoth",
            "titan",
            "giant",
            "dwarf",
            "elf",
            "orc",
            "goblin",
            "troll",
            "ogre",
            "cyclops",
            "medusa",
            "siren",
            "nymph",
            "fairy",
            "pixie",
            "sprite",
            "imp",
            "demon",
            "devil",
            "angel",
            "seraph",
            "cherub",
            "archon",
        ]

        # Generate a deterministic but unique sub-account name
        seed = f"{user_id}_{secrets.token_hex(4)}"
        word_index = int(hashlib.sha256(seed.encode()).hexdigest()[:8], 16) % len(
            readable_words
        )
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

            # Create unique sub-account ID with collision handling
            account_id = await self._create_unique_account_id(user_id, is_mainnet=False)

            # Format keys for NEAR using base58 encoding
            near_private_key = (
                f"ed25519:{base58.b58encode(near_private_key_bytes).decode()}"
            )
            near_public_key = f"ed25519:{base58.b58encode(public_key_bytes).decode()}"

            # Debug logging to check key format
            logger.debug(f"Generated private key length: {len(near_private_key)}")
            logger.debug(f"Private key format: {near_private_key[:50]}...")
            logger.debug(f"Public key format: {near_public_key[:50]}...")

            # Create sub-account on NEAR testnet
            # Pass the raw public key bytes for py-near create_account method
            try:
                account_created = await self._create_near_sub_account(
                    account_id, public_key_bytes
                )
                is_real_account = account_created and self.main_account is not None

                if not account_created:
                    raise WalletCreationError(
                        "Account creation returned False", RPCErrorType.UNKNOWN, True
                    )

            except WalletCreationError as e:
                logger.error(f"Sub-account creation failed: {e.message}")

                # Add to retry queue if retryable
                if e.retryable and Config.WALLET_CREATION_QUEUE_ENABLED:
                    logger.info(
                        f"Adding wallet creation to retry queue for user {user_id}"
                    )
                    await wallet_creation_queue.add_failed_wallet_creation(
                        user_id=user_id,
                        user_name=None,
                        is_mainnet=False,
                        account_id=account_id,
                        public_key=near_public_key,
                        private_key=near_private_key,
                        error_message=e.message,
                    )

                # Re-raise the error - no more silent fallbacks
                raise e

            # Encrypt private key for storage
            encrypted_private_key, iv, tag = self._encrypt_data(
                near_private_key, self.encryption_key
            )

            # Create wallet info
            wallet_info = {
                "account_id": account_id,
                "public_key": near_public_key,
                "encrypted_private_key": base64.b64encode(
                    encrypted_private_key
                ).decode(),
                "iv": base64.b64encode(iv).decode(),
                "tag": base64.b64encode(tag).decode(),
                "balance": "0 NEAR",
                "created_at": datetime.now().isoformat(),
                "is_testnet": True,
                "is_demo": not is_real_account,  # Mark as demo if not a real account
                "network": "testnet",
            }

            logger.info(f"Successfully created NEAR testnet wallet: {account_id}")
            return wallet_info

        except Exception as e:
            logger.error(f"Error creating NEAR testnet wallet for user {user_id}: {e}")
            raise

    async def create_mainnet_wallet(self, user_id: int) -> Dict[str, str]:
        """
        Creates a real NEAR mainnet wallet for the user
        Returns wallet info including account ID and encrypted private key
        """
        try:
            logger.info(f"Creating NEAR mainnet wallet for user {user_id}")

            # Check if mainnet is enabled in config
            if not Config.is_mainnet_enabled():
                raise Exception("Mainnet is not enabled in configuration")

            # Generate secure keypair in NEAR format
            near_private_key_bytes, public_key_bytes = self._generate_secure_keypair()

            # Create unique mainnet sub-account ID with collision handling
            account_id = await self._create_unique_account_id(user_id, is_mainnet=True)

            # Format keys for NEAR using base58 encoding
            near_private_key = (
                f"ed25519:{base58.b58encode(near_private_key_bytes).decode()}"
            )
            near_public_key = f"ed25519:{base58.b58encode(public_key_bytes).decode()}"

            # Debug logging to check key format
            logger.debug(
                f"Generated mainnet private key length: {len(near_private_key)}"
            )
            logger.debug(f"Mainnet private key format: {near_private_key[:50]}...")
            logger.debug(f"Mainnet public key format: {near_public_key[:50]}...")

            # Create sub-account on NEAR mainnet
            try:
                account_created = await self._create_mainnet_sub_account(
                    account_id, public_key_bytes
                )
                is_real_account = account_created and self.main_account is not None

                if not account_created:
                    raise WalletCreationError(
                        "Mainnet account creation returned False",
                        RPCErrorType.UNKNOWN,
                        True,
                    )

            except WalletCreationError as e:
                logger.error(f"Mainnet sub-account creation failed: {e.message}")

                # Add to retry queue if retryable
                if e.retryable and Config.WALLET_CREATION_QUEUE_ENABLED:
                    logger.info(
                        f"Adding mainnet wallet creation to retry queue for user {user_id}"
                    )
                    await wallet_creation_queue.add_failed_wallet_creation(
                        user_id=user_id,
                        user_name=None,
                        is_mainnet=True,
                        account_id=account_id,
                        public_key=near_public_key,
                        private_key=near_private_key,
                        error_message=e.message,
                    )

                # Re-raise the error - no more silent fallbacks
                raise e

            # Encrypt private key for storage
            encrypted_private_key, iv, tag = self._encrypt_data(
                near_private_key, self.encryption_key
            )

            # Create wallet info
            wallet_info = {
                "account_id": account_id,
                "public_key": near_public_key,
                "encrypted_private_key": base64.b64encode(
                    encrypted_private_key
                ).decode(),
                "iv": base64.b64encode(iv).decode(),
                "tag": base64.b64encode(tag).decode(),
                "balance": "0 NEAR",
                "created_at": datetime.now().isoformat(),
                "is_testnet": False,
                "is_demo": not is_real_account,  # Mark as demo if not a real account
                "network": "mainnet",
            }

            logger.info(f"Successfully created NEAR mainnet wallet: {account_id}")
            return wallet_info

        except Exception as e:
            logger.error(f"Error creating NEAR mainnet wallet for user {user_id}: {e}")
            raise

    async def _create_near_sub_account(
        self, sub_account_id: str, public_key: bytes
    ) -> bool:
        """
        Creates a NEAR sub-account using py-near create_account method (most reliable)
        NEVER returns True unless account is actually created on blockchain
        """
        try:
            # Get our main account from config
            main_account = Config.NEAR_WALLET_ADDRESS

            if not main_account:
                logger.error("NEAR_WALLET_ADDRESS not configured")
                raise WalletCreationError(
                    "NEAR_WALLET_ADDRESS not configured",
                    RPCErrorType.INVALID_REQUEST,
                    False,
                )

            # Extract sub-account name from full account ID
            # e.g., "quiz1234.kindpuma8958.testnet" -> "quiz1234"
            sub_account_name = sub_account_id.split(".")[0]

            logger.info(f"Creating sub-account {sub_account_name} under {main_account}")

            # Try py-near create_account method first (most reliable)
            if self.main_account:
                logger.info(
                    f"Attempting py-near create_account method: {sub_account_id}"
                )
                try:
                    real_created = await self._create_real_sub_account(
                        sub_account_id, public_key
                    )
                    if real_created:
                        # Verify account was actually created
                        verified = await self.verify_account_exists(
                            sub_account_id, "testnet"
                        )
                        if verified:
                            logger.info(
                                f"py-near create_account method successful and verified: {sub_account_id}"
                            )
                            return True
                        else:
                            logger.error(
                                f"Account creation appeared successful but verification failed: {sub_account_id}"
                            )
                            raise WalletCreationError(
                                "Account verification failed after creation",
                                RPCErrorType.UNKNOWN,
                                True,
                            )
                    else:
                        logger.warning(
                            f"py-near create_account method failed: {sub_account_id}"
                        )
                except Exception as e:
                    logger.error(f"py-near create_account method error: {e}")
                    raise WalletCreationError(
                        f"py-near creation failed: {str(e)}", RPCErrorType.UNKNOWN, True
                    )

            # Fallback: Try NEAR Helper API
            logger.info(
                f"Attempting sub-account creation via NEAR Helper API: {sub_account_id}"
            )

            # Convert bytes to NEAR format for helper API
            near_public_key = f"ed25519:{base64.b64encode(public_key).decode()}"

            payload = {
                "newAccountId": sub_account_id,
                "newAccountPublicKey": near_public_key,
            }

            try:

                async def _helper_api_call():
                    response = requests.post(
                        f"{self.testnet_helper_url}/account",
                        json=payload,
                        headers={"Content-Type": "application/json"},
                        timeout=Config.ACCOUNT_CREATION_TIMEOUT,
                    )
                    return response

                response = await rpc_call_with_retry(
                    _helper_api_call,
                    "near_helper_api",
                    max_retries=Config.RPC_MAX_RETRIES,
                )

                if response.status_code == 200:
                    # Verify account was actually created
                    verified = await self.verify_account_exists(
                        sub_account_id, "testnet"
                    )
                    if verified:
                        logger.info(
                            f"NEAR Helper API sub-account creation successful and verified: {sub_account_id}"
                        )
                        return True
                    else:
                        logger.error(
                            f"Helper API creation appeared successful but verification failed: {sub_account_id}"
                        )
                        raise WalletCreationError(
                            "Account verification failed after helper API creation",
                            RPCErrorType.UNKNOWN,
                            True,
                        )
                else:
                    error_msg = f"NEAR Helper API creation failed: {response.status_code} - {response.text}"
                    logger.warning(error_msg)
                    raise WalletCreationError(error_msg, RPCErrorType.UNKNOWN, True)

            except WalletCreationError:
                raise
            except Exception as api_error:
                logger.error(f"NEAR Helper API error: {api_error}")
                raise WalletCreationError(
                    f"Helper API error: {str(api_error)}", RPCErrorType.UNKNOWN, True
                )

            # If we reach here, all methods failed
            raise WalletCreationError(
                "All account creation methods failed", RPCErrorType.UNKNOWN, True
            )

        except WalletCreationError:
            raise
        except Exception as e:
            logger.error(f"Error creating NEAR sub-account {sub_account_id}: {e}")
            raise WalletCreationError(
                f"Unexpected error: {str(e)}", RPCErrorType.UNKNOWN, True
            )

    async def _create_real_sub_account(
        self, sub_account_id: str, public_key: bytes
    ) -> bool:
        """
        Creates a real NEAR sub-account using the py-near create_account method
        This requires the main account's private key
        """
        try:
            if not self.main_account:
                logger.error(
                    "Main account not initialized - cannot create real sub-account"
                )
                raise WalletCreationError(
                    "Main account not initialized", RPCErrorType.INVALID_REQUEST, False
                )

            # Extract sub-account name from full account ID
            # e.g., "quiz1234.kindpuma8958.testnet" -> "quiz1234"
            sub_account_name = sub_account_id.split(".")[0]

            logger.info(
                f"Creating real sub-account {sub_account_name} under {self.main_account.account_id}"
            )
            logger.debug(
                f"Public key type: {type(public_key)}, length: {len(public_key)}"
            )

            async def _create_account_call():
                # Start the main account connection
                await self.main_account.startup()

                # Use the py-near create_account method directly
                # This creates a sub-account with the specified name and public key
                # Use minimal balance from config (minimum for account creation)
                minimal_balance = int(
                    Config.MINIMAL_ACCOUNT_BALANCE * (10**24)
                )  # Convert to yoctoNEAR

                result = await self.main_account.create_account(
                    account_id=sub_account_id,
                    public_key=public_key,
                    initial_balance=minimal_balance,  # Minimal balance for account creation
                    nowait=False,  # Wait for execution
                )

                logger.info(f"Successfully created sub-account {sub_account_id}")
                logger.debug(f"Transaction result: {result}")
                return result

            # Use retry logic for the account creation
            result = await rpc_call_with_retry(
                _create_account_call,
                f"create_account_{sub_account_id}",
                max_retries=Config.RPC_MAX_RETRIES,
            )

            return True

        except WalletCreationError:
            raise
        except Exception as e:
            logger.error(f"Error creating real sub-account {sub_account_id}: {e}")
            raise WalletCreationError(
                f"Account creation failed: {str(e)}", RPCErrorType.UNKNOWN, True
            )



    async def _create_real_mainnet_sub_account(
        self, sub_account_id: str, public_key: bytes
    ) -> bool:
        """
        Creates a real NEAR mainnet sub-account using the py-near create_account method
        This requires the main account's private key
        """
        try:
            if not self.main_account:
                logger.error(
                    "Main account not initialized - cannot create real mainnet sub-account"
                )
                raise WalletCreationError(
                    "Main account not initialized for mainnet",
                    RPCErrorType.INVALID_REQUEST,
                    False,
                )

            # Extract sub-account name from full account ID
            # e.g., "quiz1234.solviumagent.near" -> "quiz1234"
            sub_account_name = sub_account_id.split(".")[0]

            logger.info(
                f"Creating real mainnet sub-account {sub_account_name} under {self.main_account.account_id}"
            )
            logger.debug(
                f"Public key type: {type(public_key)}, length: {len(public_key)}"
            )

            async def _create_mainnet_account_call():
                # Start the main account connection
                await self.main_account.startup()

                # Use the py-near create_account method directly
                # This creates a sub-account with the specified name and public key
                # Use minimal balance from config (minimum for account creation)
                minimal_balance = int(
                    Config.MINIMAL_ACCOUNT_BALANCE * (10**24)
                )  # Convert to yoctoNEAR

                result = await self.main_account.create_account(
                    account_id=sub_account_id,
                    public_key=public_key,
                    initial_balance=minimal_balance,  # Minimal balance for account creation
                    nowait=False,  # Wait for execution
                )

                logger.info(
                    f"Successfully created mainnet sub-account {sub_account_id}"
                )
                logger.debug(f"Transaction result: {result}")
                return result

            # Use retry logic for the account creation
            result = await rpc_call_with_retry(
                _create_mainnet_account_call,
                f"create_mainnet_account_{sub_account_id}",
                max_retries=Config.RPC_MAX_RETRIES,
            )

            return True

        except WalletCreationError:
            raise
        except Exception as e:
            logger.error(
                f"Error creating real mainnet sub-account {sub_account_id}: {e}"
            )
            raise WalletCreationError(
                f"Mainnet account creation failed: {str(e)}", RPCErrorType.UNKNOWN, True
            )

    async def verify_account_exists(
        self, account_id: str, network: str = "testnet"
    ) -> bool:
        """
        Verify that an account exists on the blockchain

        Args:
            account_id: The account ID to verify
            network: Network to check (testnet or mainnet)

        Returns:
            True if account exists, False otherwise
        """
        try:
            # Choose RPC endpoint based on network
            if network == "mainnet":
                rpc_url = self.mainnet_rpc_url
            else:
                rpc_url = self.testnet_rpc_url

            # Use RPC to check if account exists
            payload = {
                "jsonrpc": "2.0",
                "id": "dontcare",
                "method": "query",
                "params": {
                    "request_type": "view_account",
                    "finality": "final",
                    "account_id": account_id,
                },
            }

            async def _check_account():
                response = requests.post(
                    rpc_url,
                    json=payload,
                    headers={"Content-Type": "application/json"},
                    timeout=Config.ACCOUNT_VERIFICATION_TIMEOUT,
                )
                return response

            response = await rpc_call_with_retry(
                _check_account,
                f"verify_account_{network}",
                max_retries=Config.ACCOUNT_VERIFICATION_RETRIES,
            )

            if response.status_code == 200:
                data = response.json()
                if "result" in data:
                    logger.info(f"Account {account_id} exists on {network}")
                    return True
                elif "error" in data:
                    error_msg = data["error"].get("message", "")
                    if "does not exist" in error_msg or "UnknownAccount" in error_msg:
                        logger.warning(
                            f"Account {account_id} does not exist on {network}"
                        )
                        return False
                    else:
                        logger.error(
                            f"RPC error checking account {account_id}: {error_msg}"
                        )
                        raise AccountVerificationError(
                            f"RPC error: {error_msg}", account_id
                        )
            else:
                logger.error(
                    f"HTTP error checking account {account_id}: {response.status_code}"
                )
                raise AccountVerificationError(
                    f"HTTP error: {response.status_code}", account_id
                )

        except AccountVerificationError:
            raise
        except Exception as e:
            logger.error(f"Error verifying account {account_id} on {network}: {e}")
            raise AccountVerificationError(f"Verification failed: {str(e)}", account_id)

    async def get_account_balance(
        self, account_id: str, network: str = "testnet"
    ) -> str:
        """
        Gets the actual NEAR account balance using RPC
        Supports both testnet and mainnet based on the network parameter
        """
        try:
            # Choose RPC endpoint based on network
            if network == "mainnet":
                rpc_url = self.mainnet_rpc_url
                logger.debug(f"Using mainnet RPC for balance query: {account_id}")
            else:
                rpc_url = self.testnet_rpc_url
                logger.debug(f"Using testnet RPC for balance query: {account_id}")

            # Always use RPC for balance queries as it's more reliable
            return await self._get_balance_rpc_fallback(account_id, rpc_url)

        except Exception as e:
            logger.error(f"Error getting balance for {account_id} on {network}: {e}")
            return "0 NEAR"

    async def _get_balance_rpc_fallback(
        self, account_id: str, rpc_url: str = None
    ) -> str:
        """
        RPC method for getting account balance with retry logic
        """
        try:
            # Use provided RPC URL or default to testnet
            if rpc_url is None:
                rpc_url = self.testnet_rpc_url

            payload = {
                "jsonrpc": "2.0",
                "id": "dontcare",
                "method": "query",
                "params": {
                    "request_type": "view_account",
                    "finality": "final",
                    "account_id": account_id,
                },
            }

            logger.debug(
                f"Fetching balance for account: {account_id} using RPC: {rpc_url}"
            )

            async def _balance_call():
                response = requests.post(
                    rpc_url,
                    json=payload,
                    headers={"Content-Type": "application/json"},
                    timeout=Config.BALANCE_CHECK_TIMEOUT,
                )
                return response

            response = await rpc_call_with_retry(
                _balance_call,
                f"balance_check_{account_id}",
                max_retries=Config.RPC_MAX_RETRIES,
            )

            if response.status_code == 200:
                data = response.json()
                logger.debug(f"RPC response for {account_id}: {data}")

                if "result" in data and "amount" in data["result"]:
                    # Convert yoctoNEAR to NEAR
                    balance_yocto = int(data["result"]["amount"])
                    balance_near = balance_yocto / (10**24)
                    logger.info(
                        f"Successfully got balance for {account_id}: {balance_near} NEAR"
                    )
                    return f"{balance_near:.4f} NEAR"
                elif "error" in data:
                    logger.error(f"RPC error for {account_id}: {data['error']}")
                    return "0 NEAR"
                else:
                    logger.warning(f"No balance data found for {account_id}: {data}")
                    return "0 NEAR"
            else:
                logger.error(
                    f"Failed to get balance for {account_id}: HTTP {response.status_code}"
                )
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

            decrypted_key = self._decrypt_data(
                encrypted_bytes, self.encryption_key, iv_bytes, tag_bytes
            )
            return decrypted_key

        except Exception as e:
            logger.error(f"Error decrypting private key: {e}")
            raise

    async def format_wallet_info_message(
        self, wallet_info: Dict[str, str]
    ) -> tuple[str, Optional[InlineKeyboardMarkup]]:
        """
        Formats wallet information into a user-friendly message
        Supports both testnet and mainnet wallets
        """
        try:
            logger.info(
                f"DEBUG: format_wallet_info_message called with wallet_info keys: {list(wallet_info.keys())}"
            )

            # Decrypt private key for display
            private_key = self.decrypt_private_key(
                wallet_info["encrypted_private_key"],
                wallet_info["iv"],
                wallet_info["tag"],
            )
            logger.info(
                f"DEBUG: Private key decrypted successfully, length: {len(private_key)}"
            )

            # Determine network from wallet info
            network = wallet_info.get("network", "testnet")
            is_testnet = wallet_info.get("is_testnet", True)

            # Get real balance from NEAR blockchain
            balance = await self.get_account_balance(wallet_info["account_id"], network)

            # Get minimal balance for display
            minimal_balance = Config.MINIMAL_ACCOUNT_BALANCE

            # Check if this is a demo wallet
            is_demo = wallet_info.get("is_demo", False)

            # Choose explorer URL based on network
            if network == "mainnet" or not is_testnet:
                explorer_url = (
                    f"https://explorer.near.org/accounts/{wallet_info['account_id']}"
                )
                network_name = "Mainnet"
            else:
                explorer_url = f"https://explorer.testnet.near.org/accounts/{wallet_info['account_id']}"
                network_name = "Testnet"

            if is_demo:
                message = f"""🔐 **Your NEAR Account Created Successfully!** *(Demo Mode - {network_name})*

📋 **Account Details:**
• **Account ID:** `{wallet_info['account_id']}`
• **Network:** {network_name}
• **Balance:** {balance}

🔑 **Private Key (SAVE THIS SECURELY!):**
`{private_key}`

⚠️ **Security:** Never share your private key with anyone. Store it securely.

🌐 **Explorer:** {explorer_url}

🎮 **Ready to play?** Use the buttons below to start gaming!"""
            else:
                message = f"""🔐 **Your NEAR Account Created Successfully!** *({network_name})*

📋 **Account Details:**
• **Account ID:** `{wallet_info['account_id']}`
• **Network:** {network_name}
• **Balance:** {balance}

💰 **Initial Funding:** Your account was created with {minimal_balance} NEAR to cover storage costs.

🔑 **Private Key (SAVE THIS SECURELY!):**
`{private_key}`

⚠️ **Security:** Never share your private key with anyone. Store it securely.

🌐 **Explorer:** {explorer_url}

🎮 **Ready to play?** Use the buttons below to start gaming!"""

            # Create mini app keyboard
            mini_app_keyboard = InlineKeyboardMarkup(
                [
                    [
                        InlineKeyboardButton(
                            "🎮 Play Games",
                            web_app=WebAppInfo(url="https://quiz-agent.vercel.app/"),
                        )
                    ]
                ]
            )

            logger.info(
                f"DEBUG: Wallet message formatted successfully, returning message and keyboard"
            )
            return message, mini_app_keyboard

        except Exception as e:
            logger.error(f"Error formatting wallet message: {e}")
            logger.error(
                f"DEBUG: Exception in format_wallet_info_message: {type(e).__name__}: {str(e)}"
            )
            return (
                "❌ Error formatting wallet information. Please contact support.",
                None,
            )
