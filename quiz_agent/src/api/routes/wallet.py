"""
Wallet-related endpoints for checking user wallet status and decrypting private keys.
"""

import logging
from typing import Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from services.database_service import DatabaseService
from services.near_wallet_service import NEARWalletService
from utils.config import Config

logger = logging.getLogger(__name__)

router = APIRouter()


class WalletCheckRequest(BaseModel):
    """Request model for wallet check endpoint"""

    telegram_user_id: int


class WalletCheckResponse(BaseModel):
    """Response model for wallet check endpoint"""

    has_wallet: bool
    message: str
    wallet_info: Optional[Dict[str, Any]] = None


async def get_database_service() -> DatabaseService:
    """Dependency to get database service instance"""
    return DatabaseService()


async def get_wallet_service() -> NEARWalletService:
    """Dependency to get wallet service instance"""
    return NEARWalletService()


@router.post("/check", response_model=WalletCheckResponse)
async def check_user_wallet(
    request: WalletCheckRequest,
    db_service: DatabaseService = Depends(get_database_service),
    wallet_service: NEARWalletService = Depends(get_wallet_service),
) -> JSONResponse:
    """
    Check if a user has a wallet and return wallet information if available.

    Args:
        request: Contains the telegram_user_id to check
        db_service: Database service instance
        wallet_service: Wallet service instance for decryption

    Returns:
        JSONResponse with wallet status and information
    """
    try:
        telegram_user_id = request.telegram_user_id

        # Check if user has a wallet
        has_wallet = await db_service.has_wallet(telegram_user_id)

        if not has_wallet:
            return JSONResponse(
                content={
                    "has_wallet": False,
                    "message": f"User {telegram_user_id} does not have a wallet. Please create one first.",
                    "wallet_info": None,
                },
                status_code=404,
            )

        # Get wallet information
        wallet_info = await db_service.get_user_wallet(telegram_user_id)

        if not wallet_info:
            return JSONResponse(
                content={
                    "has_wallet": False,
                    "message": f"Wallet information not found for user {telegram_user_id}",
                    "wallet_info": None,
                },
                status_code=404,
            )

        # Decrypt the private key
        try:
            decrypted_private_key = wallet_service.decrypt_private_key(
                wallet_info["encrypted_private_key"],
                wallet_info["iv"],
                wallet_info["tag"],
            )

            # Add decrypted private key to wallet info
            wallet_info["private_key"] = decrypted_private_key

            # Remove sensitive encrypted data from response
            response_wallet_info = {
                "account_id": wallet_info["account_id"],
                "public_key": wallet_info["public_key"],
                "private_key": wallet_info["private_key"],
                "network": wallet_info["network"],
            }

            return JSONResponse(
                content={
                    "has_wallet": True,
                    "message": f"Wallet found for user {telegram_user_id}. Private key decrypted successfully.",
                    "wallet_info": response_wallet_info,
                },
                status_code=200,
            )

        except Exception as decryption_error:
            logger.error(
                f"Error decrypting private key for user {telegram_user_id}: {decryption_error}"
            )
            return JSONResponse(
                content={
                    "has_wallet": True,
                    "message": f"Wallet found for user {telegram_user_id}, but failed to decrypt private key: {str(decryption_error)}",
                    "wallet_info": {
                        "account_id": wallet_info["account_id"],
                        "public_key": wallet_info["public_key"],
                        "is_demo": wallet_info["is_demo"],
                        "network": wallet_info["network"],
                        "private_key": None,
                    },
                },
                status_code=500,
            )

    except Exception as e:
        logger.error(f"Error in check_user_wallet endpoint: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error while checking wallet: {str(e)}",
        )


@router.get("/collision-stats")
async def get_collision_stats(
    wallet_service: NEARWalletService = Depends(get_wallet_service),
) -> JSONResponse:
    """
    Get collision statistics for wallet creation monitoring.
    """
    try:
        stats = wallet_service.get_collision_stats()
        return JSONResponse(
            content={
                "collision_stats": stats,
                "message": "Collision statistics retrieved successfully",
            },
            status_code=200,
        )
    except Exception as e:
        logger.error(f"Error getting collision stats: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error while getting collision stats: {str(e)}",
        )


@router.get("/status/{telegram_user_id}")
async def get_wallet_status(
    telegram_user_id: int, db_service: DatabaseService = Depends(get_database_service)
) -> JSONResponse:
    """
    Get wallet status for a user (without decrypting private key).

    Args:
        telegram_user_id: The user's Telegram ID
        db_service: Database service instance

    Returns:
        JSONResponse with wallet status
    """
    try:
        has_wallet = await db_service.has_wallet(telegram_user_id)

        if not has_wallet:
            return JSONResponse(
                content={
                    "has_wallet": False,
                    "message": f"User {telegram_user_id} does not have a wallet",
                },
                status_code=404,
            )

        # Get basic wallet info without private key
        wallet_info = await db_service.get_user_wallet(telegram_user_id)

        if not wallet_info:
            return JSONResponse(
                content={
                    "has_wallet": False,
                    "message": f"Wallet information not found for user {telegram_user_id}",
                },
                status_code=404,
            )

        # Return basic wallet info without private key
        basic_wallet_info = {
            "account_id": wallet_info["account_id"],
            "public_key": wallet_info["public_key"],
            "is_demo": wallet_info["is_demo"],
            "network": wallet_info["network"],
        }

        return JSONResponse(
            content={
                "has_wallet": True,
                "message": f"Wallet found for user {telegram_user_id}",
                "wallet_info": basic_wallet_info,
            },
            status_code=200,
        )

    except Exception as e:
        logger.error(f"Error in get_wallet_status endpoint: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error while getting wallet status: {str(e)}",
        )
