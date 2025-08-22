"""
Optimized main entry point for the SolviumAI Quiz Bot with performance enhancements.
This script initializes all services with performance optimizations enabled.
"""

import asyncio
import logging
import sys
import os
from datetime import datetime

# Add the src directory to the Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from utils.config import Config, ENVIRONMENT
from utils.logger import setup_logger
from utils.redis_client import RedisClient
from services.performance_service import performance_service, bulk_manager
from store.database import init_db, migrate_schema

# Set up logging
logger = setup_logger(__name__)

# Global references
bot_instance = None
fastapi_server = None


async def initialize_optimized_services():
    """Initialize all services with performance optimizations."""
    try:
        logger.info("🚀 Starting SolviumAI Quiz Bot with performance optimizations...")

        # Initialize database if needed
        if "postgresql" in Config.DATABASE_URL or "postgres" in Config.DATABASE_URL:
            logger.info("Attempting to migrate database schema for PostgreSQL...")
            # migrate_schema()
        # init_db()

        # Initialize Redis connection
        logger.info("📡 Initializing Redis connection...")
        redis_client = await RedisClient.get_instance()
        await redis_client.ping()
        logger.info("✅ Redis connection established successfully")

        # Initialize performance monitoring
        logger.info("📊 Setting up performance monitoring...")
        await performance_service.record_metric(
            {
                "endpoint": "startup",
                "method": "INIT",
                "response_time_ms": 0.0,
                "status_code": 200,
                "timestamp": datetime.now(),
            }
        )
        logger.info("✅ Performance monitoring initialized")

        # Initialize database service
        logger.info("🗄️ Initializing database service...")
        try:
            from services.database_service import db_service

            if db_service.async_session:
                logger.info("✅ Database service initialized successfully")
            else:
                logger.warning("⚠️ Database service initialization had issues")
        except Exception as e:
            logger.error(f"❌ Database service initialization failed: {e}")

        # Initialize optimized services
        logger.info("🔧 Initializing optimized services...")

        # Import optimized services to register them
        from services.user_service_optimized import optimized_user_service
        from services.quiz_service_optimized import hp_quiz_service

        logger.info("✅ Optimized services loaded successfully")

        # Start bulk operation manager
        logger.info("📦 Starting bulk operation manager...")
        # Note: bulk_manager runs automatically when operations are added
        logger.info("✅ Bulk operation manager ready")

    except Exception as e:
        logger.error(f"❌ Failed to initialize optimized services: {e}")
        raise


async def start_fastapi_mode():
    """Start the bot in FastAPI webhook mode with optimizations."""
    global bot_instance, fastapi_server

    try:
        # Import FastAPI dependencies
        import uvicorn
        from api.main import app, set_bot_instance

        if not app:
            raise RuntimeError("FastAPI application not available")

        logger.info("🌐 Starting in FastAPI webhook mode with optimizations...")

        # Initialize optimized services first
        await initialize_optimized_services()

        # Initialize bot
        from bot.telegram_bot import TelegramBot

        # Initialize Telegram bot for FastAPI webhook mode
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

        # Register handlers
        bot_instance.register_handlers()

        # Set up bot instance in FastAPI
        set_bot_instance(bot_instance)

        # Start the bot (this will set up webhook with Telegram)
        # In FastAPI mode, the bot should run in the background and not block
        bot_start_task = asyncio.create_task(bot_instance.start())

        # Start FastAPI server with optimized settings
        config = uvicorn.Config(
            app=app,
            host=Config.FASTAPI_HOST,
            port=Config.FASTAPI_PORT,
            # reload=Config.is_development() and Config.FASTAPI_RELOAD,
            workers=1,  # Use 1 worker for development, scale in production
            loop="uvloop" if Config.is_development() else "asyncio",
            http="httptools" if Config.is_development() else "h11",
            access_log=Config.is_development(),
            use_colors=Config.is_development(),
            log_level="info" if Config.is_development() else "warning",
            ssl_keyfile=(
                Config.SSL_PRIVATE_KEY_PATH if Config.SSL_PRIVATE_KEY_PATH else None
            ),
            ssl_certfile=Config.SSL_CERT_PATH if Config.SSL_CERT_PATH else None,
        )

        server = uvicorn.Server(config)
        fastapi_server = server

        logger.info(
            f"🚀 FastAPI server starting on {Config.FASTAPI_HOST}:{Config.FASTAPI_PORT}"
        )
        logger.info("🔥 Performance optimizations enabled!")
        logger.info("📈 Monitoring available at /monitoring/status")
        logger.info("⚡ Real-time metrics at /monitoring/metrics/realtime")

        # Start FastAPI server
        # server_task = asyncio.create_task(server.serve())

        # In FastAPI mode, only wait for the server to serve
        # The bot task will run in the background and handle webhook requests
        await server.serve()

    except ImportError as e:
        logger.error(f"❌ FastAPI dependencies not available: {e}")
        logger.error("💡 Install with: pip install fastapi uvicorn httpx")
        logger.info("🔄 Falling back to legacy mode...")
        await start_legacy_mode()
    except Exception as e:
        logger.error(f"❌ Failed to start FastAPI mode: {e}")
        raise


