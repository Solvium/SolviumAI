"""
Optimized startup script for the SolviumAI Quiz Bot with performance enhancements.
This script initializes all services with performance optimizations enabled.
"""

import asyncio
import logging
import sys
import os
from datetime import datetime

# Add the src directory to the Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from utils.config import Config
from utils.logger import setup_logger
from utils.redis_client import RedisClient
from services.performance_service import performance_service, bulk_manager

# Set up logging
logger = setup_logger(__name__)


async def initialize_optimized_services():
    """Initialize all services with performance optimizations."""
    try:
        logger.info("🚀 Starting SolviumAI Quiz Bot with performance optimizations...")

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
            from services.database_service import DatabaseService

            db_service = DatabaseService()
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

        # Initialize bot based on mode
        if Config.USE_FASTAPI_WEBHOOK:
            logger.info("🌐 Starting in FastAPI webhook mode with optimizations...")
            await start_fastapi_mode()
        else:
            logger.info("🔄 Starting in legacy webhook mode...")
            await start_legacy_mode()

    except Exception as e:
        logger.error(f"❌ Failed to initialize optimized services: {e}")
        raise


async def start_fastapi_mode():
    """Start the bot in FastAPI webhook mode with optimizations."""
    try:
        # Import FastAPI dependencies
        import uvicorn
        from api.main import app, set_bot_instance

        if not app:
            raise RuntimeError("FastAPI application not available")

        # Initialize bot
        from bot.telegram_bot import TelegramBot

        bot = TelegramBot()

        # Set up bot instance in FastAPI
        set_bot_instance(bot)

        # Initialize bot services
        await bot.initialize()

        # Start FastAPI server with optimized settings
        config = uvicorn.Config(
            app=app,
            host=Config.FASTAPI_HOST,
            port=Config.FASTAPI_PORT,
            reload=Config.is_development() and Config.FASTAPI_RELOAD,
            workers=1,  # Use 1 worker for development, scale in production
            loop="uvloop" if Config.is_development() else "asyncio",
            http="httptools" if Config.is_development() else "h11",
            access_log=Config.is_development(),
            use_colors=Config.is_development(),
            log_level="info" if Config.is_development() else "warning",
        )

        server = uvicorn.Server(config)
        logger.info(
            f"🚀 FastAPI server starting on {Config.FASTAPI_HOST}:{Config.FASTAPI_PORT}"
        )
        logger.info("🔥 Performance optimizations enabled!")
        logger.info("📈 Monitoring available at /monitoring/status")
        logger.info("⚡ Real-time metrics at /monitoring/metrics/realtime")

        # Start the server
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
    """Start the bot in legacy webhook mode."""
    try:
        logger.info("🔄 Starting legacy webhook mode...")

        # Initialize bot
        from bot.telegram_bot import TelegramBot

        bot = TelegramBot()

        # Initialize bot services
        await bot.initialize()

        # Start bot in webhook mode
        await bot.start_webhook_mode()

        logger.info("✅ Bot started in legacy webhook mode")

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
║ Environment: {Config.ENVIRONMENT:<45} ║
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
    try:
        # Print startup banner
        print_startup_banner()

        # Initialize optimized services
        await initialize_optimized_services()

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
