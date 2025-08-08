"""
FastAPI application main module.
Handles web server setup and routing.
"""
import logging
from contextlib import asynccontextmanager
from typing import Dict, Any

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from utils.config import Config
from utils.logger import setup_logging

# Import routers
from api.webhook import router as webhook_router
from api.routes.health import router as health_router
from api.routes.monitoring import router as monitoring_router

logger = logging.getLogger(__name__)

# Global reference to bot instance for webhook handling
bot_instance = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle application startup and shutdown events."""
    # Startup
    logger.info("FastAPI application starting up...")
    
    # Initialize services here if needed
    yield
    
    # Shutdown
    logger.info("FastAPI application shutting down...")
    
    # Cleanup services here if needed
    if bot_instance and hasattr(bot_instance, 'stop'):
        try:
            await bot_instance.stop()
            logger.info("Bot instance stopped during FastAPI shutdown.")
        except Exception as e:
            logger.error(f"Error stopping bot during FastAPI shutdown: {e}")


def create_app() -> FastAPI:
    """Create and configure FastAPI application."""
    app = FastAPI(
        title="SolviumAI Quiz Bot API",
        description="FastAPI backend for Telegram Quiz Bot with webhook support",
        version="1.0.0",
        docs_url="/docs" if Config.is_development() else None,
        redoc_url="/redoc" if Config.is_development() else None,
        lifespan=lifespan
    )
    
    # Add CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"] if Config.is_development() else ["https://t.me"],
        allow_credentials=True,
        allow_methods=["GET", "POST"],
        allow_headers=["*"],
    )
    
    # Include routers
    app.include_router(webhook_router, prefix="/webhook", tags=["webhook"])
    app.include_router(health_router, prefix="/health", tags=["health"])
    app.include_router(monitoring_router, prefix="/monitoring", tags=["monitoring"])
    
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        """Global exception handler for unhandled errors."""
        logger.error(f"Unhandled exception in FastAPI: {exc}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error"}
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


# Import time for middleware
import time

# Create the FastAPI app instance
app = create_app()
