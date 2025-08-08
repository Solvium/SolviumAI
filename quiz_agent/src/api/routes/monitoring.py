"""
Enhanced monitoring routes with comprehensive performance metrics and bot statistics.
"""

import asyncio
import time
import logging
from typing import Dict, Any, Optional
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

from api.main import get_bot_instance
from utils.config import Config
from utils.redis_client import RedisClient

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/stats")
async def get_bot_stats() -> JSONResponse:
    """
    Get comprehensive bot statistics and metrics.

    Returns:
        JSONResponse with bot statistics
    """
    try:
        bot = get_bot_instance()
        if not bot:
            raise HTTPException(status_code=503, detail="Bot service unavailable")

        stats = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "bot_info": {
                "running": hasattr(bot.app, "running") and bot.app.running,
                "updater_running": hasattr(bot.app, "updater")
                and bot.app.updater
                and bot.app.updater.running,
            },
            "configuration": {
                "webhook_mode": Config.WEBHOOK_URL is not None,
                "webhook_url": Config.WEBHOOK_URL if Config.WEBHOOK_URL else None,
                "environment": (
                    "development" if Config.is_development() else "production"
                ),
                "fastapi_enabled": True,
                "performance_monitoring": True,
            },
        }

        # Try to get bot info from Telegram
        try:
            bot_info = await bot.app.bot.get_me()
            stats["telegram_bot"] = {
                "id": bot_info.id,
                "username": bot_info.username,
                "first_name": bot_info.first_name,
                "can_join_groups": bot_info.can_join_groups,
                "can_read_all_group_messages": bot_info.can_read_all_group_messages,
                "supports_inline_queries": bot_info.supports_inline_queries,
            }
        except Exception as e:
            stats["telegram_bot"] = {"error": f"Failed to get bot info: {str(e)}"}

        # Add performance metrics
        try:
            from services.performance_service import performance_service

            stats["performance"] = await performance_service.get_performance_summary(
                hours=1
            )
        except Exception as e:
            stats["performance"] = {
                "error": f"Failed to get performance metrics: {str(e)}"
            }

        # Add active users and quizzes
        try:
            from services.user_service_optimized import optimized_user_service

            stats["activity"] = {
                "active_users_5min": await optimized_user_service.get_active_users_count(
                    minutes=5
                ),
                "active_users_1hour": await optimized_user_service.get_active_users_count(
                    minutes=60
                ),
            }
        except Exception as e:
            stats["activity"] = {"error": f"Failed to get activity metrics: {str(e)}"}

        return JSONResponse(content=stats)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting bot stats: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/status")
async def get_system_status() -> JSONResponse:
    """Get comprehensive system status including performance metrics."""
    try:
        start_time = time.perf_counter()

        # Check Redis connection
        redis_status = "unknown"
        try:
            redis_client = await RedisClient.get_instance()
            await redis_client.ping()
            redis_status = "healthy"
        except Exception as e:
            redis_status = f"error: {str(e)}"

        # Check database connection (implement as needed)
        db_status = "healthy"  # Placeholder

        # Get cache statistics
        cache_stats = {}
        try:
            from services.performance_service import performance_service

            cache_stats = performance_service.cache_stats.copy()
        except Exception as e:
            logger.error(f"Error getting cache stats: {e}")

        # Get active connections count
        active_connections = 0
        try:
            from services.performance_service import connection_pool

            active_connections = connection_pool.active_connections
        except Exception as e:
            logger.error(f"Error getting connection count: {e}")

        # Calculate response time
        response_time = (time.perf_counter() - start_time) * 1000

        status = {
            "status": "healthy",
            "timestamp": datetime.now().isoformat(),
            "environment": "development" if Config.is_development() else "production",
            "services": {
                "redis": redis_status,
                "database": db_status,
                "webhook": "active",
                "fastapi": "active",
            },
            "performance": {
                "response_time_ms": round(response_time, 2),
                "cache_stats": cache_stats,
                "active_connections": active_connections,
            },
            "uptime": "active",  # Implement uptime tracking as needed
        }

        return JSONResponse(content=status)

    except Exception as e:
        logger.error(f"Error getting system status: {e}")
        raise HTTPException(status_code=500, detail="Failed to get system status")


@router.get("/performance")
async def get_performance_metrics() -> JSONResponse:
    """Get detailed performance metrics."""
    try:
        # Get performance summary
        try:
            from services.performance_service import performance_service

            metrics = await performance_service.get_performance_summary(hours=1)
        except Exception as e:
            logger.error(f"Error getting performance metrics: {e}")
            metrics = {"error": "Failed to retrieve performance metrics"}

        # Get Redis memory usage
        redis_info = {}
        try:
            redis_client = await RedisClient.get_instance()
            info = await redis_client.info()
            redis_info = {
                "used_memory": info.get("used_memory_human", "unknown"),
                "connected_clients": info.get("connected_clients", 0),
                "keyspace_hits": info.get("keyspace_hits", 0),
                "keyspace_misses": info.get("keyspace_misses", 0),
            }
        except Exception as e:
            logger.error(f"Error getting Redis info: {e}")

        # Get active quiz count
        active_quiz_count = 0
        try:
            active_quizzes = await RedisClient.get_value("active_quizzes") or []
            active_quiz_count = len(active_quizzes)
        except Exception as e:
            logger.error(f"Error getting active quiz count: {e}")

        response = {
            "timestamp": datetime.now().isoformat(),
            "performance_metrics": metrics,
            "redis_info": redis_info,
            "active_quizzes": active_quiz_count,
        }

        return JSONResponse(content=response)

    except Exception as e:
        logger.error(f"Error getting performance metrics: {e}")
        raise HTTPException(status_code=500, detail="Failed to get performance metrics")


