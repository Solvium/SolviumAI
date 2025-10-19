"""
Wallet-related endpoints for checking user wallet status and decrypting private keys.

Mini-App Integration Endpoint:
------------------------------
POST /wallet/get-or-create
    - Unified endpoint for mini-app to get existing user or create new user with wallet
    - Requires X-API-Secret header for authentication
    - Returns user info, wallet details, and points in single call
    
    Request Body:
        {
            "telegram_user_id": 123456789,
            "username": "john_doe",        # optional
            "first_name": "John",          # optional  
            "last_name": "Doe"             # optional
        }
    
    Request Headers:
        X-API-Secret: <your-secret-from-env>
    
    Response:
        {
            "success": true,
            "user_exists": true,
            "user": {...},
            "wallet": {
                "account_id": "dwarf2e75.kindpuma8958.testnet",
                "public_key": "ed25519:...",
                "network": "testnet"
            },
            "message": "..."
        }
        
    Setup:
        1. Add to .env file: MINI_APP_API_SECRET=your-secret-key-here
        2. Mini-app sends same secret in X-API-Secret header
        3. Keep secret secure - don't commit to git!
"""

import logging
from typing import Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Depends, Header
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from services.database_service import DatabaseService
from services.near_wallet_service import NEARWalletService
from services.wallet_service import WalletService
from store.database import SessionLocal
from models.user import User
from utils.config import Config

logger = logging.getLogger(__name__)

router = APIRouter()


class WalletCheckRequest(BaseModel):
    """Request model for wallet check endpoint"""

    telegram_user_id: int


class GetOrCreateUserRequest(BaseModel):
    """Request model for get-or-create user endpoint"""
    
    telegram_user_id: int
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None


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


def verify_api_secret(x_api_secret: str = Header(None)) -> bool:
    """Verify API secret for mini-app requests"""
    if not Config.MINI_APP_API_SECRET:
        if Config.is_production():
            # Fail secure in production - never allow unsecured access
            logger.error("MINI_APP_API_SECRET not configured in production - rejecting request!")
            raise HTTPException(
                status_code=500,
                detail="API authentication not configured"
            )
        else:
            # Only allow in development for easier testing
            logger.warning("MINI_APP_API_SECRET not configured - API is unsecured (development mode only)!")
            return True
    
    if x_api_secret != Config.MINI_APP_API_SECRET:
        raise HTTPException(
            status_code=401,
            detail="Invalid API secret"
        )
    return True


@router.post("/get-or-create")
async def get_or_create_user_wallet(
    request: GetOrCreateUserRequest,
    db_service: DatabaseService = Depends(get_database_service),
    _: bool = Depends(verify_api_secret),
) -> JSONResponse:
    """
    Get existing user and wallet, or create new user with wallet if doesn't exist.
    This endpoint is designed for mini-app integration.
    
    Security: Requires X-API-Secret header matching MINI_APP_API_SECRET env var.
    
    Args:
        request: User information from mini-app
        db_service: Database service instance
        _: API secret verification dependency (raises 401 if invalid)
        
    Returns:
        JSONResponse with user info, wallet details, and points
    """
    try:
        telegram_user_id = request.telegram_user_id
        logger.info(f"Get-or-create request for user {telegram_user_id}")
        
        # Check if user exists
        session = SessionLocal()
        try:
            user = session.query(User).filter(User.id == str(telegram_user_id)).first()
            user_exists = user is not None
            
            # Create user if doesn't exist
            if not user:
                logger.info(f"Creating new user {telegram_user_id}")
                user = User(
                    id=str(telegram_user_id),
                    username=request.username,
                    first_name=request.first_name,
                    last_name=request.last_name,
                )
                session.add(user)
                session.commit()
                session.refresh(user)
                logger.info(f"User {telegram_user_id} created successfully")
            else:
                # Update user info if provided
                if request.username and user.username != request.username:
                    user.username = request.username
                if request.first_name and user.first_name != request.first_name:
                    user.first_name = request.first_name
                if request.last_name and user.last_name != request.last_name:
                    user.last_name = request.last_name
                session.commit()
                logger.info(f"User {telegram_user_id} found and updated")
            
        finally:
            session.close()
        
        # Check if user has a wallet
        has_wallet = await db_service.has_wallet(telegram_user_id)
        wallet_info = None
        
        if has_wallet:
            # Get existing wallet
            logger.info(f"User {telegram_user_id} has existing wallet")
            wallet_data = await db_service.get_user_wallet(telegram_user_id)
            if wallet_data:
                wallet_info = {
                    "account_id": wallet_data.get("account_id"),
                    "public_key": wallet_data.get("public_key"),
                    "network": wallet_data.get("network", "testnet"),
                    "created_at": wallet_data.get("created_at"),
                }
        else:
            # Create new wallet for user
            logger.info(f"Creating new wallet for user {telegram_user_id}")
            try:
                wallet_service = WalletService()
                new_wallet = await wallet_service.create_wallet(
                    user_id=telegram_user_id,
                    user_name=request.username,
                )
                
                wallet_info = {
                    "account_id": new_wallet.get("account_id"),
                    "public_key": new_wallet.get("public_key"),
                    "network": new_wallet.get("network", "testnet"),
                    "created_at": "just created",
                }
                logger.info(f"Wallet created for user {telegram_user_id}: {wallet_info['account_id']}")
                
            except Exception as wallet_error:
                logger.error(f"Error creating wallet for user {telegram_user_id}: {wallet_error}")
                # Continue without wallet - return user info anyway
                wallet_info = None
        
        # Build response
        response_data = {
            "success": True,
            "user_exists": user_exists,
            "user": {
                "telegram_user_id": telegram_user_id,
                "username": user.username,
                "first_name": user.first_name,
                "last_name": user.last_name,
            },
            "wallet": wallet_info,
            "message": "User and wallet retrieved successfully" if user_exists and has_wallet 
                      else "New user and wallet created successfully" if not user_exists
                      else "User retrieved, wallet created successfully"
        }
        
        return JSONResponse(content=response_data, status_code=200)
        
    except Exception as e:
        logger.error(f"Error in get-or-create endpoint for user {request.telegram_user_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )


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
