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
    """Handles RPC retries with exponential backoff and circuit breaker"""

    def __init__(self):
        self.circuit_breakers: Dict[str, CircuitBreaker] = {}

    def _get_circuit_breaker(self, endpoint: str) -> CircuitBreaker:
        """Get or create circuit breaker for an endpoint"""
        if endpoint not in self.circuit_breakers:
            self.circuit_breakers[endpoint] = CircuitBreaker()
        return self.circuit_breakers[endpoint]

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


# Global instance
rpc_retry_handler = RPCRetryHandler()


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


class WalletCreationError(Exception):
    """Custom exception for wallet creation failures"""

    def __init__(
        self,
        message: str,
        error_type: RPCErrorType = RPCErrorType.UNKNOWN,
        retryable: bool = True,
    ):
        super().__init__(message)
        self.error_type = error_type
        self.retryable = retryable


class AccountVerificationError(Exception):
    """Custom exception for account verification failures"""

    def __init__(self, message: str, account_id: str = None):
        super().__init__(message)
        self.account_id = account_id
