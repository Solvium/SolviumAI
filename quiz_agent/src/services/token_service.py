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
    """Robust token service using FastNear Premium RPC/API with NearBlocks fallback"""

    # Class-level caches shared across all instances (DEPRECATED - use MetadataCacheService)
    _class_metadata_cache = {}
    _class_inventory_cache = {}
    _cache_ttl = 300  # 5 minutes cache TTL (DEPRECATED)

    def __init__(self):
        # Use the correct NearBlocks API URL based on current network
        self.nearblocks_api_url = f"{Config.get_nearblocks_api_url()}/v1/account"
        # Use existing NEAR_WALLET_ADDRESS as main wallet
        self.main_wallet_address = Config.NEAR_WALLET_ADDRESS
        self.main_wallet_private_key = Config.NEAR_WALLET_PRIVATE_KEY

        # Legacy caches (kept for backward compatibility)
        self._metadata_cache = TokenService._class_metadata_cache
        self._inventory_cache = TokenService._class_inventory_cache

        # Log which network we're using
        current_network = Config.get_current_network()
        logger.info(
            f"TokenService initialized for {current_network} network using FastNear Premium"
        )

    def _is_cache_valid(self, cache_entry: Dict) -> bool:
        """Check if cache entry is still valid"""
        import time

        return time.time() - cache_entry.get("timestamp", 0) < TokenService._cache_ttl

    def _get_cached_metadata(self, token_contract: str) -> Optional[Dict]:
        """Get cached metadata if valid"""
        if token_contract in self._metadata_cache:
            cache_entry = self._metadata_cache[token_contract]
            if self._is_cache_valid(cache_entry):
                logger.info(f"Using cached metadata for {token_contract}")
                return cache_entry["data"]
            else:
                # Remove expired cache entry
                del self._metadata_cache[token_contract]
        return None

    def _cache_metadata(self, token_contract: str, metadata: Dict):
        """Cache metadata with timestamp"""
        import time

        self._metadata_cache[token_contract] = {
            "data": metadata,
            "timestamp": time.time(),
        }
        logger.info(f"Cached metadata for {token_contract}")

    def _get_cached_inventory(self, account_id: str) -> Optional[List[Dict]]:
        """Get cached inventory if valid"""
        if account_id in self._inventory_cache:
            cache_entry = self._inventory_cache[account_id]
            if self._is_cache_valid(cache_entry):
                logger.info(f"Using cached inventory for {account_id}")
                return cache_entry["data"]
            else:
                # Remove expired cache entry
                del self._inventory_cache[account_id]
        return None

    def _cache_inventory(self, account_id: str, inventory: List[Dict]):
        """Cache inventory with timestamp"""
        import time

        self._inventory_cache[account_id] = {
            "data": inventory,
            "timestamp": time.time(),
        }
        logger.info(f"Cached inventory for {account_id}")

    @classmethod
    def clear_cache(cls):
        """Clear all cached data"""
        cls._class_metadata_cache.clear()
        cls._class_inventory_cache.clear()
        logger.info("TokenService cache cleared")

    @classmethod
    def invalidate_account_inventory_cache(cls, account_id: str):
        """Invalidate inventory cache for a specific account"""
        if account_id in cls._class_inventory_cache:
            del cls._class_inventory_cache[account_id]
            logger.info(f"Invalidated inventory cache for account {account_id}")
        else:
            logger.debug(f"No inventory cache found for account {account_id}")

    @classmethod
    def invalidate_account_metadata_cache(cls, token_contract: str):
        """Invalidate metadata cache for a specific token contract"""
        if token_contract in cls._class_metadata_cache:
            del cls._class_metadata_cache[token_contract]
            logger.info(f"Invalidated metadata cache for token {token_contract}")
        else:
            logger.debug(f"No metadata cache found for token {token_contract}")

    @classmethod
    def get_cache_stats(cls):
        """Get cache statistics"""
        return {
            "metadata_cache_size": len(cls._class_metadata_cache),
            "inventory_cache_size": len(cls._class_inventory_cache),
            "cache_ttl": cls._cache_ttl,
        }

    @classmethod
    def is_account_inventory_cached(cls, account_id: str) -> bool:
        """Check if inventory is cached for a specific account"""
        return account_id in cls._class_inventory_cache

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
                            decimals = meta.get("decimals")
                            if decimals is None:
                                logger.error(
                                    f"Token {token_contract} metadata missing decimals field in inventory - this will cause incorrect transfers"
                                )
                                raise ValueError(
                                    f"Token {token_contract} metadata is missing decimals field"
                                )
                            logger.info(f"Got decimals from NearBlocks API: {decimals}")
                            return FtModel(contract_id=token_contract, decimal=decimals)

                # If inventory doesn't work, try to get contract info directly
                contract_url = f"{self.nearblocks_api_url}/{token_contract}"
                contract_response = requests.get(contract_url, timeout=10)
                if contract_response.status_code == 200:
                    contract_data = contract_response.json()
                    # Look for token metadata in contract data
                    if "ft_meta" in contract_data:
                        decimals = contract_data["ft_meta"].get("decimals")
                        if decimals is None:
                            logger.error(
                                f"Token {token_contract} metadata missing decimals field in contract API - this will cause incorrect transfers"
                            )
                            raise ValueError(
                                f"Token {token_contract} metadata is missing decimals field"
                            )
                        logger.info(f"Got decimals from contract API: {decimals}")
                        return FtModel(contract_id=token_contract, decimal=decimals)

            except Exception as api_error:
                logger.error(f"Error getting metadata from NearBlocks API: {api_error}")

            # Final fallback - fail rather than use wrong decimals
            logger.error(
                f"Failed to get token metadata for {token_contract} - cannot proceed with unknown decimals"
            )
            raise ValueError(
                f"Failed to retrieve token metadata for {token_contract} - cannot determine correct decimal places"
            )

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

    async def get_user_token_inventory(
        self, account_id: str, force_refresh: bool = False
    ) -> List[Dict]:
        """
        Get all tokens for a user using FastNear Premium API with NearBlocks fallback.

        Strategy:
        1. Try FastNear Premium API first (30s cache for balance, 24h cache for metadata)
        2. Fall back to NearBlocks API if FastNear fails
        3. Returns enriched token list with balance + metadata

        Args:
            account_id: NEAR account ID
            force_refresh: Force refresh cache (bypasses 30s cache)

        Returns:
            List of token dicts with balance and metadata
        """
        try:
            # Try FastNear Premium first
            from services.fastnear_service import get_fastnear_service

            fastnear = get_fastnear_service()
            tokens = await fastnear.get_enriched_token_inventory(
                account_id, use_cache=not force_refresh
            )

            if tokens:
                logger.info(
                    f"Successfully fetched {len(tokens)} tokens from FastNear for {account_id}"
                )
                return tokens
            else:
                logger.warning(
                    f"FastNear returned no tokens for {account_id}, trying NearBlocks fallback"
                )

        except Exception as e:
            logger.warning(
                f"FastNear failed for {account_id}, falling back to NearBlocks: {e}"
            )

        # Fall back to NearBlocks API (existing implementation)
        return await self._get_user_token_inventory_nearblocks(
            account_id, force_refresh
        )

    async def _get_user_token_inventory_nearblocks(
        self, account_id: str, force_refresh: bool = False
    ) -> List[Dict]:
        """
        Legacy NearBlocks API implementation (kept as fallback).

        Args:
            account_id: NEAR account ID
            force_refresh: Force refresh cache

        Returns:
            List of token dicts
        """
        try:
            # Check cache first (unless force refresh is requested)
            if not force_refresh:
                cached_inventory = self._get_cached_inventory(account_id)
                if cached_inventory is not None:
                    return cached_inventory

            # Add a small delay to avoid rate limiting
            import asyncio

            await asyncio.sleep(0.3)

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

                # Cache the result
                self._cache_inventory(account_id, tokens)
                return tokens
            else:
                logger.error(f"NearBlocks API error: {response.status_code}")
                return []

        except Exception as e:
            logger.error(f"Error getting user token inventory: {e}")
            return []

    async def get_token_balance(self, account: Account, token_contract: str) -> str:
        """
        Get token balance using FastNear Premium with NearBlocks fallback (30s cache).

        Args:
            account: NEAR Account object
            token_contract: Token contract address

        Returns:
            Formatted balance string (e.g., "1000.000000 TOKEN")
        """
        try:
            # Try FastNear Premium first
            from services.fastnear_service import get_fastnear_service

            fastnear = get_fastnear_service()

            # Get user's token inventory from FastNear (with 30s cache)
            tokens = await fastnear.get_enriched_token_inventory(account.account_id)

            logger.info(
                f"Found {len(tokens)} tokens in inventory for {account.account_id}"
            )

            # Find the specific token
            for token in tokens:
                logger.info(
                    f"Checking token: {token['contract_address']} vs {token_contract}"
                )
                if token["contract_address"] == token_contract:
                    balance_str = f"{token['balance']} {token['symbol']}"
                    logger.info(f"Found token balance from FastNear: {balance_str}")
                    return balance_str

            # If token not found in inventory, it means balance is 0
            # Get metadata for symbol
            logger.info(
                f"Token {token_contract} not found in inventory, getting metadata..."
            )
            metadata = await fastnear.fetch_token_metadata_rpc(token_contract)
            balance_str = f"0.000000 {metadata['symbol']}"
            logger.info(f"Returning zero balance: {balance_str}")
            return balance_str

        except Exception as e:
            logger.warning(
                f"FastNear failed for token balance, falling back to NearBlocks: {e}"
            )
            # Fall back to legacy NearBlocks method
            return await self._get_token_balance_nearblocks(account, token_contract)

    async def _get_token_balance_nearblocks(
        self, account: Account, token_contract: str
    ) -> str:
        """
        Legacy NearBlocks implementation for token balance (fallback).

        Args:
            account: NEAR Account object
            token_contract: Token contract address

        Returns:
            Formatted balance string
        """
        try:
            # Get user's token inventory from NearBlocks API
            tokens = await self.get_user_token_inventory(account.account_id)

            logger.info(
                f"Found {len(tokens)} tokens in inventory for {account.account_id}"
            )

            # Find the specific token
            for token in tokens:
                logger.info(
                    f"Checking token: {token['contract_address']} vs {token_contract}"
                )
                if token["contract_address"] == token_contract:
                    balance_str = f"{token['balance']} {token['symbol']}"
                    logger.info(f"Found token balance: {balance_str}")
                    return balance_str

            # If token not found in inventory, it means balance is 0
            # Get metadata for symbol
            logger.info(
                f"Token {token_contract} not found in inventory, getting metadata..."
            )
            metadata = await self.get_token_metadata_from_api(token_contract)
            balance_str = f"0.000000 {metadata['symbol']}"
            logger.info(f"Returning zero balance: {balance_str}")
            return balance_str

        except Exception as e:
            logger.error(f"Error getting token balance from NearBlocks API: {e}")
            # Fallback to py-near method
            try:
                logger.info(f"Falling back to py-near for token balance...")
                ft_model = await self._get_ft_model(account, token_contract)
                balance = await account.ft.get_ft_balance(
                    ft_model, account_id=account.account_id
                )
                metadata = await self._get_metadata_safe(account, ft_model)
                return f"{balance:.6f} {metadata.symbol}"
            except Exception as py_near_error:
                logger.error(
                    f"Error getting token balance from py-near fallback: {py_near_error}"
                )
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
        """Transfer tokens using py-near FTS with NearBlocks API for metadata"""
        try:
            # Get metadata using NearBlocks API with inventory fallback (more reliable)
            metadata = await self.get_token_metadata(account, token_contract)

            # Create FtModel with correct decimals from NearBlocks API
            ft_model = FtModel(contract_id=token_contract, decimal=metadata["decimals"])
            logger.info(
                f"Created FtModel with contract_id={token_contract}, decimal={metadata['decimals']}"
            )

            # Log the transfer details for debugging
            logger.info(
                f"Transferring {amount} tokens with {metadata['decimals']} decimals for token {token_contract}"
            )

            # Manually convert amount to the smallest unit (considering decimals)
            # For example: 200 tokens with 24 decimals = 200 * 10^24
            # Use string conversion to avoid floating point precision issues
            amount_str = str(amount)
            if "." in amount_str:
                integer_part, decimal_part = amount_str.split(".")
                # Pad decimal part to match token decimals
                decimal_part = decimal_part.ljust(metadata["decimals"], "0")[
                    : metadata["decimals"]
                ]
                amount_in_smallest_unit = int(integer_part + decimal_part)
            else:
                amount_in_smallest_unit = int(amount_str) * (10 ** metadata["decimals"])

            logger.info(
                f"Converted {amount} tokens to {amount_in_smallest_unit} smallest units (using {metadata['decimals']} decimals)"
            )

            # Additional validation logging
            if metadata["decimals"] != 24:
                logger.warning(
                    f"Token {token_contract} has {metadata['decimals']} decimals instead of expected 24 - verify this is correct"
                )

            result = await account.ft.transfer(
                ft_model,
                recipient_account_id,
                amount,  # Let py-near handle the decimal conversion
                force_register=force_register,
                nowait=True,  # Return transaction hash immediately
            )

            return {
                "success": True,
                "transaction_hash": result,
                "amount": amount,
                "amount_in_smallest_unit": amount_in_smallest_unit,
                "decimals": metadata["decimals"],
                "message": f"Successfully transferred {amount} {metadata['symbol']} tokens",
            }

        except Exception as e:
            logger.error(f"Error transferring tokens: {e}")
            return {
                "success": False,
                "error": str(e),
                "message": "Token transfer failed",
            }

    async def get_token_metadata(self, account: Account, token_contract: str) -> Dict:
        """Get token metadata using NearBlocks API (more reliable than py-near)"""
        try:
            # Use NearBlocks API for metadata - it's more reliable and doesn't have validation issues
            metadata = await self.get_token_metadata_from_api(token_contract)
            logger.info(
                f"Got token metadata from NearBlocks API for {token_contract}: {metadata.get('symbol', 'UNKNOWN')}"
            )

            # If we got UNKNOWN symbol, try to get it from user's inventory as fallback
            if metadata.get("symbol") == "UNKNOWN":
                logger.info(
                    f"Got UNKNOWN symbol for {token_contract}, trying to get from user inventory..."
                )
                try:
                    tokens = await self.get_user_token_inventory(account.account_id)
                    for token in tokens:
                        if token["contract_address"] == token_contract:
                            logger.info(
                                f"Found token in inventory: {token['symbol']} with {token['decimals']} decimals"
                            )
                            metadata["symbol"] = token["symbol"]
                            metadata["name"] = token["name"]
                            metadata["decimals"] = token[
                                "decimals"
                            ]  # Also update decimals from inventory
                            break
                except Exception as inventory_error:
                    logger.warning(
                        f"Could not get token from inventory: {inventory_error}"
                    )

            return metadata

        except Exception as e:
            logger.error(
                f"Error getting token metadata from NearBlocks API for {token_contract}: {e}"
            )
            # Fallback to py-near if API fails
            try:
                logger.info(f"Falling back to py-near for {token_contract}...")
                ft_model = await self._get_ft_model(account, token_contract)
                metadata = await self._get_metadata_safe(account, ft_model)

                fallback_metadata = {
                    "name": metadata.name,
                    "symbol": metadata.symbol,
                    "decimals": metadata.decimals,
                    "icon": metadata.icon,
                    "reference": metadata.reference,
                }
                logger.info(
                    f"Got token metadata from py-near fallback for {token_contract}: {fallback_metadata.get('symbol', 'UNKNOWN')}"
                )
                return fallback_metadata
            except Exception as py_near_error:
                logger.error(
                    f"Error getting token metadata from py-near fallback for {token_contract}: {py_near_error}"
                )
                return {
                    "name": "Unknown",
                    "symbol": "UNKNOWN",
                    "decimals": 6,
                    "icon": None,
                    "reference": None,
                }

    async def get_supported_tokens_for_user(
        self, account_id: str, force_refresh: bool = False
    ) -> List[Dict]:
        """Get tokens that user actually has (non-zero balance)"""
        try:
            tokens = await self.get_user_token_inventory(
                account_id, force_refresh=force_refresh
            )
            # Filter tokens with non-zero balance
            available_tokens = [
                token for token in tokens if float(token["balance"]) > 0
            ]
            return available_tokens
        except Exception as e:
            logger.error(f"Error getting supported tokens for user: {e}")
            return []

    async def get_token_metadata_from_api(self, token_contract: str) -> Dict:
        """
        Get token metadata using FastNear Premium with NearBlocks fallback.

        Updated to use FastNear as primary source with 24h caching.
        """
        try:
            # Try FastNear Premium first
            from services.fastnear_service import get_fastnear_service

            fastnear = get_fastnear_service()
            metadata = await fastnear.fetch_token_metadata_rpc(
                token_contract, use_cache=True
            )

            logger.info(
                f"Got token metadata from FastNear for {token_contract}: {metadata.get('symbol', 'UNKNOWN')}"
            )
            return metadata

        except Exception as fastnear_error:
            logger.warning(
                f"FastNear metadata fetch failed for {token_contract}, falling back to NearBlocks: {fastnear_error}"
            )

            # Fall back to NearBlocks API
            return await self._get_token_metadata_nearblocks(token_contract)

    async def _get_token_metadata_nearblocks(self, token_contract: str) -> Dict:
        """
        Legacy NearBlocks API implementation for token metadata (fallback only).
        """
        try:
            # Check cache first
            cached_metadata = self._get_cached_metadata(token_contract)
            if cached_metadata is not None:
                logger.info(
                    f"Returning cached metadata for {token_contract}: {cached_metadata.get('symbol', 'UNKNOWN')}"
                )
                return cached_metadata

            logger.info(f"Cache miss for {token_contract}, fetching from API...")

            # Add a small delay to avoid rate limiting
            import asyncio

            await asyncio.sleep(0.5)

            # Try to get contract metadata directly
            contract_url = f"{self.nearblocks_api_url}/{token_contract}"
            logger.info(f"Fetching metadata from: {contract_url}")
            response = requests.get(contract_url, timeout=15)

            if response.status_code == 200:
                data = response.json()
                logger.info(
                    f"API response for {token_contract}: {list(data.keys()) if isinstance(data, dict) else 'Not a dict'}"
                )
                if "ft_meta" in data:
                    meta = data["ft_meta"]
                    logger.info(f"Found ft_meta for {token_contract}: {meta}")
                    # Ensure we have decimals - fail if missing rather than using wrong default
                    decimals = meta.get("decimals")
                    if decimals is None:
                        logger.error(
                            f"Token {token_contract} metadata missing decimals field - this will cause incorrect transfers"
                        )
                        raise ValueError(
                            f"Token {token_contract} metadata is missing decimals field"
                        )

                    metadata = {
                        "name": meta.get("name", "Unknown"),
                        "symbol": meta.get("symbol", "UNKNOWN"),
                        "decimals": decimals,
                        "icon": meta.get("icon"),
                        "reference": meta.get("reference"),
                    }
                    logger.info(
                        f"Successfully parsed metadata for {token_contract}: {metadata}"
                    )
                    # Cache the result
                    self._cache_metadata(token_contract, metadata)
                    return metadata
                else:
                    logger.warning(
                        f"No ft_meta found in API response for {token_contract}"
                    )
            elif response.status_code == 429:
                logger.warning(
                    f"NearBlocks API rate limited (429) for {token_contract}, waiting and retrying..."
                )
                # Wait longer and retry once
                await asyncio.sleep(3)
                response = requests.get(contract_url, timeout=15)
                if response.status_code == 200:
                    data = response.json()
                    if "ft_meta" in data:
                        meta = data["ft_meta"]
                        # Ensure we have decimals - fail if missing rather than using wrong default
                        decimals = meta.get("decimals")
                        if decimals is None:
                            logger.error(
                                f"Token {token_contract} metadata missing decimals field in retry - this will cause incorrect transfers"
                            )
                            raise ValueError(
                                f"Token {token_contract} metadata is missing decimals field"
                            )

                        metadata = {
                            "name": meta.get("name", "Unknown"),
                            "symbol": meta.get("symbol", "UNKNOWN"),
                            "decimals": decimals,
                            "icon": meta.get("icon"),
                            "reference": meta.get("reference"),
                        }
                        # Cache the result
                        self._cache_metadata(token_contract, metadata)
                        return metadata

            # If direct contract doesn't work, try inventory approach
            inventory_url = f"{self.nearblocks_api_url}/{token_contract}/inventory"
            inventory_response = requests.get(inventory_url, timeout=15)

            if inventory_response.status_code == 200:
                inventory_data = inventory_response.json()
                inventory = inventory_data.get("inventory", {})
                fts = inventory.get("fts", [])

                for ft in fts:
                    if ft.get("contract") == token_contract:
                        meta = ft.get("ft_meta", {})
                        # Ensure we have decimals - fail if missing rather than using wrong default
                        decimals = meta.get("decimals")
                        if decimals is None:
                            logger.error(
                                f"Token {token_contract} metadata missing decimals field in inventory - this will cause incorrect transfers"
                            )
                            raise ValueError(
                                f"Token {token_contract} metadata is missing decimals field"
                            )

                        metadata = {
                            "name": meta.get("name", "Unknown"),
                            "symbol": meta.get("symbol", "UNKNOWN"),
                            "decimals": decimals,
                            "icon": meta.get("icon"),
                            "reference": meta.get("reference"),
                        }
                        # Cache the result
                        self._cache_metadata(token_contract, metadata)
                        return metadata
            elif inventory_response.status_code == 429:
                logger.warning(
                    f"NearBlocks API rate limited (429) for inventory, using fallback"
                )

            # Only log warning and return fallback if we truly couldn't get metadata
            logger.warning(
                f"Could not get metadata for {token_contract} from API - all methods failed"
            )
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
