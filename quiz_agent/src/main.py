# Add src directory to sys.path for module resolution
import sys, os
import asyncio
import logging

sys.path.append(os.path.dirname(__file__))

# Configure logging first
logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)

# Application entrypoint
from utils.config import Config
from bot.telegram_bot import TelegramBot
from store.database import init_db, migrate_schema
from utils.redis_client import RedisClient  # Added import

logger = logging.getLogger(__name__)

# Keep a global reference to the bot for shutdown
bot_instance = None
fastapi_server = None


async def initialize_services():
    """Initialize all required services."""
    # Try to migrate schema if using PostgreSQL
    # if "postgresql" in Config.DATABASE_URL or "postgres" in Config.DATABASE_URL:
    #     logger.info("Attempting to migrate database schema for PostgreSQL...")
    #     migrate_schema()

    # Initialize database tables if they don't exist
    # init_db()

    # Try to connect to Redis
    try:
        redis_instance = await RedisClient.get_instance()
        if redis_instance:
            logger.info("Successfully connected to Redis and pinged the server.")
        else:
            logger.error(
                "Failed to get Redis instance, but no exception was raised. Check RedisClient logic."
            )
    except Exception as e:
        logger.error(
            f"Failed to connect to Redis: {e}. The application will continue without Redis.",
            exc_info=True,
        )


async def start_fastapi_mode():
    """Start the application in FastAPI mode."""
    global bot_instance, fastapi_server

    try:
        # Import FastAPI dependencies
        import uvicorn
        from api.main import app, set_bot_instance

        logger.info("Starting application in FastAPI mode...")

        # Initialize services
        await initialize_services()

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

        # Set bot instance in FastAPI app
        set_bot_instance(bot_instance)

        # Start the bot (this will set up webhook with Telegram)
        bot_start_task = asyncio.create_task(bot_instance.start())

        # Configure uvicorn
        config = uvicorn.Config(
            app=app,
            host=Config.FASTAPI_HOST,
            port=Config.FASTAPI_PORT,
            reload=Config.FASTAPI_RELOAD and Config.is_development(),
            workers=1,  # Always use 1 worker for webhook handling
            log_level="info",
            ssl_keyfile=(
                Config.SSL_PRIVATE_KEY_PATH if Config.SSL_PRIVATE_KEY_PATH else None
            ),
            ssl_certfile=Config.SSL_CERT_PATH if Config.SSL_CERT_PATH else None,
        )

        server = uvicorn.Server(config)

        logger.info(
            f"Starting FastAPI server on {Config.FASTAPI_HOST}:{Config.FASTAPI_PORT}"
        )

        # Start FastAPI server
        server_task = asyncio.create_task(server.serve())

        # Wait for both tasks
        await asyncio.gather(bot_start_task, server_task)

    except ImportError as e:
        logger.error("FastAPI dependencies not installed. Please install them:")
        logger.error("pip install fastapi uvicorn python-multipart")
        logger.error("Falling back to legacy webhook mode...")
        await start_legacy_mode()
    except Exception as e:
        logger.error(f"Error starting FastAPI mode: {e}", exc_info=True)
        raise


async def start_legacy_mode():
    """Start the application in legacy mode (original implementation)."""
    global bot_instance

    logger.info("Starting application in legacy mode...")

    # Initialize services
    await initialize_services()

    # Check if WEBHOOK_URL is defined and not empty in Config
    if hasattr(Config, "WEBHOOK_URL") and Config.WEBHOOK_URL:
        webhook_listen_ip = getattr(Config, "WEBHOOK_LISTEN_IP", "0.0.0.0")
        webhook_port = int(getattr(Config, "WEBHOOK_PORT", 8443))
        # Use TELEGRAM_TOKEN as default webhook path if WEBHOOK_URL_PATH is not set or is empty
        config_url_path = getattr(Config, "WEBHOOK_URL_PATH", None)
        webhook_url_path = config_url_path if config_url_path else Config.TELEGRAM_TOKEN
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


async def main():
    """Main entry point - automatically chooses between FastAPI and legacy mode."""
    global bot_instance

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

    # Start in the appropriate mode
    if use_fastapi and Config.WEBHOOK_URL:
        await start_fastapi_mode()
    else:
        await start_legacy_mode()


if __name__ == "__main__":

    loop = asyncio.get_event_loop()
    main_task = None  # To hold the main task

    try:
        main_task = loop.create_task(main())
        loop.run_until_complete(main_task)
    except KeyboardInterrupt:
        logger.info("Bot stopping due to KeyboardInterrupt...")
    except Exception as e:
        logger.error(f"Unhandled exception in main execution: {e}", exc_info=True)
    finally:
        if bot_instance and hasattr(bot_instance, "stop"):
            logger.info("Attempting to gracefully stop the bot...")
            try:
                # Ensure the loop is available to run the async stop method
                if loop.is_closed():
                    loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(loop)

                loop.run_until_complete(bot_instance.stop())
            except Exception as e_stop:
                logger.error(f"Error during bot stop: {e_stop}", exc_info=True)

        # Close Redis connection
        logger.info("Attempting to gracefully close Redis connection...")
        try:
            # Ensure loop is available for RedisClient.close()
            if loop.is_closed():
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
            loop.run_until_complete(RedisClient.close())
        except Exception as e_redis_close:
            logger.error(
                f"Error closing Redis connection: {e_redis_close}", exc_info=True
            )

        # Cancel the main task if it's still pending (e.g., KeyboardInterrupt)
        if main_task and not main_task.done():
            main_task.cancel()
            try:
                loop.run_until_complete(main_task)  # Allow cancellation to propagate
            except asyncio.CancelledError:
                logger.info("Main task cancelled.")
            except Exception as e_cancel:  # Log other errors during cancellation
                logger.error(f"Error cancelling main task: {e_cancel}", exc_info=True)

        logger.info("Bot shutdown process complete.")

        # Determine exit code
        exit_code = 0
        # Check if an exception occurred that wasn't KeyboardInterrupt
        if (
            "e" in locals()
            and isinstance(locals()["e"], Exception)
            and not isinstance(locals()["e"], KeyboardInterrupt)
        ):
            exit_code = 1
        sys.exit(exit_code)
