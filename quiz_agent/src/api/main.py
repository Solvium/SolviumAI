"""
FastAPI application for webhook handling with performance optimizations.
"""

import asyncio
import time
import sys
import os
import logging
import httpx
from contextlib import asynccontextmanager
from typing import Optional, Dict, Any

# Try importing FastAPI with fallback handling
try:
    from fastapi import FastAPI, Request, Response, BackgroundTasks
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.middleware.gzip import GZipMiddleware
    from fastapi.middleware.trustedhost import TrustedHostMiddleware
    from fastapi.responses import JSONResponse

    FASTAPI_AVAILABLE = True
except ImportError:
    FASTAPI_AVAILABLE = False

    # Create dummy classes to prevent import errors
    class FastAPI:
        pass

    class Request:
        pass

    class Response:
        pass

    class BackgroundTasks:
        pass

    class CORSMiddleware:
        pass

    class JSONResponse:
        pass

# Add the src directory to the Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.config import Config
from utils.redis_client import RedisClient

logger = logging.getLogger(__name__)

# Global reference to bot instance for webhook handling
bot_instance = None

# Global HTTP client with connection pooling for performance
http_client: Optional[httpx.AsyncClient] = None

# Cache for frequently accessed data
app_cache: Dict[str, Any] = {}


async def init_http_client():
    """Initialize global HTTP client with optimized connection pooling."""
    global http_client
    if http_client is None:
        http_client = httpx.AsyncClient(
            limits=httpx.Limits(
                max_keepalive_connections=20,
                max_connections=100,
                keepalive_expiry=30.0
            ),
            timeout=httpx.Timeout(
                connect=5.0,
                read=10.0,
                write=5.0,
                pool=5.0
            ),
            follow_redirects=True
        )
        logger.info("HTTP client initialized with connection pooling")


async def close_http_client():
    """Close the global HTTP client."""
    global http_client
    if http_client:
        await http_client.aclose()
        http_client = None
        logger.info("HTTP client closed")


async def preload_resources():
    """Preload frequently used data and warm up connections."""
    try:
        # Warm up Redis connection
        redis_client = await RedisClient.get_instance()
        await redis_client.ping()
        logger.info("Redis connection warmed up")
        
        # Preload common quiz topics to cache
        common_topics = ["gamers", "technology", "science", "sports", "entertainment"]
        cache_key = "quiz_topics_common"
        await RedisClient.set_value(cache_key, common_topics, ttl_seconds=3600)
        
        # Cache common bot responses
        common_responses = {
            "welcome": "🎯 Welcome to SolviumAI Quiz Bot!",
            "quiz_started": "🚀 Quiz started! Get ready...",
            "quiz_ended": "🏁 Quiz completed! Check your results."
        }
        for key, value in common_responses.items():
            await RedisClient.set_value(f"response_{key}", value, ttl_seconds=7200)
        
        # Initialize database connection pool
        from services.database_service import DatabaseService
        db_service = DatabaseService()
        if db_service.async_session:
            logger.info("Database connection pool initialized")
        
        logger.info("Resource preloading completed successfully")
        
    except Exception as e:
        logger.error(f"Error during resource preloading: {e}")


@asynccontextmanager
async def lifespan(app):
    """Handle application startup and shutdown events with optimizations."""
    # Startup
    logger.info("FastAPI application starting up with performance optimizations...")
    
    # Initialize HTTP client
    await init_http_client()
    
    # Preload resources
    await preload_resources()
    
    logger.info("FastAPI application startup completed")
    
    yield
    
    # Shutdown
    logger.info("FastAPI application shutting down...")
    
    # Close HTTP client
    await close_http_client()
    
    # Close Redis connection
    await RedisClient.close()
    
    # Cleanup bot instance
    if bot_instance and hasattr(bot_instance, "stop"):
        try:
            await bot_instance.stop()
            logger.info("Bot instance stopped during FastAPI shutdown.")
        except Exception as e:
            logger.error(f"Error stopping bot during FastAPI shutdown: {e}")
    
    logger.info("FastAPI application shutdown completed")


def create_app():
    """Create and configure FastAPI application with performance optimizations."""
    if not FASTAPI_AVAILABLE:
        logger.error(
            "FastAPI is not available. Please install it: pip install fastapi uvicorn"
        )
        raise ImportError("FastAPI not available")

    app = FastAPI(
        title="SolviumAI Quiz Bot API",
        description="High-performance FastAPI backend for Telegram Quiz Bot",
        version="1.0.0",
        docs_url="/docs" if Config.is_development() else None,
        redoc_url="/redoc" if Config.is_development() else None,
        lifespan=lifespan,
    )

    # Add performance-oriented middleware (order matters!)
    
    # 1. Trusted host middleware (security)
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=["*"] if Config.is_development() else [
            Config.WEBHOOK_URL.replace("https://", "").replace("http://", ""),
            "t.me"
        ]
    )
    
    # 2. GZip compression (reduce bandwidth)
    app.add_middleware(GZipMiddleware, minimum_size=1000)
    
    # 3. CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"] if Config.is_development() else ["https://t.me"],
        allow_credentials=True,
        allow_methods=["GET", "POST"],
        allow_headers=["*"],
    )

    # Include routers only if FastAPI is available
    try:
        from api.webhook import router as webhook_router
        from api.routes.health import router as health_router
        from api.routes.monitoring import router as monitoring_router

        app.include_router(webhook_router, prefix="/webhook", tags=["webhook"])
        app.include_router(health_router, prefix="/health", tags=["health"])
        app.include_router(monitoring_router, prefix="/monitoring", tags=["monitoring"])
    except ImportError as e:
        logger.error(f"Failed to import routers: {e}")

    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        """Global exception handler for unhandled errors."""
        logger.error(f"Unhandled exception in FastAPI: {exc}", exc_info=True)
        return JSONResponse(
            status_code=500, 
            content={"detail": "Internal server error"}
        )

    @app.middleware("http")
    async def optimized_logging_middleware(request: Request, call_next):
        """High-performance logging middleware with minimal overhead."""
        start_time = time.perf_counter()
        
        # Skip logging for health checks in production
        if not Config.is_development() and request.url.path in ["/health", "/health/ready"]:
            return await call_next(request)
        
        # Log request (minimal info for performance)
        logger.info(f"Incoming request: {request.method} {request.url}")

        response = await call_next(request)

        # Calculate processing time
        process_time = (time.perf_counter() - start_time) * 1000
        
        # Log response with performance metrics
        logger.info(
            f"Response: {response.status_code} | "
            f"Processing time: {process_time:.2f}ms"
        )
        
        # Log warning for slow requests
        if process_time > 1000:  # > 1 second
            logger.warning(f"Slow request detected: {process_time:.2f}ms - {request.url}")

        # Add performance headers for monitoring
        response.headers["X-Process-Time"] = f"{process_time:.2f}ms"
        
        return response

    return app


def set_bot_instance(bot):
    """Set the global bot instance for webhook handling."""
    global bot_instance
    bot_instance = bot
    logger.info("Bot instance set in FastAPI application.")


def get_bot_instance():
    """Get the global bot instance."""
    return bot_instance


# Create the FastAPI app instance (only if FastAPI is available)
if FASTAPI_AVAILABLE:
    app = create_app()
else:
    app = None
    logger.warning("FastAPI not available - app instance not created")
