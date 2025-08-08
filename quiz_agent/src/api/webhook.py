"""
Telegram webhook handler for FastAPI.
Processes incoming webhook updates from Telegram.
"""

import logging
from typing import Dict, Any

from fastapi import APIRouter, Request, HTTPException, Depends
from fastapi.responses import JSONResponse
from telegram import Update

from api.main import get_bot_instance
from utils.config import Config

logger = logging.getLogger(__name__)

router = APIRouter()


async def verify_telegram_webhook(request: Request) -> bool:
    """
    Verify that the request is actually coming from Telegram.
    This is a basic security check.
    """
    # You can implement more sophisticated verification here
    # For example, checking the X-Telegram-Bot-Api-Secret-Token header
    # or verifying the request signature

    # For now, we'll just check if the request has the expected path
    expected_path = f"/webhook/{Config.TELEGRAM_TOKEN}"
    return request.url.path == expected_path


@router.post("/{token}")
async def telegram_webhook(
    token: str, request: Request, update_data: Dict[str, Any]
) -> JSONResponse:
    """
    Handle incoming Telegram webhook updates.

    Args:
        token: The bot token from the URL path
        request: The FastAPI request object
        update_data: The JSON payload from Telegram

    Returns:
        JSONResponse indicating success or failure
    """
    try:
        # Verify the token matches our bot token
        if token != Config.TELEGRAM_TOKEN:
            logger.warning(f"Invalid token received in webhook: {token}")
            raise HTTPException(status_code=403, detail="Invalid token")

        # Get the bot instance
        bot = get_bot_instance()
        if not bot:
            logger.error("Bot instance not available for webhook processing")
            raise HTTPException(status_code=503, detail="Bot service unavailable")

        # Create Telegram Update object from the received data
        try:
            update = Update.de_json(update_data, bot.app.bot)
            if not update:
                logger.error("Failed to parse update from webhook data")
                raise HTTPException(status_code=400, detail="Invalid update format")
        except Exception as e:
            logger.error(f"Error parsing Telegram update: {e}")
            raise HTTPException(status_code=400, detail="Invalid update format")

        # Process the update using the bot's application
        try:
            await bot.app.process_update(update)
        except Exception as e:
            logger.error(
                f"Error processing update {update.update_id}: {e}", exc_info=True
            )

        return JSONResponse(content={"status": "ok"})

    except HTTPException:
        # Re-raise HTTP exceptions (these will be handled by FastAPI)
        raise
    except Exception as e:
        logger.error(f"Unexpected error in webhook handler: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/status")
async def webhook_status() -> JSONResponse:
    """
    Get the status of the webhook endpoint.

    Returns:
        JSONResponse with webhook status information
    """
    bot = get_bot_instance()

    return JSONResponse(
        content={
            "status": "active",
            "bot_available": bot is not None,
            "webhook_url": Config.WEBHOOK_URL,
            "environment": "development" if Config.is_development() else "production",
        }
    )


@router.post("/set")
async def set_webhook() -> JSONResponse:
    """
    Set up the Telegram webhook programmatically.
    This endpoint can be called to register the webhook with Telegram.

    Returns:
        JSONResponse indicating success or failure
    """
    try:
        bot = get_bot_instance()
        if not bot:
            raise HTTPException(status_code=503, detail="Bot service unavailable")

        webhook_url = f"{Config.WEBHOOK_URL}/webhook/{Config.TELEGRAM_TOKEN}"

        # Set the webhook
        success = await bot.app.bot.set_webhook(
            url=webhook_url,
            allowed_updates=["message", "callback_query", "poll_answer"],
            drop_pending_updates=True,
        )

        if success:
            logger.info(f"Webhook set successfully: {webhook_url}")
            return JSONResponse(
                content={
                    "status": "success",
                    "webhook_url": webhook_url,
                    "message": "Webhook set successfully",
                }
            )
        else:
            logger.error("Failed to set webhook")
            raise HTTPException(status_code=500, detail="Failed to set webhook")

    except Exception as e:
        logger.error(f"Error setting webhook: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/delete")
async def delete_webhook() -> JSONResponse:
    """
    Delete the Telegram webhook.

    Returns:
        JSONResponse indicating success or failure
    """
    try:
        bot = get_bot_instance()
        if not bot:
            raise HTTPException(status_code=503, detail="Bot service unavailable")

        # Delete the webhook
        success = await bot.app.bot.delete_webhook(drop_pending_updates=True)

        if success:
            logger.info("Webhook deleted successfully")
            return JSONResponse(
                content={"status": "success", "message": "Webhook deleted successfully"}
            )
        else:
            logger.error("Failed to delete webhook")
            raise HTTPException(status_code=500, detail="Failed to delete webhook")

    except Exception as e:
        logger.error(f"Error deleting webhook: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
