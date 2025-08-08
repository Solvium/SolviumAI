"""
Performance monitoring and optimization service.
Provides caching, connection pooling, and performance metrics.
"""

import asyncio
import time
import json
import logging
from typing import Dict, Any, Optional, Callable, List
from functools import wraps
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta

from utils.redis_client import RedisClient

logger = logging.getLogger(__name__)


@dataclass
class PerformanceMetrics:
    """Performance metrics data structure."""
    endpoint: str
    method: str
    response_time_ms: float
    status_code: int
    timestamp: datetime
    user_id: Optional[str] = None
    request_size: Optional[int] = None
    response_size: Optional[int] = None


class PerformanceService:
    """Service for performance monitoring and optimization."""
    
    def __init__(self):
        self.metrics_buffer: List[PerformanceMetrics] = []
        self.buffer_size = 100
        self.cache_stats = {
            "hits": 0,
            "misses": 0,
            "total_requests": 0
        }
    
    async def record_metric(self, metric: PerformanceMetrics):
        """Record a performance metric."""
        self.metrics_buffer.append(metric)
        
        # Flush buffer when it reaches the limit
        if len(self.metrics_buffer) >= self.buffer_size:
            await self._flush_metrics()
    
    async def _flush_metrics(self):
        """Flush metrics buffer to Redis."""
        try:
            if not self.metrics_buffer:
                return
            
            # Convert metrics to JSON-serializable format
            metrics_data = [
                {
                    **asdict(metric),
                    "timestamp": metric.timestamp.isoformat()
                }
                for metric in self.metrics_buffer
            ]
            
            # Store in Redis with 24-hour expiry
            cache_key = f"performance_metrics:{int(time.time())}"
            await RedisClient.set_value(cache_key, metrics_data, ttl_seconds=86400)
            
            # Clear buffer
            self.metrics_buffer.clear()
            
            logger.debug(f"Flushed {len(metrics_data)} performance metrics to cache")
            
        except Exception as e:
            logger.error(f"Error flushing performance metrics: {e}")
    
    async def get_performance_summary(self, hours: int = 1) -> Dict[str, Any]:
        """Get performance summary for the last N hours."""
        try:
            end_time = int(time.time())
            start_time = end_time - (hours * 3600)
            
            # Get all metrics from the time range
            all_metrics = []
            for timestamp in range(start_time, end_time, 300):  # 5-minute intervals
                cache_key = f"performance_metrics:{timestamp}"
                metrics_data = await RedisClient.get_value(cache_key)
                if metrics_data:
                    all_metrics.extend(metrics_data)
            
            if not all_metrics:
                return {"message": "No metrics available for the specified time range"}
            
            # Calculate summary statistics
            response_times = [m["response_time_ms"] for m in all_metrics]
            status_codes = [m["status_code"] for m in all_metrics]
            
            summary = {
                "total_requests": len(all_metrics),
                "average_response_time_ms": sum(response_times) / len(response_times),
                "median_response_time_ms": sorted(response_times)[len(response_times) // 2],
                "max_response_time_ms": max(response_times),
                "min_response_time_ms": min(response_times),
                "error_rate": len([s for s in status_codes if s >= 400]) / len(status_codes),
                "cache_stats": self.cache_stats.copy(),
                "time_range_hours": hours
            }
            
            return summary
            
        except Exception as e:
            logger.error(f"Error getting performance summary: {e}")
            return {"error": str(e)}


# Global performance service instance
performance_service = PerformanceService()


def redis_cache(ttl: int = 300, key_prefix: str = "cache"):
    """
    Decorator for caching function results in Redis with performance tracking.
    
    Args:
        ttl: Time to live in seconds
        key_prefix: Prefix for cache keys
    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Generate cache key
            key_parts = [str(arg) for arg in args] + [f"{k}={v}" for k, v in kwargs.items()]
            cache_key = f"{key_prefix}:{func.__name__}:{hash(':'.join(key_parts))}"
            
            start_time = time.perf_counter()
            
            try:
                # Try to get from cache first
                cached_result = await RedisClient.get_value(cache_key)
                if cached_result is not None:
                    performance_service.cache_stats["hits"] += 1
                    performance_service.cache_stats["total_requests"] += 1
                    
                    cache_time = (time.perf_counter() - start_time) * 1000
                    logger.debug(f"Cache hit for {func.__name__} in {cache_time:.2f}ms")
                    return cached_result
                
                # Cache miss - execute function
                performance_service.cache_stats["misses"] += 1
                performance_service.cache_stats["total_requests"] += 1
                
                result = await func(*args, **kwargs)
                
                # Cache the result
                await RedisClient.set_value(cache_key, result, ttl_seconds=ttl)
                
                execution_time = (time.perf_counter() - start_time) * 1000
                logger.debug(f"Cache miss for {func.__name__} - executed in {execution_time:.2f}ms")
                
                return result
                
            except Exception as e:
                logger.error(f"Error in cached function {func.__name__}: {e}")
                # Fallback to direct function execution
                return await func(*args, **kwargs)
        
        return wrapper
    return decorator


def performance_monitor(endpoint_name: str = None):
    """
    Decorator for monitoring function performance.
    
    Args:
        endpoint_name: Custom name for the endpoint (optional)
    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            start_time = time.perf_counter()
            endpoint = endpoint_name or func.__name__
            
            try:
                result = await func(*args, **kwargs)
                response_time = (time.perf_counter() - start_time) * 1000
                
                # Record successful execution
                metric = PerformanceMetrics(
                    endpoint=endpoint,
                    method="ASYNC_CALL",
                    response_time_ms=response_time,
                    status_code=200,
                    timestamp=datetime.now()
                )
                
                await performance_service.record_metric(metric)
                
                # Log slow operations
                if response_time > 1000:  # > 1 second
                    logger.warning(f"Slow operation detected: {endpoint} took {response_time:.2f}ms")
                
                return result
                
            except Exception as e:
                response_time = (time.perf_counter() - start_time) * 1000
                
                # Record failed execution
                metric = PerformanceMetrics(
                    endpoint=endpoint,
                    method="ASYNC_CALL",
                    response_time_ms=response_time,
                    status_code=500,
                    timestamp=datetime.now()
                )
                
                await performance_service.record_metric(metric)
                raise
        
        return wrapper
    return decorator


class ConnectionPool:
    """Optimized connection pool for external services."""
    
    def __init__(self, max_connections: int = 50):
        self.max_connections = max_connections
        self.active_connections = 0
        self.connection_semaphore = asyncio.Semaphore(max_connections)
    
    async def acquire_connection(self):
        """Acquire a connection from the pool."""
        await self.connection_semaphore.acquire()
        self.active_connections += 1
        return self
    
    async def release_connection(self):
        """Release a connection back to the pool."""
        self.active_connections -= 1
        self.connection_semaphore.release()
    
    async def __aenter__(self):
        await self.acquire_connection()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.release_connection()


# Global connection pool
connection_pool = ConnectionPool(max_connections=50)


class BulkOperationManager:
    """Manager for batching operations to reduce database/API calls."""
    
    def __init__(self, batch_size: int = 100, flush_interval: float = 1.0):
        self.batch_size = batch_size
        self.flush_interval = flush_interval
        self.pending_operations: Dict[str, List[Any]] = {}
        self.last_flush = time.time()
    
    async def add_operation(self, operation_type: str, data: Any):
        """Add an operation to the batch."""
        if operation_type not in self.pending_operations:
            self.pending_operations[operation_type] = []
        
        self.pending_operations[operation_type].append(data)
        
        # Check if we need to flush
        should_flush = (
            len(self.pending_operations[operation_type]) >= self.batch_size or
            time.time() - self.last_flush > self.flush_interval
        )
        
        if should_flush:
            await self.flush_operations(operation_type)
    
    async def flush_operations(self, operation_type: str = None):
        """Flush pending operations."""
        if operation_type:
            operations_to_flush = {operation_type: self.pending_operations.get(operation_type, [])}
        else:
            operations_to_flush = self.pending_operations.copy()
        
        for op_type, operations in operations_to_flush.items():
            if operations:
                try:
                    await self._execute_batch(op_type, operations)
                    self.pending_operations[op_type] = []
                    logger.debug(f"Flushed {len(operations)} {op_type} operations")
                except Exception as e:
                    logger.error(f"Error flushing {op_type} operations: {e}")
        
        self.last_flush = time.time()
    
    async def _execute_batch(self, operation_type: str, operations: List[Any]):
        """Execute a batch of operations (implement per operation type)."""
        if operation_type == "user_updates":
            await self._batch_update_users(operations)
        elif operation_type == "quiz_metrics":
            await self._batch_record_quiz_metrics(operations)
        else:
            logger.warning(f"Unknown operation type for batching: {operation_type}")
    
    async def _batch_update_users(self, user_updates: List[Dict]):
        """Batch update user records."""
        # Implement batch user updates
        pass
    
    async def _batch_record_quiz_metrics(self, metrics: List[Dict]):
        """Batch record quiz metrics."""
        # Implement batch metrics recording
        pass


# Global bulk operation manager
bulk_manager = BulkOperationManager()


async def optimize_quiz_cache(quiz_id: str, user_count: int = 0):
    """
    Optimize cache settings based on quiz activity.
    
    Args:
        quiz_id: The quiz identifier
        user_count: Number of active users in the quiz
    """
    try:
        # Adjust TTL based on activity level
        if user_count > 100:
            # High activity - shorter TTL for real-time updates
            participants_ttl = 60  # 1 minute
            leaderboard_ttl = 30   # 30 seconds
        elif user_count > 20:
            # Medium activity
            participants_ttl = 180  # 3 minutes
            leaderboard_ttl = 120   # 2 minutes
        else:
            # Low activity - longer TTL to reduce load
            participants_ttl = 600  # 10 minutes
            leaderboard_ttl = 300   # 5 minutes
        
        # Update cache TTL settings
        cache_settings = {
            "participants_ttl": participants_ttl,
            "leaderboard_ttl": leaderboard_ttl,
            "last_optimized": datetime.now().isoformat()
        }
        
        await RedisClient.set_value(
            f"cache_settings:{quiz_id}", 
            cache_settings, 
            ttl_seconds=3600
        )
        
        logger.debug(f"Optimized cache settings for quiz {quiz_id} with {user_count} users")
        
    except Exception as e:
        logger.error(f"Error optimizing cache for quiz {quiz_id}: {e}")
