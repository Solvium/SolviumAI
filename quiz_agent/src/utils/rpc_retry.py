import asyncio
import time
import logging
from typing import Any, Callable, Optional, Dict, List
from dataclasses import dataclass
from enum import Enum
import requests
import httpx
from utils.config import Config

logger = logging.getLogger(__name__)


class RPCErrorType(Enum):
    """Types of RPC errors for different handling strategies"""

    TIMEOUT = "timeout"
    CONNECTION_ERROR = "connection_error"
    RATE_LIMIT = "rate_limit"
    INVALID_REQUEST = "invalid_request"
    ACCOUNT_NOT_FOUND = "account_not_found"
    INSUFFICIENT_BALANCE = "insufficient_balance"
    UNKNOWN = "unknown"


@dataclass
class RPCError:
    """Structured RPC error information"""

    error_type: RPCErrorType
    message: str
    retryable: bool
    original_exception: Optional[Exception] = None


class CircuitBreaker:
    """Circuit breaker pattern for RPC calls"""

    def __init__(self, failure_threshold: int = None, recovery_timeout: int = None):
        self.failure_threshold = (
            failure_threshold or Config.CIRCUIT_BREAKER_FAILURE_THRESHOLD
        )
        self.recovery_timeout = (
            recovery_timeout or Config.CIRCUIT_BREAKER_RECOVERY_TIMEOUT
        )
        self.failure_count = 0
        self.last_failure_time = None
        self.state = "CLOSED"  # CLOSED, OPEN, HALF_OPEN

    def can_execute(self) -> bool:
        """Check if the circuit breaker allows execution"""
        if self.state == "CLOSED":
            return True
        elif self.state == "OPEN":
            if time.time() - self.last_failure_time > self.recovery_timeout:
                self.state = "HALF_OPEN"
                return True
            return False
        else:  # HALF_OPEN
            return True

    def record_success(self):
        """Record a successful call"""
        self.failure_count = 0
        self.state = "CLOSED"

    def record_failure(self):
        """Record a failed call"""
        self.failure_count += 1
        self.last_failure_time = time.time()

        if self.failure_count >= self.failure_threshold:
            self.state = "OPEN"
            logger.warning(
                f"Circuit breaker opened after {self.failure_count} failures"
            )


