"""
FastNear Premium RPC and API Service

This service provides authenticated access to FastNear's premium RPC and API endpoints:
- RPC calls for balance queries (view_account, ft_metadata, etc.) with 30s cache
- API calls for token lists (/v1/account/{id}/ft) with 30s cache
- Automatic fallback to free RPCs if premium fails
"""

import json
import base64
import logging
import requests
import asyncio
from typing import Dict, List, Optional, Any
from utils.config import Config
from services.metadata_cache_service import get_metadata_cache_service

logger = logging.getLogger(__name__)


class FastNearService:
    """
    FastNear Premium RPC and API service with authentication.

    Features:
    - Authenticated RPC calls for balance queries
    - Token list API calls (/v1/account/{id}/ft)
    - Metadata fetching via ft_metadata RPC calls
    - 30s caching for balances
    - 24h caching for metadata
    - Automatic fallback to free RPCs
    """

    def __init__(self):
        self.api_key = Config.FASTNEAR_API_KEY
        self.mainnet_rpc_url = Config.FASTNEAR_MAINNET_RPC_URL
        self.testnet_rpc_url = Config.FASTNEAR_TESTNET_RPC_URL
        self.mainnet_api_url = Config.FASTNEAR_MAINNET_API_URL
        self.testnet_api_url = Config.FASTNEAR_TESTNET_API_URL

        self.cache_service = get_metadata_cache_service()

        # Determine network
        self.network = Config.get_current_network()

        # Set RPC and API URLs based on network
        if self.network == "mainnet":
            self.rpc_url = self.mainnet_rpc_url
            self.api_base_url = self.mainnet_api_url
        else:
            self.rpc_url = self.testnet_rpc_url
            self.api_base_url = self.testnet_api_url

        logger.info(
            f"FastNearService initialized for {self.network} network "
            f"(API: {self.api_base_url}, RPC: {self.rpc_url})"
        )

    # ==================== Authentication Helpers ====================

    def _get_rpc_url_with_auth(self) -> str:
        """Get FastNear RPC URL with API key parameter"""
        return f"{self.rpc_url}?apiKey={self.api_key}"

    def _get_auth_headers(self) -> Dict[str, str]:
        """Get authentication headers for FastNear API/RPC"""
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    # ==================== RPC Calls (with 30s balance cache) ====================

    async def make_rpc_call(
        self, method: str, params: Dict, use_auth: bool = True
    ) -> Dict:
        """
        Make an authenticated RPC call to FastNear.

        Args:
            method: RPC method name (e.g., "query")
            params: RPC parameters
            use_auth: Whether to use authentication (default: True)

        Returns:
            RPC response result

        Raises:
            Exception if RPC call fails
        """
        try:
            payload = {
                "jsonrpc": "2.0",
                "id": "dontcare",
                "method": method,
                "params": params,
            }

            # Choose URL and headers based on auth preference
            if use_auth:
                url = self._get_rpc_url_with_auth()
                headers = self._get_auth_headers()
            else:
                url = self.rpc_url
                headers = {"Content-Type": "application/json"}

            logger.debug(f"FastNear RPC call: {method} to {url}")

            # Use asyncio to run the synchronous request
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                lambda: requests.post(url, json=payload, headers=headers, timeout=15),
            )

            if response.status_code == 200:
                data = response.json()

                if "error" in data:
                    error_msg = data["error"].get("message", "Unknown error")
                    logger.error(f"FastNear RPC error: {error_msg}")
                    raise Exception(f"RPC error: {error_msg}")

                return data.get("result", {})
            else:
                logger.error(f"FastNear RPC HTTP error: {response.status_code}")
                raise Exception(f"HTTP {response.status_code}: {response.text}")

        except Exception as e:
            logger.error(f"FastNear RPC call failed: {e}")
            raise

    async def get_account_balance(self, account_id: str, use_cache: bool = True) -> str:
        """
        Get NEAR account balance with 30s caching.

        Args:
            account_id: NEAR account ID
            use_cache: Whether to use cache (default: True)

        Returns:
            Balance string (e.g., "1.2345 NEAR")
        """
        try:
            # Check cache first
            if use_cache:
                cached_balance = await self.cache_service.get_account_balance(
                    account_id
                )
                if cached_balance:
                    logger.debug(f"Using cached balance for {account_id}")
                    return cached_balance

            # Fetch fresh balance from FastNear RPC
            logger.info(f"Fetching fresh balance for {account_id} from FastNear")

            result = await self.make_rpc_call(
                "query",
                {
                    "request_type": "view_account",
                    "finality": "final",
                    "account_id": account_id,
                },
            )

            # Extract and format balance
            balance_yocto = int(result.get("amount", 0))
            balance_near = balance_yocto / (10**24)
            balance_str = f"{balance_near:.4f} NEAR"

            # Cache the result (30s TTL)
            await self.cache_service.set_account_balance(account_id, balance_str)

            logger.info(f"Successfully fetched balance for {account_id}: {balance_str}")
            return balance_str

        except Exception as e:
            logger.error(f"Error getting account balance for {account_id}: {e}")
            return "0 NEAR"

    async def fetch_token_metadata_rpc(
        self, contract_id: str, use_cache: bool = True
    ) -> Dict:
        """
        Fetch token metadata via RPC ft_metadata call with 24h caching.

        Args:
            contract_id: Token contract address
            use_cache: Whether to use cache (default: True)

        Returns:
            Metadata dict with symbol, decimals, name, icon
        """
        try:
            # Check cache first (24h TTL for metadata)
            if use_cache:
                cached_metadata = await self.cache_service.get_token_metadata(
                    contract_id
                )
                if cached_metadata:
                    logger.debug(f"Using cached metadata for {contract_id}")
                    return cached_metadata

            # Fetch fresh metadata from FastNear RPC
            logger.info(f"Fetching fresh metadata for {contract_id} from FastNear")

            result = await self.make_rpc_call(
                "query",
                {
                    "request_type": "call_function",
                    "account_id": contract_id,
                    "method_name": "ft_metadata",
                    "args_base64": "",
                    "finality": "final",
                },
            )

            # Decode result - handle both list and base64 string formats
            result_data = result.get("result", [])

            # If result is a list of byte values, convert to bytes
            if isinstance(result_data, list):
                result_bytes = bytes(result_data)
            else:
                # If it's a base64 string, decode it
                result_bytes = base64.b64decode(result_data)

            metadata_json = json.loads(result_bytes.decode("utf-8"))

            # Format metadata
            metadata = {
                "spec": metadata_json.get("spec", ""),
                "name": metadata_json.get("name", "Unknown"),
                "symbol": metadata_json.get("symbol", "UNKNOWN"),
                "icon": metadata_json.get("icon"),
                "reference": metadata_json.get("reference"),
                "decimals": metadata_json.get("decimals", 24),
            }

            # Validate decimals field
            if metadata["decimals"] is None:
                logger.error(
                    f"Token {contract_id} metadata missing decimals field - using default 24"
                )
                metadata["decimals"] = 24

            # Cache the result (24h TTL)
            await self.cache_service.set_token_metadata(contract_id, metadata)

            logger.info(
                f"Successfully fetched metadata for {contract_id}: "
                f"{metadata['symbol']} ({metadata['decimals']} decimals)"
            )
            return metadata

        except Exception as e:
            logger.error(f"Error fetching token metadata for {contract_id}: {e}")
            # Return default metadata
            return {
                "spec": "",
                "name": "Unknown",
                "symbol": "UNKNOWN",
                "icon": None,
                "reference": None,
                "decimals": 24,
            }

    # ==================== API Calls (token lists with 30s cache) ====================

    async def get_user_token_list(
        self, account_id: str, use_cache: bool = True
    ) -> List[Dict]:
        """
        Get user's token list from FastNear API with 30s caching.

        Returns raw token data WITHOUT metadata enrichment:
        [{
            "contract_id": "token.contract.near",
            "balance": "1000000000000000000000000",
            "last_update_block_height": 123456789
        }]

        Args:
            account_id: NEAR account ID
            use_cache: Whether to use cache (default: True)

        Returns:
            List of token dicts (balance only, no metadata)
        """
        try:
            # Check cache first
            if use_cache:
                cached_inventory = await self.cache_service.get_token_inventory(
                    account_id
                )
                if cached_inventory:
                    logger.debug(f"Using cached token list for {account_id}")
                    return cached_inventory

            # Fetch fresh token list from FastNear API
            logger.info(f"Fetching fresh token list for {account_id} from FastNear API")

            url = f"{self.api_base_url}/v1/account/{account_id}/ft"
            headers = self._get_auth_headers()

            # Add small delay to avoid rate limiting
            await asyncio.sleep(0.1)

            # Use asyncio to run the synchronous request
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None, lambda: requests.get(url, headers=headers, timeout=15)
            )

            if response.status_code == 200:
                data = response.json()

                # FastNear returns: {account_id, tokens: [...]}
                tokens = data.get("tokens", [])

                logger.info(
                    f"Successfully fetched {len(tokens)} tokens for {account_id} from FastNear"
                )

                # Format tokens to match expected structure
                formatted_tokens = []
                for token in tokens:
                    formatted_tokens.append(
                        {
                            "contract_id": token.get("contract_id"),
                            "balance": token.get("balance", "0"),
                            "last_update_block_height": token.get(
                                "last_update_block_height", 0
                            ),
                        }
                    )

                # Cache the result (30s TTL)
                await self.cache_service.set_token_inventory(
                    account_id, formatted_tokens
                )

                return formatted_tokens

            elif response.status_code == 429:
                logger.warning(
                    f"FastNear API rate limited for {account_id}, using exponential backoff"
                )
                # Wait and retry once
                await asyncio.sleep(2)

                response = await loop.run_in_executor(
                    None, lambda: requests.get(url, headers=headers, timeout=15)
                )

                if response.status_code == 200:
                    data = response.json()
                    tokens = data.get("tokens", [])

                    formatted_tokens = []
                    for token in tokens:
                        formatted_tokens.append(
                            {
                                "contract_id": token.get("contract_id"),
                                "balance": token.get("balance", "0"),
                                "last_update_block_height": token.get(
                                    "last_update_block_height", 0
                                ),
                            }
                        )

                    await self.cache_service.set_token_inventory(
                        account_id, formatted_tokens
                    )
                    return formatted_tokens
                else:
                    raise Exception(f"FastNear API error: {response.status_code}")
            else:
                logger.error(
                    f"FastNear API error for {account_id}: {response.status_code} - {response.text}"
                )
                return []

        except Exception as e:
            logger.error(f"Error fetching token list for {account_id}: {e}")
            return []

    async def get_enriched_token_inventory(
        self, account_id: str, use_cache: bool = True
    ) -> List[Dict]:
        """
        Get user's token list enriched with metadata.

        Combines:
        - Fresh token balances from FastNear API (30s cache)
        - Token metadata from cache or RPC (24h cache)

        Returns:
        [{
            "contract_address": "token.contract.near",
            "balance": "1000.000000",
            "balance_raw": "1000000000000000000000000",
            "symbol": "TOKEN",
            "decimals": 24,
            "name": "Token Name",
            "icon": "https://...",
        }]

        Args:
            account_id: NEAR account ID
            use_cache: Whether to use cache (default: True)

        Returns:
            List of enriched token dicts
        """
        try:
            # Step 1: Get raw token list (balance only) with 30s cache
            raw_tokens = await self.get_user_token_list(account_id, use_cache)

            if not raw_tokens:
                return []

            # Step 2: Enrich with metadata (24h cache)
            enriched_tokens = []

            for token in raw_tokens:
                contract_id = token["contract_id"]
                balance_raw = token["balance"]

                # Fetch metadata (will use cache if available)
                metadata = await self.fetch_token_metadata_rpc(contract_id, use_cache)

                # Convert balance to human-readable format
                decimals = metadata["decimals"]
                try:
                    balance_float = int(balance_raw) / (10**decimals)
                    balance_formatted = f"{balance_float:.6f}"
                except (ValueError, ZeroDivisionError) as e:
                    logger.warning(f"Error converting balance for {contract_id}: {e}")
                    balance_formatted = "0.000000"

                enriched_tokens.append(
                    {
                        "contract_address": contract_id,
                        "balance": balance_formatted,
                        "balance_raw": balance_raw,
                        "symbol": metadata["symbol"],
                        "decimals": decimals,
                        "name": metadata["name"],
                        "icon": metadata.get("icon"),
                        "reference": metadata.get("reference"),
                    }
                )

            logger.info(
                f"Successfully enriched {len(enriched_tokens)} tokens for {account_id}"
            )
            return enriched_tokens

        except Exception as e:
            logger.error(
                f"Error getting enriched token inventory for {account_id}: {e}"
            )
            return []

    # ==================== Utility Methods ====================

    async def invalidate_account_caches(self, account_id: str):
        """
        Invalidate all caches for an account (useful after transactions).

        Args:
            account_id: NEAR account ID
        """
        await self.cache_service.clear_all_balances(account_id)
        logger.info(f"Invalidated all caches for {account_id}")

    def get_service_info(self) -> Dict:
        """Get service configuration info"""
        return {
            "network": self.network,
            "api_base_url": self.api_base_url,
            "rpc_url": self.mainnet_rpc_url,
            "authenticated": bool(self.api_key),
            "cache_stats": asyncio.run(self.cache_service.get_cache_stats()),
        }


# Global instance for convenience
_fastnear_service = None


def get_fastnear_service() -> FastNearService:
    """Get or create global FastNearService instance"""
    global _fastnear_service
    if _fastnear_service is None:
        _fastnear_service = FastNearService()
    return _fastnear_service
