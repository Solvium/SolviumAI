"""
Health check endpoints for monitoring application status.
"""
import logging
import asyncio
from datetime import datetime, timezone
from typing import Dict, Any

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from api.main import get_bot_instance
from utils.config import Config
from utils.redis_client import RedisClient

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/")
async def health_check() -> JSONResponse:
    """
    Basic health check endpoint.
    
    Returns:
        JSONResponse with basic health status
    """
    return JSONResponse(content={
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "service": "solvium-quiz-bot",
        "version": "1.0.0"
    })


@router.get("/detailed")
async def detailed_health_check() -> JSONResponse:
    """
    Detailed health check including all service dependencies.
    
    Returns:
        JSONResponse with detailed health status
    """
    health_status = {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "service": "solvium-quiz-bot",
        "version": "1.0.0",
        "environment": "development" if Config.is_development() else "production",
        "services": {}
    }
    
    overall_healthy = True
    
    # Check bot status
    try:
        bot = get_bot_instance()
        if bot and hasattr(bot, 'app') and bot.app:
            bot_status = "healthy"
            bot_details = {
                "status": "running",
                "application_running": bot.app.running if hasattr(bot.app, 'running') else "unknown"
            }
        else:
            bot_status = "unhealthy"
            bot_details = {"status": "not_available"}
            overall_healthy = False
            
        health_status["services"]["telegram_bot"] = {
            "status": bot_status,
            "details": bot_details
        }
    except Exception as e:
        health_status["services"]["telegram_bot"] = {
            "status": "error",
            "details": {"error": str(e)}
        }
        overall_healthy = False
    
    # Check Redis status
    try:
        redis_instance = await RedisClient.get_instance()
        if redis_instance:
            # Try to ping Redis
            await redis_instance.ping()
            redis_status = "healthy"
            redis_details = {"status": "connected"}
        else:
            redis_status = "unhealthy"
            redis_details = {"status": "not_connected"}
            overall_healthy = False
            
        health_status["services"]["redis"] = {
            "status": redis_status,
            "details": redis_details
        }
    except Exception as e:
        health_status["services"]["redis"] = {
            "status": "error",
            "details": {"error": str(e)}
        }
        overall_healthy = False
    
    # Check database status (if using database)
    try:
        from store.database import test_connection
        if await test_connection():
            db_status = "healthy"
            db_details = {"status": "connected"}
        else:
            db_status = "unhealthy"
            db_details = {"status": "connection_failed"}
            overall_healthy = False
            
        health_status["services"]["database"] = {
            "status": db_status,
            "details": db_details
        }
    except ImportError:
        # Database test function doesn't exist
        health_status["services"]["database"] = {
            "status": "unknown",
            "details": {"status": "test_function_not_available"}
        }
    except Exception as e:
        health_status["services"]["database"] = {
            "status": "error",
            "details": {"error": str(e)}
        }
        overall_healthy = False
    
    # Update overall status
    if not overall_healthy:
        health_status["status"] = "unhealthy"
    
    status_code = 200 if overall_healthy else 503
    return JSONResponse(content=health_status, status_code=status_code)


@router.get("/liveness")
async def liveness_probe() -> JSONResponse:
    """
    Kubernetes liveness probe endpoint.
    
    Returns:
        JSONResponse indicating if the application is alive
    """
    return JSONResponse(content={
        "status": "alive",
        "timestamp": datetime.now(timezone.utc).isoformat()
    })


@router.get("/readiness")
async def readiness_probe() -> JSONResponse:
    """
    Kubernetes readiness probe endpoint.
    
    Returns:
        JSONResponse indicating if the application is ready to serve traffic
    """
    try:
        # Check if bot is ready
        bot = get_bot_instance()
        bot_ready = bot is not None and hasattr(bot, 'app') and bot.app is not None
        
        if bot_ready:
            return JSONResponse(content={
                "status": "ready",
                "timestamp": datetime.now(timezone.utc).isoformat()
            })
        else:
            return JSONResponse(
                content={
                    "status": "not_ready",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "reason": "bot_not_initialized"
                },
                status_code=503
            )
    except Exception as e:
        logger.error(f"Error in readiness probe: {e}")
        return JSONResponse(
            content={
                "status": "not_ready",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "reason": str(e)
            },
            status_code=503
        )