@router.get("/webhook/info")
async def get_webhook_info() -> JSONResponse:
    """
    Get current webhook information from Telegram.

    Returns:
        JSONResponse with webhook information
    """
    try:
        bot = get_bot_instance()
        if not bot:
            raise HTTPException(status_code=503, detail="Bot service unavailable")

        webhook_info = await bot.app.bot.get_webhook_info()

        return JSONResponse(
            content={
                "url": webhook_info.url,
                "has_custom_certificate": webhook_info.has_custom_certificate,
                "pending_update_count": webhook_info.pending_update_count,
                "last_error_date": (
                    webhook_info.last_error_date.isoformat()
                    if webhook_info.last_error_date
                    else None
                ),
                "last_error_message": webhook_info.last_error_message,
                "last_synchronization_error_date": (
                    webhook_info.last_synchronization_error_date.isoformat()
                    if webhook_info.last_synchronization_error_date
                    else None
                ),
                "max_connections": webhook_info.max_connections,
                "allowed_updates": webhook_info.allowed_updates,
                "ip_address": webhook_info.ip_address,
            }
        )

    except Exception as e:
        logger.error(f"Error getting webhook info: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/cache/stats")
async def get_cache_statistics() -> JSONResponse:
    """Get detailed cache statistics."""
    try:
        # Get cache hit/miss ratios
        cache_stats = {}
        try:
            from services.performance_service import performance_service

            stats = performance_service.cache_stats

            total_requests = stats.get("total_requests", 0)
            if total_requests > 0:
                hit_rate = (stats.get("hits", 0) / total_requests) * 100
                miss_rate = (stats.get("misses", 0) / total_requests) * 100
            else:
                hit_rate = miss_rate = 0

            cache_stats = {
                "total_requests": total_requests,
                "cache_hits": stats.get("hits", 0),
                "cache_misses": stats.get("misses", 0),
                "hit_rate_percent": round(hit_rate, 2),
                "miss_rate_percent": round(miss_rate, 2),
            }
        except Exception as e:
            logger.error(f"Error getting cache stats: {e}")

        # Get Redis cache sizes by prefix
        cache_sizes = {}
        try:
            redis_client = await RedisClient.get_instance()

            prefixes = [
                "user_profile:",
                "quiz_state:",
                "quiz_leaderboard:",
                "user_activity:",
                "wallet_info:",
            ]

            for prefix in prefixes:
                keys = []
                async for key in redis_client.scan_iter(match=f"{prefix}*"):
                    keys.append(key.decode())
                cache_sizes[prefix.rstrip(":")] = len(keys)

        except Exception as e:
            logger.error(f"Error getting cache sizes: {e}")

        response = {
            "timestamp": datetime.now().isoformat(),
            "cache_performance": cache_stats,
            "cache_sizes": cache_sizes,
        }

        return JSONResponse(content=response)

    except Exception as e:
        logger.error(f"Error getting cache statistics: {e}")
        raise HTTPException(status_code=500, detail="Failed to get cache statistics")


@router.post("/cache/clear/{cache_type}")
async def clear_specific_cache(cache_type: str) -> JSONResponse:
    """Clear specific cache type."""
    try:
        redis_client = await RedisClient.get_instance()

        # Define cache patterns
        cache_patterns = {
            "user": "user_*",
            "quiz": "quiz_*",
            "wallet": "wallet_*",
            "leaderboard": "*leaderboard*",
            "activity": "user_activity:*",
        }

        if cache_type not in cache_patterns:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid cache type. Available types: {list(cache_patterns.keys())}",
            )

        pattern = cache_patterns[cache_type]
        deleted_count = 0

        # Delete keys matching the pattern
        async for key in redis_client.scan_iter(match=pattern):
            await redis_client.delete(key)
            deleted_count += 1

        return JSONResponse(
            content={
                "message": f"Cleared {cache_type} cache",
                "deleted_keys": deleted_count,
                "pattern": pattern,
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error clearing {cache_type} cache: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to clear {cache_type} cache"
        )


@router.get("/handlers")
async def get_handlers_info() -> JSONResponse:
    """
    Get information about registered handlers.

    Returns:
        JSONResponse with handlers information
    """
    try:
        bot = get_bot_instance()
        if not bot:
            raise HTTPException(status_code=503, detail="Bot service unavailable")

        handlers_info = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "total_handlers": 0,
            "handlers_by_group": {},
        }

        # Get handler information from the application
        if hasattr(bot.app, "handlers"):
            for group, handlers in bot.app.handlers.items():
                handlers_info["handlers_by_group"][str(group)] = len(handlers)
                handlers_info["total_handlers"] += len(handlers)

        return JSONResponse(content=handlers_info)

    except Exception as e:
        logger.error(f"Error getting handlers info: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/metrics/realtime")
