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
from utils.rpc_retry import (
    get_circuit_breaker_status as get_cb_status,
    reset_circuit_breaker,
    reset_all_circuit_breakers,
)

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

        # Add message queue monitoring
        try:
            from utils.telegram_helpers import message_queue

            stats["message_queue"] = {
                "queue_size": message_queue.get_queue_size(),
                "num_workers": message_queue.num_workers,
                "total_processed": message_queue.processed_count,
                "running": message_queue.running,
            }
        except Exception as e:
            stats["message_queue"] = {"error": f"Failed to get queue metrics: {str(e)}"}

        # Add database connection pool monitoring
        try:
            from store.database import engine

            pool_status = engine.pool.status()
            stats["database_pool"] = {
                "pool_size": engine.pool.size(),
                "checked_out_connections": engine.pool.checkedout(),
                "overflow_connections": engine.pool.overflow(),
                "total_connections": engine.pool.size() + engine.pool.overflow(),
                "status": pool_status,
            }
        except Exception as e:
            stats["database_pool"] = {"error": f"Failed to get pool metrics: {str(e)}"}

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


@router.get("/dashboard")
async def get_monitoring_dashboard():
    """Serve a comprehensive monitoring dashboard HTML page."""
    dashboard_html = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SolviumAI Quiz Bot - Monitoring Dashboard</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            color: #333;
        }

        .container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 20px;
        }

        .header {
            text-align: center;
            margin-bottom: 30px;
            color: white;
        }

        .header h1 {
            font-size: 2.5rem;
            margin-bottom: 10px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }

        .header p {
            font-size: 1.1rem;
            opacity: 0.9;
        }

        .dashboard-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }

        .card {
            background: white;
            border-radius: 15px;
            padding: 25px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }

        .card:hover {
            transform: translateY(-5px);
            box-shadow: 0 15px 40px rgba(0,0,0,0.15);
        }

        .card h3 {
            color: #667eea;
            margin-bottom: 15px;
            font-size: 1.3rem;
            border-bottom: 2px solid #f0f0f0;
            padding-bottom: 10px;
        }

        .metric {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
            padding: 10px;
            background: #f8f9fa;
            border-radius: 8px;
        }

        .metric-label {
            font-weight: 500;
            color: #555;
        }

        .metric-value {
            font-weight: bold;
            color: #667eea;
            font-size: 1.1rem;
        }

        .status-indicator {
            display: inline-block;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            margin-right: 8px;
        }

        .status-healthy { background-color: #28a745; }
        .status-warning { background-color: #ffc107; }
        .status-error { background-color: #dc3545; }

        .chart-container {
            position: relative;
            height: 300px;
            margin-top: 20px;
        }

        .refresh-btn {
            background: linear-gradient(45deg, #667eea, #764ba2);
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 25px;
            cursor: pointer;
            font-size: 1rem;
            font-weight: 500;
            transition: all 0.3s ease;
            margin-bottom: 20px;
        }

        .refresh-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        }

        .external-links {
            display: flex;
            gap: 15px;
            justify-content: center;
            margin-bottom: 30px;
        }

        .external-link {
            background: rgba(255,255,255,0.2);
            color: white;
            text-decoration: none;
            padding: 12px 24px;
            border-radius: 25px;
            transition: all 0.3s ease;
            backdrop-filter: blur(10px);
        }

        .external-link:hover {
            background: rgba(255,255,255,0.3);
            transform: translateY(-2px);
        }

        .loading {
            text-align: center;
            color: #666;
            font-style: italic;
        }

        .error {
            color: #dc3545;
            background: #f8d7da;
            padding: 10px;
            border-radius: 5px;
            margin: 10px 0;
        }

        @media (max-width: 768px) {
            .dashboard-grid {
                grid-template-columns: 1fr;
            }

            .header h1 {
                font-size: 2rem;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 SolviumAI Quiz Bot</h1>
            <p>Real-time Monitoring Dashboard</p>
        </div>

        <div class="external-links">
            <a href="/prometheus/" target="_blank" class="external-link">📊 Prometheus</a>
            <a href="/grafana/" target="_blank" class="external-link">📈 Grafana</a>
            <a href="/monitoring/metrics/realtime" target="_blank" class="external-link">🔍 Raw Metrics</a>
        </div>

        <button class="refresh-btn" onclick="refreshDashboard()">🔄 Refresh Dashboard</button>

        <div class="dashboard-grid">
            <!-- System Status Card -->
            <div class="card">
                <h3>🖥️ System Status</h3>
                <div id="system-status">
                    <div class="loading">Loading system status...</div>
                </div>
            </div>

            <!-- Performance Metrics Card -->
            <div class="card">
                <h3>⚡ Performance Metrics</h3>
                <div id="performance-metrics">
                    <div class="loading">Loading performance data...</div>
                </div>
            </div>

            <!-- Bot Statistics Card -->
            <div class="card">
                <h3>🤖 Bot Statistics</h3>
                <div id="bot-stats">
                    <div class="loading">Loading bot statistics...</div>
                </div>
            </div>

            <!-- Cache Performance Card -->
            <div class="card">
                <h3>💾 Cache Performance</h3>
                <div id="cache-stats">
                    <div class="loading">Loading cache statistics...</div>
                </div>
            </div>

            <!-- Real-time Activity Card -->
            <div class="card">
                <h3>📱 Real-time Activity</h3>
                <div id="realtime-activity">
                    <div class="loading">Loading activity data...</div>
                </div>
            </div>

            <!-- Webhook Status Card -->
            <div class="card">
                <h3>🔗 Webhook Status</h3>
                <div id="webhook-status">
                    <div class="loading">Loading webhook information...</div>
                </div>
            </div>
        </div>

        <!-- Charts Section -->
        <div class="card" style="grid-column: 1 / -1;">
            <h3>📈 Performance Trends</h3>
            <div class="chart-container">
                <canvas id="performanceChart"></canvas>
            </div>
        </div>
    </div>

    <script>
        let performanceChart;
        let updateInterval;

        // Initialize dashboard
        document.addEventListener('DOMContentLoaded', function() {
            refreshDashboard();
            // Auto-refresh every 30 seconds
            updateInterval = setInterval(refreshDashboard, 30000);
        });

        async function refreshDashboard() {
            try {
                await Promise.all([
                    loadSystemStatus(),
                    loadPerformanceMetrics(),
                    loadBotStats(),
                    loadCacheStats(),
                    loadRealtimeActivity(),
                    loadWebhookStatus()
                ]);
            } catch (error) {
                console.error('Error refreshing dashboard:', error);
            }
        }

        async function loadSystemStatus() {
            try {
                const response = await axios.get('/monitoring/status');
                const data = response.data;

                const html = `
                    <div class="metric">
                        <span class="metric-label">Overall Status</span>
                        <span class="metric-value">
                            <span class="status-indicator status-${data.status === 'healthy' ? 'healthy' : 'error'}"></span>
                            ${data.status.toUpperCase()}
                        </span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Environment</span>
                        <span class="metric-value">${data.environment}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Redis</span>
                        <span class="metric-value">
                            <span class="status-indicator status-${data.services.redis === 'healthy' ? 'healthy' : 'error'}"></span>
                            ${data.services.redis}
                        </span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Database</span>
                        <span class="metric-value">
                            <span class="status-indicator status-${data.services.database === 'healthy' ? 'healthy' : 'error'}"></span>
                            ${data.services.database}
                        </span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Response Time</span>
                        <span class="metric-value">${data.performance.response_time_ms}ms</span>
                    </div>
                `;

                document.getElementById('system-status').innerHTML = html;
            } catch (error) {
                document.getElementById('system-status').innerHTML = `<div class="error">Error loading system status: ${error.message}</div>`;
            }
        }

        async function loadPerformanceMetrics() {
            try {
                const response = await axios.get('/monitoring/performance');
                const data = response.data;

                const html = `
                    <div class="metric">
                        <span class="metric-label">Cache Hit Rate</span>
                        <span class="metric-value">${data.redis_info.keyspace_hits || 'N/A'}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Redis Memory</span>
                        <span class="metric-value">${data.redis_info.used_memory || 'N/A'}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Connected Clients</span>
                        <span class="metric-value">${data.redis_info.connected_clients || 'N/A'}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Active Quizzes</span>
                        <span class="metric-value">${data.active_quizzes}</span>
                    </div>
                `;

                document.getElementById('performance-metrics').innerHTML = html;
            } catch (error) {
                document.getElementById('performance-metrics').innerHTML = `<div class="error">Error loading performance metrics: ${error.message}</div>`;
            }
        }

        async function loadBotStats() {
            try {
                const response = await axios.get('/monitoring/stats');
                const data = response.data;

                const html = `
                    <div class="metric">
                        <span class="metric-label">Bot Status</span>
                        <span class="metric-value">
                            <span class="status-indicator status-${data.bot_info.running ? 'healthy' : 'error'}"></span>
                            ${data.bot_info.running ? 'Running' : 'Stopped'}
                        </span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Webhook Mode</span>
                        <span class="metric-value">${data.configuration.webhook_mode ? 'Yes' : 'No'}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Environment</span>
                        <span class="metric-value">${data.configuration.environment}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Username</span>
                        <span class="metric-value">${data.telegram_bot?.username || 'N/A'}</span>
                    </div>
                `;

                document.getElementById('bot-stats').innerHTML = html;
            } catch (error) {
                document.getElementById('bot-stats').innerHTML = `<div class="error">Error loading bot statistics: ${error.message}</div>`;
            }
        }

        async function loadCacheStats() {
            try {
                const response = await axios.get('/monitoring/cache/stats');
                const data = response.data;

                const html = `
                    <div class="metric">
                        <span class="metric-label">Total Requests</span>
                        <span class="metric-value">${data.cache_performance.total_requests}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Cache Hits</span>
                        <span class="metric-value">${data.cache_performance.cache_hits}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Hit Rate</span>
                        <span class="metric-value">${data.cache_performance.hit_rate_percent}%</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">User Profiles</span>
                        <span class="metric-value">${data.cache_sizes.user_profile || 0}</span>
                    </div>
                `;

                document.getElementById('cache-stats').innerHTML = html;
            } catch (error) {
                document.getElementById('cache-stats').innerHTML = `<div class="error">Error loading cache statistics: ${error.message}</div>`;
            }
        }

        async function loadRealtimeActivity() {
            try {
                const response = await axios.get('/monitoring/metrics/realtime');
                const data = response.data;

                const html = `
                    <div class="metric">
                        <span class="metric-label">Active Users (5min)</span>
                        <span class="metric-value">${data.active_users}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Active Quizzes</span>
                        <span class="metric-value">${data.active_quizzes}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Cache Hit Rate</span>
                        <span class="metric-value">${data.cache_performance.hit_rate}%</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">CPU Usage</span>
                        <span class="metric-value">${data.system_metrics.cpu_percent || 'N/A'}%</span>
                    </div>
                `;

                document.getElementById('realtime-activity').innerHTML = html;
            } catch (error) {
                document.getElementById('realtime-activity').innerHTML = `<div class="error">Error loading activity data: ${error.message}</div>`;
            }
        }

        async function loadWebhookStatus() {
            try {
                const response = await axios.get('/monitoring/webhook/info');
                const data = response.data;

                const html = `
                    <div class="metric">
                        <span class="metric-label">Webhook URL</span>
                        <span class="metric-value">${data.url ? 'Set' : 'Not Set'}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Pending Updates</span>
                        <span class="metric-value">${data.pending_update_count}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Last Error</span>
                        <span class="metric-value">${data.last_error_message || 'None'}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Max Connections</span>
                        <span class="metric-value">${data.max_connections}</span>
                    </div>
                `;

                document.getElementById('webhook-status').innerHTML = html;
            } catch (error) {
                document.getElementById('webhook-status').innerHTML = `<div class="error">Error loading webhook status: ${error.message}</div>`;
            }
        }

        // Cleanup on page unload
        window.addEventListener('beforeunload', function() {
            if (updateInterval) {
                clearInterval(updateInterval);
            }
        });
    </script>
</body>
</html>
    """

    from fastapi.responses import HTMLResponse

    return HTMLResponse(content=dashboard_html)


@router.get("/circuit-breakers")
async def get_circuit_breaker_status() -> JSONResponse:
    """
    Get status of all circuit breakers.

    Returns:
        JSONResponse with circuit breaker statuses
    """
    try:
        status = get_cb_status()
        return JSONResponse(
            content={
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "circuit_breakers": status,
                "total_breakers": len(status),
            }
        )
    except Exception as e:
        logger.error(f"Error getting circuit breaker status: {e}")
        raise HTTPException(
            status_code=500, detail="Failed to get circuit breaker status"
        )


@router.post("/circuit-breakers/reset/{endpoint}")
async def reset_specific_circuit_breaker(endpoint: str) -> JSONResponse:
    """
    Reset a specific circuit breaker.

    Args:
        endpoint: The circuit breaker endpoint to reset

    Returns:
        JSONResponse with reset result
    """
    try:
        success = reset_circuit_breaker(endpoint)
        if success:
            return JSONResponse(
                content={
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "message": f"Circuit breaker reset for endpoint: {endpoint}",
                    "success": True,
                }
            )
        else:
            return JSONResponse(
                content={
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "message": f"Circuit breaker not found for endpoint: {endpoint}",
                    "success": False,
                }
            )
    except Exception as e:
        logger.error(f"Error resetting circuit breaker {endpoint}: {e}")
        raise HTTPException(status_code=500, detail="Failed to reset circuit breaker")


@router.post("/circuit-breakers/reset-all")
async def reset_all_circuit_breakers_endpoint() -> JSONResponse:
    """
    Reset all circuit breakers.

    Returns:
        JSONResponse with reset result
    """
    try:
        reset_count = reset_all_circuit_breakers()
        return JSONResponse(
            content={
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "message": f"Reset {reset_count} circuit breakers",
                "success": True,
                "reset_count": reset_count,
            }
        )
    except Exception as e:
        logger.error(f"Error resetting all circuit breakers: {e}")
        raise HTTPException(status_code=500, detail="Failed to reset circuit breakers")