async def start_legacy_mode():
    """Start the bot in legacy webhook mode with basic optimizations."""
    global bot_instance

    try:
        logger.info("🔄 Starting legacy webhook mode with basic optimizations...")

        # Initialize basic services
        await initialize_optimized_services()

        # Initialize bot
        from bot.telegram_bot import TelegramBot

        # Check if WEBHOOK_URL is defined and not empty in Config
        if hasattr(Config, "WEBHOOK_URL") and Config.WEBHOOK_URL:
            webhook_listen_ip = getattr(Config, "WEBHOOK_LISTEN_IP", "0.0.0.0")
            webhook_port = int(getattr(Config, "WEBHOOK_PORT", 8443))
            # Use TELEGRAM_TOKEN as default webhook path if WEBHOOK_URL_PATH is not set or is empty
            config_url_path = getattr(Config, "WEBHOOK_URL_PATH", None)
            webhook_url_path = (
                config_url_path if config_url_path else Config.TELEGRAM_TOKEN
            )
            # Get certificate and key paths for SSL
            certificate_path = getattr(Config, "SSL_CERT_PATH", None)
            private_key_path = getattr(Config, "SSL_PRIVATE_KEY_PATH", None)

            # Define port range for retry (webhook_port to webhook_port + 10)
            webhook_port_max = webhook_port + 10
            logger.info(
                f"Initializing bot in LEGACY WEBHOOK mode. URL: {Config.WEBHOOK_URL}, Port: {webhook_port} (with retries up to {webhook_port_max})"
            )
            logger.info(
                f"Certificate path: {certificate_path}, Private key path: {private_key_path}"
            )

            bot_instance = TelegramBot(
                token=Config.TELEGRAM_TOKEN,  # type: ignore
                webhook_url=Config.WEBHOOK_URL,  # Full base URL for the webhook (e.g., https://your.domain.com)
                webhook_listen_ip=webhook_listen_ip,  # IP address to listen on (e.g., 0.0.0.0)
                webhook_port=webhook_port,  # Port to listen on (e.g., 8443)
                webhook_url_path=webhook_url_path,  # Path for the webhook (e.g., /your-bot-token) # type: ignore
                use_fastapi_webhook=False,  # Use legacy webhook mode
            )
        else:
            logger.info(
                "Initializing bot with polling (WEBHOOK_URL not configured or empty)."
            )
            bot_instance = TelegramBot(token=Config.TELEGRAM_TOKEN)  # type: ignore

        bot_instance.register_handlers()
        await bot_instance.start()  # This method in TelegramBot should handle either polling or webhook start

        logger.info("✅ Bot started in legacy webhook mode with optimizations")

        # Keep the application running
        while True:
            await asyncio.sleep(1)

    except KeyboardInterrupt:
        logger.info("🛑 Received shutdown signal")
    except Exception as e:
        logger.error(f"❌ Failed to start legacy mode: {e}")
        raise


