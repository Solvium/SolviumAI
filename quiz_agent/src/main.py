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


async def main():
    """Start the bot and initialize necessary services."""
    global bot_instance

    # # Try to migrate schema if using PostgreSQL
    # if "postgresql" in Config.DATABASE_URL or "postgres" in Config.DATABASE_URL:
    #     logger.info("Attempting to migrate database schema for PostgreSQL...")
    # migrate_schema()

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

    # Start telegram bot
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
            f"Initializing bot in WEBHOOK mode. URL: {Config.WEBHOOK_URL}, Port: {webhook_port} (with retries up to {webhook_port_max})"
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
        )
    else:
        logger.info(
            "Initializing bot with polling (WEBHOOK_URL not configured or empty)."
        )
        bot_instance = TelegramBot(token=Config.TELEGRAM_TOKEN)  # type: ignore

    bot_instance.register_handlers()
    await bot_instance.start()  # This method in TelegramBot should handle either polling or webhook start


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