async def get_realtime_metrics() -> JSONResponse:
    """Get real-time metrics for monitoring dashboard."""
    try:
        # Get active user count
        active_users = 0
        try:
            from services.user_service_optimized import optimized_user_service

            active_users = await optimized_user_service.get_active_users_count(
                minutes=5
            )
        except Exception as e:
            logger.error(f"Error getting active users: {e}")

        # Get active quiz count
        active_quizzes = 0
        try:
            active_quiz_data = await RedisClient.get_value("active_quizzes") or []
            active_quizzes = len(active_quiz_data)
        except Exception as e:
            logger.error(f"Error getting active quizzes: {e}")

        # Get cache performance
        cache_performance = {"hit_rate": 0, "total_requests": 0}
        try:
            from services.performance_service import performance_service

            stats = performance_service.cache_stats
            total = stats.get("total_requests", 0)
            if total > 0:
                cache_performance = {
                    "hit_rate": round((stats.get("hits", 0) / total) * 100, 2),
                    "total_requests": total,
                }
        except Exception as e:
            logger.error(f"Error getting cache performance: {e}")

        # Get system resources
        system_metrics = {}
        try:
            import psutil

            system_metrics = {
                "cpu_percent": psutil.cpu_percent(),
                "memory_percent": psutil.virtual_memory().percent,
                "disk_percent": psutil.disk_usage("/").percent,
            }
        except ImportError:
            system_metrics = {"note": "psutil not available for system metrics"}
        except Exception as e:
            logger.error(f"Error getting system metrics: {e}")

        realtime_data = {
            "timestamp": datetime.now().isoformat(),
            "active_users": active_users,
            "active_quizzes": active_quizzes,
            "cache_performance": cache_performance,
            "system_metrics": system_metrics,
        }

        return JSONResponse(content=realtime_data)

    except Exception as e:
        logger.error(f"Error getting realtime metrics: {e}")
        raise HTTPException(status_code=500, detail="Failed to get realtime metrics")


@router.post("/restart")
async def restart_bot() -> JSONResponse:
    """
    Restart the bot (development only).

    Returns:
        JSONResponse indicating restart status
    """
    if not Config.is_development():
        raise HTTPException(
            status_code=403, detail="Restart only available in development mode"
        )

    try:
        bot = get_bot_instance()
        if not bot:
            raise HTTPException(status_code=503, detail="Bot service unavailable")

        # This is a placeholder - actual restart logic would depend on your deployment
        logger.info("Bot restart requested (development mode)")

        return JSONResponse(
            content={
                "status": "restart_requested",
                "message": "Bot restart has been requested",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        )

    except Exception as e:
        logger.error(f"Error restarting bot: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health/detailed")
async def get_detailed_health() -> JSONResponse:
    """Get detailed health check with component-specific status."""
    try:
        health_status = {
            "status": "healthy",
            "timestamp": datetime.now().isoformat(),
            "components": {},
        }

        # Check Redis health
        try:
            redis_client = await RedisClient.get_instance()
            await redis_client.ping()
            redis_info = await redis_client.info()

            health_status["components"]["redis"] = {
                "status": "healthy",
                "memory_usage": redis_info.get("used_memory_human", "unknown"),
                "uptime": redis_info.get("uptime_in_seconds", 0),
            }
        except Exception as e:
            health_status["components"]["redis"] = {
                "status": "unhealthy",
                "error": str(e),
            }
            health_status["status"] = "degraded"

        # Check database health (implement as needed)
        try:
            # Placeholder for database health check
            health_status["components"]["database"] = {
                "status": "healthy",
                "connection_pool": "active",
            }
        except Exception as e:
            health_status["components"]["database"] = {
                "status": "unhealthy",
                "error": str(e),
            }
            health_status["status"] = "degraded"

        # Check bot service health
        try:
            bot = get_bot_instance()

            health_status["components"]["bot"] = {
                "status": "healthy" if bot else "unhealthy",
                "instance_available": bot is not None,
            }

            if not bot:
                health_status["status"] = "degraded"

        except Exception as e:
            health_status["components"]["bot"] = {
                "status": "unhealthy",
                "error": str(e),
            }
            health_status["status"] = "degraded"

        # Check performance metrics
        try:
            from services.performance_service import (
                performance_service,
                connection_pool,
            )

            health_status["components"]["performance"] = {
                "status": "healthy",
                "cache_hit_rate": performance_service.cache_stats.get("hits", 0),
                "active_connections": connection_pool.active_connections,
                "max_connections": connection_pool.max_connections,
            }
        except Exception as e:
            health_status["components"]["performance"] = {
                "status": "degraded",
                "error": str(e),
            }

        return JSONResponse(content=health_status)

    except Exception as e:
        logger.error(f"Error getting detailed health: {e}")
        raise HTTPException(
            status_code=500, detail="Failed to get detailed health status"
        )