class RPCRetryHandler:
    """Handles RPC retries with exponential backoff, circuit breaker, and endpoint fallback"""

    def __init__(self):
        self.circuit_breakers: Dict[str, CircuitBreaker] = {}
        self.current_endpoint_index: Dict[str, int] = (
            {}
        )  # Track current endpoint for each network

    def _get_circuit_breaker(self, endpoint: str) -> CircuitBreaker:
        """Get or create circuit breaker for an endpoint"""
        if endpoint not in self.circuit_breakers:
            self.circuit_breakers[endpoint] = CircuitBreaker()
        return self.circuit_breakers[endpoint]

    def _get_next_endpoint(self, network: str, endpoints: List[str]) -> str:
        """Get the next available endpoint for a network"""
        if network not in self.current_endpoint_index:
            self.current_endpoint_index[network] = 0

        current_index = self.current_endpoint_index[network]
        if current_index >= len(endpoints):
            # Reset to first endpoint if we've tried all
            self.current_endpoint_index[network] = 0
            current_index = 0

        return endpoints[current_index]

    def _switch_to_next_endpoint(
        self, network: str, endpoints: List[str]
    ) -> Optional[str]:
        """Switch to the next endpoint for a network"""
        if network not in self.current_endpoint_index:
            self.current_endpoint_index[network] = 0

        self.current_endpoint_index[network] += 1

        if self.current_endpoint_index[network] >= len(endpoints):
            # All endpoints exhausted
            return None

        return endpoints[self.current_endpoint_index[network]]

    def _is_endpoint_available(self, endpoint: str) -> bool:
        """Check if an endpoint is available (circuit breaker not open)"""
        circuit_breaker = self._get_circuit_breaker(endpoint)
        return circuit_breaker.can_execute()

    def reset_circuit_breaker(self, endpoint: str) -> bool:
        """Reset a specific circuit breaker to CLOSED state"""
        if endpoint in self.circuit_breakers:
            circuit_breaker = self.circuit_breakers[endpoint]
            circuit_breaker.state = "CLOSED"
            circuit_breaker.failure_count = 0
            circuit_breaker.last_failure_time = None
            logger.info(f"Circuit breaker reset for endpoint: {endpoint}")
            return True
        return False

    def reset_all_circuit_breakers(self) -> int:
        """Reset all circuit breakers to CLOSED state"""
        reset_count = 0
        for endpoint, circuit_breaker in self.circuit_breakers.items():
            circuit_breaker.state = "CLOSED"
            circuit_breaker.failure_count = 0
            circuit_breaker.last_failure_time = None
            reset_count += 1
        logger.info(f"Reset {reset_count} circuit breakers")
        return reset_count

    def get_circuit_breaker_status(self, endpoint: str = None) -> dict:
        """Get circuit breaker status for a specific endpoint or all endpoints"""
        if endpoint:
            if endpoint in self.circuit_breakers:
                cb = self.circuit_breakers[endpoint]
                return {
                    "endpoint": endpoint,
                    "state": cb.state,
                    "failure_count": cb.failure_count,
                    "last_failure_time": cb.last_failure_time,
                    "failure_threshold": cb.failure_threshold,
                    "recovery_timeout": cb.recovery_timeout,
                }
            return None
        else:
            return {
                endpoint: {
                    "state": cb.state,
                    "failure_count": cb.failure_count,
                    "last_failure_time": cb.last_failure_time,
                    "failure_threshold": cb.failure_threshold,
                    "recovery_timeout": cb.recovery_timeout,
                }
                for endpoint, cb in self.circuit_breakers.items()
            }

    def _classify_error(self, exception: Exception) -> RPCError:
        """Classify an exception into an RPC error type"""
        error_message = str(exception).lower()

        if isinstance(
            exception,
            (requests.exceptions.Timeout, httpx.TimeoutException, asyncio.TimeoutError),
        ):
            return RPCError(RPCErrorType.TIMEOUT, str(exception), True, exception)
        elif isinstance(
            exception, (requests.exceptions.ConnectionError, httpx.ConnectError)
        ):
            return RPCError(
                RPCErrorType.CONNECTION_ERROR, str(exception), True, exception
            )
        elif "rate limit" in error_message or "too many requests" in error_message:
            return RPCError(RPCErrorType.RATE_LIMIT, str(exception), True, exception)
        elif "account not found" in error_message or "does not exist" in error_message:
            return RPCError(
                RPCErrorType.ACCOUNT_NOT_FOUND, str(exception), False, exception
            )
        elif (
            "insufficient balance" in error_message
            or "not enough balance" in error_message
        ):
            return RPCError(
                RPCErrorType.INSUFFICIENT_BALANCE, str(exception), False, exception
            )
        else:
            return RPCError(RPCErrorType.UNKNOWN, str(exception), True, exception)

    def _calculate_delay(self, attempt: int) -> float:
        """Calculate exponential backoff delay"""
        delay = Config.RPC_RETRY_DELAY * (Config.RPC_BACKOFF_MULTIPLIER**attempt)
        return min(delay, Config.RPC_MAX_RETRY_DELAY)

    async def execute_with_retry(
        self, func: Callable, endpoint: str, max_retries: int = None, *args, **kwargs
    ) -> Any:
        """
        Execute a function with retry logic and circuit breaker

        Args:
            func: The function to execute
            endpoint: RPC endpoint for circuit breaker tracking
            max_retries: Maximum number of retries (defaults to config)
            *args, **kwargs: Arguments to pass to the function

        Returns:
            The result of the function call

        Raises:
            Exception: If all retries fail or circuit breaker is open
        """
        max_retries = max_retries or Config.RPC_MAX_RETRIES
        circuit_breaker = self._get_circuit_breaker(endpoint)

        # Check circuit breaker
        if not circuit_breaker.can_execute():
            raise Exception(f"Circuit breaker is OPEN for endpoint {endpoint}")

        last_exception = None

        for attempt in range(max_retries + 1):
            try:
                result = await func(*args, **kwargs)
                circuit_breaker.record_success()
                return result

            except Exception as e:
                last_exception = e
                rpc_error = self._classify_error(e)

                logger.warning(
                    f"RPC call failed (attempt {attempt + 1}/{max_retries + 1}): "
                    f"{rpc_error.error_type.value} - {rpc_error.message}"
                )

                # Don't retry non-retryable errors
                if not rpc_error.retryable:
                    circuit_breaker.record_failure()
                    raise e

                # Don't retry on last attempt
                if attempt == max_retries:
                    circuit_breaker.record_failure()
                    break

                # Calculate delay and wait
                delay = self._calculate_delay(attempt)
                logger.info(f"Retrying in {delay:.2f} seconds...")
                await asyncio.sleep(delay)

        # All retries failed
        circuit_breaker.record_failure()
        raise last_exception

    async def execute_with_endpoint_fallback(
        self,
        func: Callable,
        network: str,
        endpoints: List[str],
        max_retries_per_endpoint: int = None,
        *args,
        **kwargs,
    ) -> Any:
        """
        Execute a function with automatic endpoint fallback

        Args:
            func: The function to execute (should accept endpoint as first argument)
            network: Network type (e.g., 'mainnet', 'testnet')
            endpoints: List of RPC endpoints to try
            max_retries_per_endpoint: Max retries per endpoint (defaults to config)
            *args, **kwargs: Additional arguments to pass to the function

        Returns:
            The result of the function call

        Raises:
            Exception: If all endpoints and retries fail
        """
        max_retries_per_endpoint = max_retries_per_endpoint or Config.RPC_MAX_RETRIES
        last_exception = None

        # Try each endpoint
        for endpoint_index, endpoint in enumerate(endpoints):
            # Skip if circuit breaker is open
            if not self._is_endpoint_available(endpoint):
                logger.warning(
                    f"Skipping endpoint {endpoint} - circuit breaker is open"
                )
                continue

            logger.info(
                f"Trying endpoint {endpoint_index + 1}/{len(endpoints)}: {endpoint}"
            )

            try:
                # Try this endpoint with retries
                result = await self.execute_with_retry(
                    func, endpoint, max_retries_per_endpoint, endpoint, *args, **kwargs
                )
                logger.info(f"Success with endpoint: {endpoint}")
                return result

            except Exception as e:
                last_exception = e
                logger.warning(f"Endpoint {endpoint} failed: {str(e)}")

                # Mark this endpoint as failed in circuit breaker
                circuit_breaker = self._get_circuit_breaker(endpoint)
                circuit_breaker.record_failure()

                # Continue to next endpoint
                continue

        # All endpoints failed
        logger.error(f"All {len(endpoints)} endpoints failed for network {network}")
        if last_exception:
            raise last_exception
        else:
            raise Exception(f"No available endpoints for network {network}")


