"""
Performance Monitoring Utility for Mental Maze Quiz Bot

This module provides performance monitoring and metrics collection
to identify bottlenecks and track optimization improvements.
"""

import time
import logging
import asyncio
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from contextlib import asynccontextmanager
from utils.redis_client import RedisClient
import json

logger = logging.getLogger(__name__)


@dataclass
class PerformanceMetric:
    """Data class for storing performance metrics."""

    operation: str
    duration_ms: float
    timestamp: datetime
    success: bool
    metadata: Dict[str, Any] = field(default_factory=dict)


class PerformanceMonitor:
    """Performance monitoring and metrics collection."""

    def __init__(self):
        self.metrics: List[PerformanceMetric] = []
        self.redis_client = RedisClient()
        self.metric_cache_key = "performance_metrics"

    @asynccontextmanager
    async def track_operation(
        self, operation_name: str, metadata: Optional[Dict[str, Any]] = None
    ):
        """Context manager to track operation performance."""
        start_time = time.time()
        success = False
        error = None

        try:
            yield
            success = True
        except Exception as e:
            error = str(e)
            raise
        finally:
            duration_ms = (time.time() - start_time) * 1000

            metric = PerformanceMetric(
                operation=operation_name,
                duration_ms=duration_ms,
                timestamp=datetime.utcnow(),
                success=success,
                metadata=metadata or {},
            )

            if error:
                metric.metadata["error"] = error

            await self._record_metric(metric)

            # Log slow operations
            if duration_ms > 1000:  # Slower than 1 second
                logger.warning(
                    f"Slow operation detected: {operation_name} took {duration_ms:.2f}ms"
                )

    async def _record_metric(self, metric: PerformanceMetric):
        """Record a performance metric."""
        try:
            # Store in memory for recent metrics
            self.metrics.append(metric)

            # Keep only last 1000 metrics in memory
            if len(self.metrics) > 1000:
                self.metrics = self.metrics[-1000:]

            # Store in Redis for persistence (with error handling)
            try:
                metric_data = {
                    "operation": metric.operation,
                    "duration_ms": metric.duration_ms,
                    "timestamp": metric.timestamp.isoformat(),
                    "success": metric.success,
                    "metadata": metric.metadata,
                }

                # Add to Redis list with expiration
                await self.redis_client.set_value(
                    f"{self.metric_cache_key}:{int(time.time())}",
                    metric_data,
                    ttl_seconds=3600 * 24,  # Keep for 24 hours
                )
            except Exception as redis_error:
                # Silently handle Redis errors to avoid breaking performance tracking
                pass

        except Exception as e:
            logger.error(f"Failed to record performance metric: {e}")

    async def get_performance_stats(
        self, operation_filter: Optional[str] = None, hours_back: int = 1
    ) -> Dict[str, Any]:
        """Get performance statistics for operations."""
        try:
            cutoff_time = datetime.utcnow() - timedelta(hours=hours_back)

            # Filter metrics
            filtered_metrics = [
                m
                for m in self.metrics
                if m.timestamp >= cutoff_time
                and (not operation_filter or operation_filter in m.operation)
            ]

            if not filtered_metrics:
                return {"message": "No metrics found for the specified criteria"}

            # Calculate statistics
            durations = [m.duration_ms for m in filtered_metrics]
            success_count = sum(1 for m in filtered_metrics if m.success)

            stats = {
                "total_operations": len(filtered_metrics),
                "success_count": success_count,
                "failure_count": len(filtered_metrics) - success_count,
                "success_rate": (success_count / len(filtered_metrics)) * 100,
                "avg_duration_ms": sum(durations) / len(durations),
                "min_duration_ms": min(durations),
                "max_duration_ms": max(durations),
                "p95_duration_ms": self._percentile(durations, 95),
                "p99_duration_ms": self._percentile(durations, 99),
            }

            # Group by operation type
            operation_stats = {}
            for metric in filtered_metrics:
                op = metric.operation
                if op not in operation_stats:
                    operation_stats[op] = {
                        "count": 0,
                        "success_count": 0,
                        "durations": [],
                    }

                operation_stats[op]["count"] += 1
                if metric.success:
                    operation_stats[op]["success_count"] += 1
                operation_stats[op]["durations"].append(metric.duration_ms)

            # Calculate per-operation stats
            for op, data in operation_stats.items():
                durations = data["durations"]
                data.update(
                    {
                        "success_rate": (data["success_count"] / data["count"]) * 100,
                        "avg_duration_ms": sum(durations) / len(durations),
                        "max_duration_ms": max(durations),
                        "p95_duration_ms": self._percentile(durations, 95),
                    }
                )
                del data["durations"]  # Remove raw durations from output

            stats["by_operation"] = operation_stats

            return stats

        except Exception as e:
            logger.error(f"Failed to get performance stats: {e}")
            return {"error": str(e)}

    def _percentile(self, data: List[float], percentile: int) -> float:
        """Calculate percentile of a list of numbers."""
        if not data:
            return 0.0

        sorted_data = sorted(data)
        index = (percentile / 100) * (len(sorted_data) - 1)

        if index.is_integer():
            return sorted_data[int(index)]
        else:
            lower_index = int(index)
            upper_index = lower_index + 1
            weight = index - lower_index
            return (
                sorted_data[lower_index] * (1 - weight)
                + sorted_data[upper_index] * weight
            )

    async def get_slow_operations(
        self, threshold_ms: float = 1000, hours_back: int = 1
    ) -> List[Dict[str, Any]]:
        """Get operations that exceeded the performance threshold."""
        try:
            cutoff_time = datetime.utcnow() - timedelta(hours=hours_back)

            slow_operations = [
                {
                    "operation": m.operation,
                    "duration_ms": m.duration_ms,
                    "timestamp": m.timestamp.isoformat(),
                    "success": m.success,
                    "metadata": m.metadata,
                }
                for m in self.metrics
                if m.timestamp >= cutoff_time and m.duration_ms > threshold_ms
            ]

            # Sort by duration (slowest first)
            slow_operations.sort(key=lambda x: x["duration_ms"], reverse=True)

            return slow_operations

        except Exception as e:
            logger.error(f"Failed to get slow operations: {e}")
            return []

    async def cleanup_old_metrics(self):
        """Clean up old metrics from memory and Redis."""
        try:
            # Clean up memory
            cutoff_time = datetime.utcnow() - timedelta(hours=24)
            self.metrics = [m for m in self.metrics if m.timestamp >= cutoff_time]

            logger.info(
                f"Cleaned up old metrics, {len(self.metrics)} metrics remaining in memory"
            )

        except Exception as e:
            logger.error(f"Failed to cleanup old metrics: {e}")


# Global performance monitor instance
performance_monitor = PerformanceMonitor()


# Convenience functions for common operations
@asynccontextmanager
async def track_quiz_answer_submission(metadata: Optional[Dict[str, Any]] = None):
    """Track quiz answer submission performance."""
    async with performance_monitor.track_operation("quiz_answer_submission", metadata):
        yield


@asynccontextmanager
async def track_quiz_creation(metadata: Optional[Dict[str, Any]] = None):
    """Track quiz creation performance."""
    async with performance_monitor.track_operation("quiz_creation", metadata):
        yield


@asynccontextmanager
async def track_database_query(
    operation: str, metadata: Optional[Dict[str, Any]] = None
):
    """Track database query performance."""
    async with performance_monitor.track_operation(f"db_query_{operation}", metadata):
        yield


@asynccontextmanager
async def track_cache_operation(
    operation: str, metadata: Optional[Dict[str, Any]] = None
):
    """Track cache operation performance."""
    async with performance_monitor.track_operation(f"cache_{operation}", metadata):
        yield


@asynccontextmanager
async def track_ai_generation(metadata: Optional[Dict[str, Any]] = None):
    """Track AI question generation performance."""
    async with performance_monitor.track_operation("ai_question_generation", metadata):
        yield
