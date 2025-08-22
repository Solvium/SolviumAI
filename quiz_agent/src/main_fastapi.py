#!/usr/bin/env python3
"""
FastAPI main entry point for SolviumAI Quiz Bot.
This module starts the FastAPI server with webhook support.
"""
import sys
import os
import asyncio
import logging
from contextlib import asynccontextmanager

# Add src directory to sys.path for module resolution
sys.path.append(os.path.dirname(__file__))

# Configure logging first
logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)

# Import after path setup
from utils.config import Config
from bot.telegram_bot import TelegramBot
from store.database import init_db, migrate_schema
from utils.redis_client import RedisClient
from api.main import app, set_bot_instance

logger = logging.getLogger(__name__)

# Global reference to bot instance
bot_instance = None


async def initialize_services():
    """Initialize all required services."""
    global bot_instance

    logger.info("Initializing services for FastAPI mode...")

    # Initialize database if needed
    if "postgresql" in Config.DATABASE_URL or "postgres" in Config.DATABASE_URL:
        logger.info("Attempting to migrate database schema for PostgreSQL...")
        migrate_schema()
    init_db()

    # Initialize Redis
    try:
        redis_instance = await RedisClient.get_instance()
        if redis_instance:
            logger.info("Successfully connected to Redis.")
        else:
            logger.error("Failed to get Redis instance.")
    except Exception as e:
        logger.error(f"Failed to connect to Redis: {e}. Continuing without Redis.")

    # Initialize Telegram bot for FastAPI webhook mode
    if Config.WEBHOOK_URL:
        webhook_listen_ip = Config.WEBHOOK_LISTEN_IP
        webhook_port = int(Config.WEBHOOK_PORT)
        webhook_url_path = Config.WEBHOOK_URL_PATH or Config.TELEGRAM_TOKEN

        logger.info(
            f"Initializing bot for FastAPI webhook mode. URL: {Config.WEBHOOK_URL}"
        )

        bot_instance = TelegramBot(
            token=Config.TELEGRAM_TOKEN,
            webhook_url=Config.WEBHOOK_URL,
            webhook_listen_ip=webhook_listen_ip,
            webhook_port=webhook_port,
            webhook_url_path=webhook_url_path,
            use_fastapi_webhook=True,  # Enable FastAPI webhook mode
        )
    else:
        logger.info("Initializing bot for polling mode.")
        bot_instance = TelegramBot(token=Config.TELEGRAM_TOKEN)

    # Register handlers
    bot_instance.register_handlers()

    # Set bot instance in FastAPI app
    set_bot_instance(bot_instance)

    # Start the bot (this will set up webhook with Telegram if in webhook mode)
    await bot_instance.start()

    logger.info("Services initialized successfully.")


async def cleanup_services():
    """Cleanup all services."""
    global bot_instance

    logger.info("Cleaning up services...")

    # Stop bot
    if bot_instance and hasattr(bot_instance, "stop"):
        try:
            await bot_instance.stop()
            logger.info("Bot stopped successfully.")
        except Exception as e:
            logger.error(f"Error stopping bot: {e}")

    # Close Redis
    try:
        await RedisClient.close()
        logger.info("Redis connection closed.")
    except Exception as e:
        logger.error(f"Error closing Redis: {e}")

    logger.info("Cleanup completed.")


@asynccontextmanager
async def lifespan_handler(app):
    """Handle FastAPI application lifespan events."""
    # Startup
    await initialize_services()
    yield
    # Shutdown
    await cleanup_services()


# Override the lifespan in the FastAPI app
app.router.lifespan_context = lifespan_handler


async def main_fastapi():
    """Main function for FastAPI mode."""
    try:
        # Import uvicorn here to avoid import errors if not installed
        import uvicorn

        logger.info("Starting FastAPI server...")

        # Configure uvicorn
        config = uvicorn.Config(
            app=app,
            host=Config.FASTAPI_HOST,
            port=Config.FASTAPI_PORT,
            reload=Config.FASTAPI_RELOAD and Config.is_development(),
            workers=Config.FASTAPI_WORKERS if not Config.is_development() else 1,
            log_level="info",
            ssl_keyfile=(
                Config.SSL_PRIVATE_KEY_PATH if Config.SSL_PRIVATE_KEY_PATH else None
            ),
            ssl_certfile=Config.SSL_CERT_PATH if Config.SSL_CERT_PATH else None,
        )

        server = uvicorn.Server(config)
        await server.serve()

    except ImportError:
        logger.error("uvicorn is not installed. Please install it: pip install uvicorn")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Error starting FastAPI server: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    try:
        asyncio.run(main_fastapi())
    except KeyboardInterrupt:
        logger.info("FastAPI server stopped by user.")
    except Exception as e:
        logger.error(f"Unhandled exception: {e}", exc_info=True)
        sys.exit(1)
