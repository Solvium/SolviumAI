"""
FastAPI application for webhook handling.
"""

import asyncio
import time
import sys
import os
import logging
import uvicorn
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from telegram import Update
from telegram.ext import Application

# Add the src directory to the Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.config import Config

logger = logging.getLogger(__name__)

import logging
import time
from contextlib import asynccontextmanager
from typing import Dict, Any

# Try importing FastAPI with fallback handling
try:
    from fastapi import FastAPI, Request, Response
    from fastapi.middleware.cors import CORSMiddleware
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

    class CORSMiddleware:
        pass

    class JSONResponse:
        pass


from utils.config import Config

logger = logging.getLogger(__name__)

# Global reference to bot instance for webhook handling
bot_instance = None


@asynccontextmanager
async def lifespan(app):
    """Handle application startup and shutdown events."""
    # Startup
    logger.info("FastAPI application starting up...")

    # Initialize services here if needed
    yield

    # Shutdown
    logger.info("FastAPI application shutting down...")

    # Cleanup services here if needed
    if bot_instance and hasattr(bot_instance, "stop"):
        try:
            await bot_instance.stop()
            logger.info("Bot instance stopped during FastAPI shutdown.")
        except Exception as e:
            logger.error(f"Error stopping bot during FastAPI shutdown: {e}")


def create_app():
    """Create and configure FastAPI application."""
    if not FASTAPI_AVAILABLE:
        logger.error(
            "FastAPI is not available. Please install it: pip install fastapi uvicorn"
        )
        raise ImportError("FastAPI not available")

    app = FastAPI(
        title="SolviumAI Quiz Bot API",
        description="FastAPI backend for Telegram Quiz Bot with webhook support",
        version="1.0.0",
        docs_url="/docs" if Config.is_development() else None,
        redoc_url="/redoc" if Config.is_development() else None,
        lifespan=lifespan,
    )

    # Add CORS middleware
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
            status_code=500, content={"detail": "Internal server error"}
        )

    @app.middleware("http")
    async def log_requests(request: Request, call_next):
        """Log all HTTP requests."""
        start_time = time.time()

        # Log request
        logger.info(f"Incoming request: {request.method} {request.url}")

        response = await call_next(request)

        # Log response
        process_time = time.time() - start_time
        logger.info(
            f"Response: {response.status_code} | "
            f"Processing time: {process_time:.3f}s"
        )

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