# Global instance
rpc_retry_handler = RPCRetryHandler()


def get_rpc_endpoints(network: str) -> List[str]:
    """Get RPC endpoints for a specific network"""
    if network.lower() == "mainnet":
        return Config.NEAR_MAINNET_RPC_ENDPOINTS
    elif network.lower() == "testnet":
        return Config.NEAR_TESTNET_RPC_ENDPOINTS
    else:
        # Default to mainnet
        return Config.NEAR_MAINNET_RPC_ENDPOINTS


async def execute_with_rpc_fallback(
    func: Callable, network: str, max_retries_per_endpoint: int = None, *args, **kwargs
) -> Any:
    """
    Execute a function with automatic RPC endpoint fallback

    Args:
        func: The function to execute (should accept endpoint as first argument)
        network: Network type ('mainnet' or 'testnet')
        max_retries_per_endpoint: Max retries per endpoint
        *args, **kwargs: Additional arguments to pass to the function

    Returns:
        The result of the function call
    """
    endpoints = get_rpc_endpoints(network)
    return await rpc_retry_handler.execute_with_endpoint_fallback(
        func, network, endpoints, max_retries_per_endpoint, *args, **kwargs
    )


async def rpc_call_with_retry(
    func: Callable, endpoint: str, max_retries: int = None, *args, **kwargs
) -> Any:
    """
    Convenience function for RPC calls with retry logic

    Args:
        func: The RPC function to call
        endpoint: RPC endpoint identifier
        max_retries: Maximum retry attempts
        *args, **kwargs: Arguments for the function

    Returns:
        Function result

    Raises:
        Exception: If all retries fail
    """
    return await rpc_retry_handler.execute_with_retry(
        func, endpoint, max_retries, *args, **kwargs
    )


def reset_circuit_breaker(endpoint: str) -> bool:
    """Reset a specific circuit breaker to CLOSED state"""
    return rpc_retry_handler.reset_circuit_breaker(endpoint)


def reset_all_circuit_breakers() -> int:
    """Reset all circuit breakers to CLOSED state"""
    return rpc_retry_handler.reset_all_circuit_breakers()


def get_circuit_breaker_status(endpoint: str = None) -> dict:
    """Get circuit breaker status for a specific endpoint or all endpoints"""
    return rpc_retry_handler.get_circuit_breaker_status(endpoint)


class WalletCreationError(Exception):
    """Custom exception for wallet creation failures"""

    def __init__(
        self,
        message: str,
        error_type: RPCErrorType = RPCErrorType.UNKNOWN,
        retryable: bool = True,
    ):
        super().__init__(message)
        self._message = message
        self.error_type = error_type
        self.retryable = retryable

    @property
    def message(self) -> str:
        """Get the error message"""
        return self._message


class AccountVerificationError(Exception):
    """Custom exception for account verification failures"""

    def __init__(self, message: str, account_id: str = None):
        super().__init__(message)
        self.account_id = account_id