async def cleanup_on_shutdown():
    """Clean up resources on shutdown."""
    try:
        logger.info("🧹 Cleaning up resources...")

        # Flush any pending bulk operations
        try:
            await bulk_manager.flush_operations()
            logger.info("✅ Bulk operations flushed")
        except Exception as e:
            logger.error(f"❌ Error flushing bulk operations: {e}")

        # Close Redis connection
        try:
            await RedisClient.close()
            logger.info("✅ Redis connection closed")
        except Exception as e:
            logger.error(f"❌ Error closing Redis connection: {e}")

        # Close HTTP client if exists
        try:
            from api.main import http_client

            if http_client:
                await http_client.aclose()
                logger.info("✅ HTTP client closed")
        except Exception as e:
            logger.error(f"❌ Error closing HTTP client: {e}")

        logger.info("✅ Cleanup completed")

    except Exception as e:
        logger.error(f"❌ Error during cleanup: {e}")


def print_startup_banner():
    """Print a startup banner with configuration info."""
    banner = f"""
╔══════════════════════════════════════════════════════════════╗
║                    SolviumAI Quiz Bot                        ║
║                   Performance Optimized                     ║
╠══════════════════════════════════════════════════════════════╣
║ Environment: {ENVIRONMENT:<45} ║
║ Mode: {'FastAPI Webhook' if Config.USE_FASTAPI_WEBHOOK else 'Legacy Webhook':<49} ║
║ Redis: {'Local' if Config.is_development() else 'Remote':<50} ║
║ Database: PostgreSQL                                         ║
║ Optimizations: ✅ Enabled                                    ║
╚══════════════════════════════════════════════════════════════╝

🚀 Features enabled:
   • Sub-second webhook responses
   • Intelligent caching with Redis
   • Connection pooling
   • Background task processing
   • Real-time performance monitoring
   • Batch operations for efficiency

📊 Monitoring endpoints:
   • /monitoring/status - System status
   • /monitoring/performance - Performance metrics
   • /monitoring/cache/stats - Cache statistics
   • /monitoring/metrics/realtime - Real-time metrics

⚡ Ready for high-performance quiz gameplay!
    """
    print(banner)


async def main():
    """Main entry point with optimized startup sequence."""
    global bot_instance

    try:
        # Print startup banner
        print_startup_banner()

        # Determine which mode to use
        use_fastapi = False

        # Check if FastAPI should be used
        if hasattr(Config, "USE_FASTAPI_WEBHOOK") and Config.USE_FASTAPI_WEBHOOK:
            use_fastapi = True
            logger.info("FastAPI webhook mode enabled via USE_FASTAPI_WEBHOOK config.")
        elif Config.WEBHOOK_URL and not hasattr(Config, "USE_FASTAPI_WEBHOOK"):
            # Default to FastAPI in production if webhook is configured
            use_fastapi = not Config.is_development()
            logger.info(
                f"Auto-detecting mode: {'FastAPI' if use_fastapi else 'Legacy'} (Environment: {'Production' if not Config.is_development() else 'Development'})"
            )

        # Start in the appropriate mode with optimizations
        if use_fastapi and Config.WEBHOOK_URL:
            await start_fastapi_mode()
        else:
            await start_legacy_mode()

    except KeyboardInterrupt:
        logger.info("🛑 Received shutdown signal (Ctrl+C)")
    except Exception as e:
        logger.error(f"❌ Fatal error during startup: {e}")
        sys.exit(1)
    finally:
        # Clean up resources
        await cleanup_on_shutdown()
        logger.info("👋 SolviumAI Quiz Bot shutdown complete")


if __name__ == "__main__":

    try:
        # Use uvloop for better performance on Linux/macOS
        try:
            import uvloop

            uvloop.install()
            logger.info("🔄 Using uvloop for enhanced performance")
        except ImportError:
            logger.info("🔄 Using standard asyncio event loop")

        # Run the main application
        asyncio.run(main())

    except KeyboardInterrupt:
        logger.info("🛑 Application interrupted by user")
    except Exception as e:
        logger.error(f"❌ Critical error: {e}")
        sys.exit(1)
