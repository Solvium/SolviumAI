"""
High-performance Telegram webhook handler for FastAPI.
Optimized for sub-second response times with background processing.
"""

import asyncio
import time
import logging
from typing import Dict, Any

from fastapi import APIRouter, Request, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
from telegram import Update

from api.main import get_bot_instance
from utils.config import Config
from utils.redis_client import RedisClient

logger = logging.getLogger(__name__)

router = APIRouter()


async def process_telegram_update_background(update_data: Dict[str, Any]):
    """
    Process Telegram update in background for optimal performance.
    This function handles all the heavy lifting without blocking the webhook response.
    """
    try:
        start_time = time.perf_counter()

        # Get bot instance
        bot = get_bot_instance()
        if not bot:
            logger.error("Bot instance not available for background processing")
            return

        # Create Telegram Update object
        try:
            update = Update.de_json(update_data, bot.app.bot)
            if not update:
                logger.error("Failed to parse update in background processing")
                return
        except Exception as e:
            logger.error(f"Error parsing Telegram update in background: {e}")
            return

        # Process the update
        try:
            await bot.app.process_update(update)
            processing_time = (time.perf_counter() - start_time) * 1000
            logger.debug(
                f"Background processing completed in {processing_time:.2f}ms for update {update.update_id}"
            )
        except Exception as e:
            logger.error(
                f"Error in background processing for update {update.update_id}: {e}",
                exc_info=True,
            )

    except Exception as e:
        logger.error(f"Unexpected error in background processing: {e}", exc_info=True)


async def verify_telegram_webhook(request: Request, token: str) -> bool:
    """
    High-performance webhook verification.
    """
    # Quick token verification
    if token != Config.TELEGRAM_TOKEN:
        return False

    # Optional: Add IP whitelist verification for Telegram servers
    # client_ip = request.client.host
    # if client_ip not in TELEGRAM_IP_RANGES:
    #     return False

    return True


@router.post("/{token}")
async def telegram_webhook_optimized(
    token: str,
    request: Request,
    background_tasks: BackgroundTasks,
    update_data: Dict[str, Any],
) -> JSONResponse:
    """
    Ultra-fast webhook handler optimized for sub-second response times.

    This endpoint:
    1. Immediately validates the request
    2. Queues processing in background
    3. Returns instant acknowledgment to Telegram

    Target response time: < 50ms
    """
    # Start performance timer
    start_time = time.perf_counter()

    try:
        # Fast token verification (< 1ms)
        if not await verify_telegram_webhook(request, token):
            logger.warning(f"Invalid token received in webhook: {token}")
            raise HTTPException(status_code=403, detail="Invalid token")

        # Quick validation of update data (< 5ms)
        if not update_data:
            raise HTTPException(status_code=400, detail="Empty update data")

        # Check if this is a relevant update type (quick filter)
        has_message = "message" in update_data
        has_callback = "callback_query" in update_data
        has_poll = "poll_answer" in update_data

        if not (has_message or has_callback or has_poll):
            # Return OK but don't process irrelevant updates
            response_time = (time.perf_counter() - start_time) * 1000
            logger.debug(f"Ignored irrelevant update in {response_time:.2f}ms")
            return JSONResponse(content={"status": "ignored"})

        # Queue background processing (< 1ms)
        background_tasks.add_task(process_telegram_update_background, update_data)

        # Calculate and log response time
        response_time = (time.perf_counter() - start_time) * 1000
        logger.info(f"Webhook response: 200 | Processing time: {response_time:.2f}ms")

        # Immediate response to Telegram
        return JSONResponse(content={"status": "ok"})

    except HTTPException:
        # Re-raise HTTP exceptions (these will be handled by FastAPI)
        raise
    except Exception as e:
        logger.error(f"Unexpected error in webhook handler: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


# Legacy webhook handler for compatibility
@router.post("/{token}/legacy")
async def telegram_webhook_legacy(
    token: str, request: Request, update_data: Dict[str, Any]
) -> JSONResponse:
    """
    Legacy webhook handler that processes updates synchronously.
    Use only for debugging or when background processing is not desired.
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
        logger.error(f"Unexpected error in legacy webhook handler: {e}", exc_info=True)
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
