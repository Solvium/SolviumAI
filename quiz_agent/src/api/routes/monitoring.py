"""
Monitoring endpoints for bot statistics and metrics.
"""
import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

from api.main import get_bot_instance
from utils.config import Config

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/stats")
async def get_bot_stats() -> JSONResponse:
    """
    Get bot statistics and metrics.
    
    Returns:
        JSONResponse with bot statistics
    """
    try:
        bot = get_bot_instance()
        if not bot:
            raise HTTPException(status_code=503, detail="Bot service unavailable")
        
        stats = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "bot_info": {
                "running": hasattr(bot.app, 'running') and bot.app.running,
                "updater_running": hasattr(bot.app, 'updater') and bot.app.updater and bot.app.updater.running,
            },
            "configuration": {
                "webhook_mode": Config.WEBHOOK_URL is not None,
                "webhook_url": Config.WEBHOOK_URL if Config.WEBHOOK_URL else None,
                "environment": "development" if Config.is_development() else "production"
            }
        }
        
        # Try to get bot info from Telegram
        try:
            bot_info = await bot.app.bot.get_me()
            stats["telegram_bot"] = {
                "id": bot_info.id,
                "username": bot_info.username,
                "first_name": bot_info.first_name,
                "can_join_groups": bot_info.can_join_groups,
                "can_read_all_group_messages": bot_info.can_read_all_group_messages,
                "supports_inline_queries": bot_info.supports_inline_queries
            }
        except Exception as e:
            stats["telegram_bot"] = {"error": f"Failed to get bot info: {str(e)}"}
        
        return JSONResponse(content=stats)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting bot stats: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/webhook/info")
async def get_webhook_info() -> JSONResponse:
    """
    Get current webhook information from Telegram.
    
    Returns:
        JSONResponse with webhook information
    """
    try:
        bot = get_bot_instance()
        if not bot:
            raise HTTPException(status_code=503, detail="Bot service unavailable")
        
        webhook_info = await bot.app.bot.get_webhook_info()
        
        return JSONResponse(content={
            "url": webhook_info.url,
            "has_custom_certificate": webhook_info.has_custom_certificate,
            "pending_update_count": webhook_info.pending_update_count,
            "last_error_date": webhook_info.last_error_date.isoformat() if webhook_info.last_error_date else None,
            "last_error_message": webhook_info.last_error_message,
            "last_synchronization_error_date": webhook_info.last_synchronization_error_date.isoformat() if webhook_info.last_synchronization_error_date else None,
            "max_connections": webhook_info.max_connections,
            "allowed_updates": webhook_info.allowed_updates,
            "ip_address": webhook_info.ip_address
        })
        
    except Exception as e:
        logger.error(f"Error getting webhook info: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/handlers")
async def get_handlers_info() -> JSONResponse:
    """
    Get information about registered handlers.
    
    Returns:
        JSONResponse with handlers information
    """
    try:
        bot = get_bot_instance()
        if not bot:
            raise HTTPException(status_code=503, detail="Bot service unavailable")
        
        handlers_info = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "total_handlers": 0,
            "handlers_by_group": {}
        }
        
        # Get handler information from the application
        if hasattr(bot.app, 'handlers'):
            for group, handlers in bot.app.handlers.items():
                handlers_info["handlers_by_group"][str(group)] = len(handlers)
                handlers_info["total_handlers"] += len(handlers)
        
        return JSONResponse(content=handlers_info)
        
    except Exception as e:
        logger.error(f"Error getting handlers info: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/restart")
async def restart_bot() -> JSONResponse:
    """
    Restart the bot (development only).
    
    Returns:
        JSONResponse indicating restart status
    """
    if not Config.is_development():
        raise HTTPException(status_code=403, detail="Restart only available in development mode")
    
    try:
        bot = get_bot_instance()
        if not bot:
            raise HTTPException(status_code=503, detail="Bot service unavailable")
        
        # This is a placeholder - actual restart logic would depend on your deployment
        logger.info("Bot restart requested (development mode)")
        
        return JSONResponse(content={
            "status": "restart_requested",
            "message": "Bot restart has been requested",
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error restarting bot: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
