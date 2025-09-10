import logging
import requests
import asyncio
from typing import Dict, List, Optional, Any
from pydantic import BaseModel
from py_near.account import Account
from py_near.dapps.fts import FTS
from py_near.dapps.fts import FtModel
from utils.config import Config
from utils.rpc_retry import rpc_call_with_retry, execute_with_rpc_fallback

logger = logging.getLogger(__name__)


class CustomFtTokenMetadata(BaseModel):
    """Custom metadata model that handles None values for optional fields"""

    spec: str
    name: str
    symbol: str
    icon: Optional[str] = None
    reference: Optional[str] = None
    reference_hash: Optional[str] = None
    decimals: int


class TokenService:
    """Robust token service using py-near FTS and NearBlocks API"""

    def __init__(self):
        # Use the correct NearBlocks API URL based on current network
        self.nearblocks_api_url = f"{Config.get_nearblocks_api_url()}/v1/account"
        # Use existing NEAR_WALLET_ADDRESS as main wallet
        self.main_wallet_address = Config.NEAR_WALLET_ADDRESS
        self.main_wallet_private_key = Config.NEAR_WALLET_PRIVATE_KEY

        # Log which network we're using
        current_network = Config.get_current_network()
        logger.info(
            f"TokenService initialized for {current_network} network using API: {self.nearblocks_api_url}"
        )

    async def _get_ft_model(self, account: Account, token_contract: str) -> FtModel:
        """Helper method to get FtModel with correct decimal places"""
        try:
            # First try to get metadata using our safe method
            temp_ft_model = FtModel(contract_id=token_contract, decimal=6)
            metadata = await self._get_metadata_safe(account, temp_ft_model)

            # Return proper FtModel with correct decimal
            logger.info(
                f"Created FtModel for {token_contract} with {metadata.decimals} decimals"
            )
            return FtModel(contract_id=token_contract, decimal=metadata.decimals)
        except Exception as e:
            logger.error(f"Error getting FtModel for {token_contract}: {e}")
            # For validation errors, try to get metadata from NearBlocks API as fallback
            try:
                # Get metadata from NearBlocks API - try direct contract metadata endpoint
                url = f"{self.nearblocks_api_url}/{token_contract}/inventory"
                response = requests.get(url, timeout=10)
                if response.status_code == 200:
                    data = response.json()
                    inventory = data.get("inventory", {})
                    fts = inventory.get("fts", [])
                    for ft in fts:
                        if ft.get("contract") == token_contract:
                            meta = ft.get("ft_meta", {})
                            decimals = meta.get("decimals", 6)
                            logger.info(f"Got decimals from NearBlocks API: {decimals}")
                            return FtModel(contract_id=token_contract, decimal=decimals)

                # If inventory doesn't work, try to get contract info directly
                contract_url = f"{self.nearblocks_api_url}/{token_contract}"
                contract_response = requests.get(contract_url, timeout=10)
                if contract_response.status_code == 200:
                    contract_data = contract_response.json()
                    # Look for token metadata in contract data
                    if "ft_meta" in contract_data:
                        decimals = contract_data["ft_meta"].get("decimals", 6)
                        logger.info(f"Got decimals from contract API: {decimals}")
                        return FtModel(contract_id=token_contract, decimal=decimals)

            except Exception as api_error:
                logger.error(f"Error getting metadata from NearBlocks API: {api_error}")

            # Final fallback to default decimal
            logger.warning(f"Using default 6 decimals for {token_contract}")
            return FtModel(contract_id=token_contract, decimal=6)

    async def _get_metadata_safe(
        self, account: Account, ft_model: FtModel
    ) -> CustomFtTokenMetadata:
        """Safely get metadata with custom model that handles None values"""
        try:
            # Try to get metadata using py-near's method
            metadata = await account.ft.get_metadata(ft_model)

            # Convert to our custom model that handles None values
            return CustomFtTokenMetadata(
                spec=getattr(metadata, "spec", ""),
                name=getattr(metadata, "name", "Unknown"),
                symbol=getattr(metadata, "symbol", "UNKNOWN"),
                icon=getattr(metadata, "icon", None),
                reference=getattr(metadata, "reference", None),
                reference_hash=getattr(metadata, "reference_hash", None),
                decimals=getattr(metadata, "decimals", 6),
            )
        except Exception as e:
            logger.error(f"Error getting token metadata: {e}")

            # If py-near fails due to validation errors, try NearBlocks API as fallback
            try:
                token_contract = ft_model.contract_id
                api_metadata = await self.get_token_metadata_from_api(token_contract)

                return CustomFtTokenMetadata(
                    spec="",
                    name=api_metadata["name"],
                    symbol=api_metadata["symbol"],
                    icon=api_metadata["icon"],
                    reference=api_metadata["reference"],
                    reference_hash=None,  # API doesn't provide this
                    decimals=api_metadata["decimals"],
                )
            except Exception as api_error:
                logger.error(
                    f"Error getting metadata from NearBlocks API fallback: {api_error}"
                )

            # Return default metadata
            return CustomFtTokenMetadata(
                spec="",
                name="Unknown",
                symbol="UNKNOWN",
                icon=None,
                reference=None,
                reference_hash=None,
                decimals=6,
            )

    async def get_user_token_inventory(self, account_id: str) -> List[Dict]:
        """Get all tokens for a user using NearBlocks API"""
        try:
            url = f"{self.nearblocks_api_url}/{account_id}/inventory"

            async def _api_call():
                response = requests.get(url, timeout=30)
                return response

            response = await rpc_call_with_retry(
                _api_call, "nearblocks_api", max_retries=3
            )

            if response.status_code == 200:
                data = response.json()
                inventory = data.get("inventory", {})
                fts = inventory.get("fts", [])

                # Format token data
                tokens = []
                for ft in fts:
                    contract = ft.get("contract")
                    amount = ft.get("amount", "0")
                    meta = ft.get("ft_meta", {})

                    # Convert amount to human readable
                    decimals = meta.get("decimals", 6)
                    amount_float = int(amount) / (10**decimals)

                    tokens.append(
                        {
                            "contract_address": contract,
                            "symbol": meta.get("symbol", "UNKNOWN"),
                            "name": meta.get("name", "Unknown Token"),
                            "decimals": decimals,
                            "balance": f"{amount_float:.6f}",
                            "balance_raw": amount,
                            "icon": meta.get("icon"),
                            "price": meta.get("price"),
                        }
                    )

                return tokens
            else:
                logger.error(f"NearBlocks API error: {response.status_code}")
                return []

        except Exception as e:
            logger.error(f"Error getting user token inventory: {e}")
            return []

    async def get_token_balance(self, account: Account, token_contract: str) -> str:
        """Get token balance using py-near FTS"""
        try:
            # Get FtModel with correct decimal places
            ft_model = await self._get_ft_model(account, token_contract)

            # Get balance using py-near
            balance = await account.ft.get_ft_balance(
                ft_model, account_id=account.account_id
            )

            # Get metadata for symbol using safe method
            metadata = await self._get_metadata_safe(account, ft_model)

            return f"{balance:.6f} {metadata.symbol}"

        except Exception as e:
            logger.error(f"Error getting token balance: {e}")
            return "0.000000 UNKNOWN"

    async def check_storage_deposit(
        self, account: Account, token_contract: str
    ) -> bool:
        """Check storage deposit using py-near FTS"""
        try:
            ft_model = await self._get_ft_model(account, token_contract)
            balance = await account.ft.storage_balance_of(
                ft_model, account_id=account.account_id
            )

            # Storage balance should be > 0.01 NEAR (in yoctoNEAR)
            min_storage = 10000000000000000000000  # 0.01 NEAR
            return balance >= min_storage

        except Exception as e:
            logger.error(f"Error checking storage deposit: {e}")
            return False

    async def add_storage_deposit(
        self, account: Account, token_contract: str, recipient_account_id: str = None
    ) -> Dict:
        """Add storage deposit using py-near FTS"""
        try:
            ft_model = await self._get_ft_model(account, token_contract)

            # Use recipient_account_id if provided, otherwise use account's own ID
            target_account = recipient_account_id or account.account_id

            result = await account.ft.storage_deposit(
                ft_model, account_id=target_account
            )

            return {
                "success": True,
                "transaction_hash": result.transaction_hash,
                "message": "Storage deposit added successfully",
            }

        except Exception as e:
            logger.error(f"Error adding storage deposit: {e}")
            return {
                "success": False,
                "error": str(e),
                "message": "Failed to add storage deposit",
            }

    async def transfer_tokens(
        self,
        account: Account,
        token_contract: str,
        recipient_account_id: str,
        amount: float,
        force_register: bool = True,
    ) -> Dict:
        """Transfer tokens using py-near FTS"""
        try:
            ft_model = await self._get_ft_model(account, token_contract)

            # Get metadata to ensure we have the correct decimal places
            metadata = await self._get_metadata_safe(account, ft_model)

            # Log the transfer details for debugging
            logger.info(
                f"Transferring {amount} tokens with {metadata.decimals} decimals"
            )

            # Use py-near's transfer method with force_register
            # py-near handles the decimal conversion internally
            result = await account.ft.transfer(
                ft_model,
                recipient_account_id,
                amount,
                force_register=force_register,
                nowait=True,  # Return transaction hash immediately
            )

            return {
                "success": True,
                "transaction_hash": result,
                "amount": amount,
                "decimals": metadata.decimals,
                "message": f"Successfully transferred {amount} {metadata.symbol} tokens",
            }

        except Exception as e:
            logger.error(f"Error transferring tokens: {e}")
            return {
                "success": False,
                "error": str(e),
                "message": "Token transfer failed",
            }

    async def get_token_metadata(self, account: Account, token_contract: str) -> Dict:
        """Get token metadata using py-near FTS"""
        try:
            ft_model = await self._get_ft_model(account, token_contract)
            metadata = await self._get_metadata_safe(account, ft_model)

            return {
                "name": metadata.name,
                "symbol": metadata.symbol,
                "decimals": metadata.decimals,
                "icon": metadata.icon,
                "reference": metadata.reference,
            }

        except Exception as e:
            logger.error(f"Error getting token metadata: {e}")
            return {
                "name": "Unknown",
                "symbol": "UNKNOWN",
                "decimals": 6,
                "icon": None,
                "reference": None,
            }

    async def get_supported_tokens_for_user(self, account_id: str) -> List[Dict]:
        """Get tokens that user actually has (non-zero balance)"""
        try:
            tokens = await self.get_user_token_inventory(account_id)
            # Filter tokens with non-zero balance
            available_tokens = [
                token for token in tokens if float(token["balance"]) > 0
            ]
            return available_tokens
        except Exception as e:
            logger.error(f"Error getting supported tokens for user: {e}")
            return []

    async def get_token_metadata_from_api(self, token_contract: str) -> Dict:
        """Get token metadata directly from NearBlocks API as fallback"""
        try:
            # Try to get contract metadata directly
            contract_url = f"{self.nearblocks_api_url}/{token_contract}"
            response = requests.get(contract_url, timeout=10)

            if response.status_code == 200:
                data = response.json()
                if "ft_meta" in data:
                    meta = data["ft_meta"]
                    return {
                        "name": meta.get("name", "Unknown"),
                        "symbol": meta.get("symbol", "UNKNOWN"),
                        "decimals": meta.get("decimals", 6),
                        "icon": meta.get("icon"),
                        "reference": meta.get("reference"),
                    }

            # If direct contract doesn't work, try inventory approach
            inventory_url = f"{self.nearblocks_api_url}/{token_contract}/inventory"
            inventory_response = requests.get(inventory_url, timeout=10)

            if inventory_response.status_code == 200:
                inventory_data = inventory_response.json()
                inventory = inventory_data.get("inventory", {})
                fts = inventory.get("fts", [])

                for ft in fts:
                    if ft.get("contract") == token_contract:
                        meta = ft.get("ft_meta", {})
                        return {
                            "name": meta.get("name", "Unknown"),
                            "symbol": meta.get("symbol", "UNKNOWN"),
                            "decimals": meta.get("decimals", 6),
                            "icon": meta.get("icon"),
                            "reference": meta.get("reference"),
                        }

            logger.warning(f"Could not get metadata for {token_contract} from API")
            return {
                "name": "Unknown",
                "symbol": "UNKNOWN",
                "decimals": 6,
                "icon": None,
                "reference": None,
            }

        except Exception as e:
            logger.error(
                f"Error getting token metadata from API for {token_contract}: {e}"
            )
            return {
                "name": "Unknown",
                "symbol": "UNKNOWN",
                "decimals": 6,
                "icon": None,
                "reference": None,
            }
