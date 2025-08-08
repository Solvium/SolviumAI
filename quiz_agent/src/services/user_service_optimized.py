"""
Optimized User Service with performance enhancements.
Includes caching, batch operations, and connection pooling.
"""

import asyncio
import time
import logging
from typing import Optional, Dict, List, Any
from datetime import datetime, timedelta

from telegram import Update, InlineKeyboardMarkup, InlineKeyboardButton
from telegram.ext import CallbackContext

from models.user import User
from store.database import SessionLocal
from utils.telegram_helpers import safe_send_message
from utils.redis_client import RedisClient
from utils.config import Config
from services.performance_service import (
    redis_cache, 
    performance_monitor, 
    bulk_manager,
    connection_pool
)

logger = logging.getLogger(__name__)


class OptimizedUserService:
    """High-performance user service with caching and optimization."""
    
    def __init__(self):
        self.user_cache_ttl = 1800  # 30 minutes
        self.active_users_cache_ttl = 300  # 5 minutes
        self.batch_update_interval = 5.0  # seconds
    
    @redis_cache(ttl=1800, key_prefix="user_profile")
    @performance_monitor("get_user_profile")
    async def get_user_profile(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get user profile with caching."""
        try:
            async with connection_pool:
                with SessionLocal() as session:
                    user = session.query(User).filter(User.id == user_id).first()
                    if user:
                        return {
                            "id": user.id,
                            "telegram_id": user.telegram_id,
                            "username": user.username,
                            "first_name": user.first_name,
                            "last_name": user.last_name,
                            "wallet_address": user.wallet_address,
                            "is_premium": user.is_premium,
                            "created_at": user.created_at.isoformat() if user.created_at else None,
                            "last_active": user.last_active.isoformat() if user.last_active else None
                        }
                    return None
        except Exception as e:
            logger.error(f"Error getting user profile for {user_id}: {e}")
            return None
    
    @redis_cache(ttl=300, key_prefix="user_wallet")
    @performance_monitor("get_user_wallet")
    async def get_user_wallet_info(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get user wallet information with caching."""
        try:
            # Try cache first
            cache_key = f"wallet_info:{user_id}"
            cached_wallet = await RedisClient.get_value(cache_key)
            if cached_wallet:
                return cached_wallet
            
            # Fallback to database
            user_profile = await self.get_user_profile(user_id)
            if user_profile and user_profile.get("wallet_address"):
                wallet_info = {
                    "address": user_profile["wallet_address"],
                    "balance": await self._get_wallet_balance(user_profile["wallet_address"]),
                    "last_updated": datetime.now().isoformat()
                }
                
                # Cache wallet info
                await RedisClient.set_value(cache_key, wallet_info, ttl_seconds=300)
                return wallet_info
            
            return None
            
        except Exception as e:
            logger.error(f"Error getting wallet info for user {user_id}: {e}")
            return None
    
    async def _get_wallet_balance(self, wallet_address: str) -> float:
        """Get wallet balance (implement with your blockchain service)."""
        try:
            # This would integrate with your blockchain service
            # For now, return cached balance or 0.0
            cache_key = f"balance:{wallet_address}"
            cached_balance = await RedisClient.get_value(cache_key)
            return cached_balance if cached_balance is not None else 0.0
        except Exception as e:
            logger.error(f"Error getting balance for {wallet_address}: {e}")
            return 0.0
    
    @performance_monitor("update_user_activity")
    async def update_user_activity(self, user_id: str, activity_data: Dict[str, Any]):
        """Update user activity with batch processing."""
        try:
            # Add to bulk update queue for efficiency
            update_data = {
                "user_id": user_id,
                "activity_data": activity_data,
                "timestamp": datetime.now().isoformat()
            }
            
            await bulk_manager.add_operation("user_updates", update_data)
            
            # Update cache immediately for real-time response
            cache_key = f"user_activity:{user_id}"
            await RedisClient.set_value(cache_key, activity_data, ttl_seconds=300)
            
        except Exception as e:
            logger.error(f"Error updating activity for user {user_id}: {e}")
    
    @redis_cache(ttl=600, key_prefix="active_users")
    @performance_monitor("get_active_users")
    async def get_active_users_count(self, minutes: int = 10) -> int:
        """Get count of active users in the last N minutes."""
        try:
            # Try to get from cache first
            cache_key = f"active_users_count:{minutes}min"
            cached_count = await RedisClient.get_value(cache_key)
            if cached_count is not None:
                return cached_count
            
            # Calculate from activity data
            cutoff_time = datetime.now() - timedelta(minutes=minutes)
            
            # Use Redis to count active users
            pattern = "user_activity:*"
            redis_client = await RedisClient.get_instance()
            
            active_count = 0
            async for key in redis_client.scan_iter(match=pattern):
                activity_data = await RedisClient.get_value(key.decode())
                if activity_data and activity_data.get("timestamp"):
                    try:
                        activity_time = datetime.fromisoformat(activity_data["timestamp"])
                        if activity_time > cutoff_time:
                            active_count += 1
                    except (ValueError, KeyError):
                        continue
            
            # Cache the result
            await RedisClient.set_value(cache_key, active_count, ttl_seconds=60)
            return active_count
            
        except Exception as e:
            logger.error(f"Error getting active users count: {e}")
            return 0
    
    @performance_monitor("batch_create_users")
    async def batch_create_users(self, user_data_list: List[Dict[str, Any]]) -> int:
        """Create multiple users efficiently using batch operations."""
        try:
            created_count = 0
            
            async with connection_pool:
                with SessionLocal() as session:
                    for user_data in user_data_list:
                        try:
                            # Check if user already exists (use cache)
                            existing_user = await self.get_user_profile(user_data.get("telegram_id"))
                            if existing_user:
                                continue
                            
                            # Create new user
                            user = User(
                                telegram_id=user_data.get("telegram_id"),
                                username=user_data.get("username"),
                                first_name=user_data.get("first_name"),
                                last_name=user_data.get("last_name"),
                                created_at=datetime.now()
                            )
                            
                            session.add(user)
                            created_count += 1
                            
                        except Exception as e:
                            logger.error(f"Error creating user {user_data.get('telegram_id')}: {e}")
                            continue
                    
                    session.commit()
            
            logger.info(f"Batch created {created_count} users")
            return created_count
            
        except Exception as e:
            logger.error(f"Error in batch user creation: {e}")
            return 0
    
    @performance_monitor("link_wallet_optimized")
    async def link_wallet_optimized(self, update: Update, context: CallbackContext):
        """Optimized wallet linking with caching."""
        user = update.effective_user
        user_id_str = str(user.id)
        
        try:
            # Quick user state check from cache
            user_state = await RedisClient.get_user_data_key(user_id_str, "awaiting")
            
            if update.effective_chat.type != "private":
                # Group chat handling
                await safe_send_message(
                    context.bot,
                    update.effective_chat.id,
                    f"@{user.username}, I'll send you a private message to help you link your NEAR wallet securely.",
                )
                
                # Send DM with environment-specific message
                wallet_prompt = (
                    "Let's link your NEAR wallet. Please send me your wallet address "
                    f"(e.g., 'yourname.{'testnet' if Config.is_development() else 'near'}')."
                )
                
                await safe_send_message(context.bot, user_id_str, wallet_prompt)
                
                # Set user state with optimized caching
                await RedisClient.set_user_data_key(user_id_str, "awaiting", "wallet_address")
                
                # Update user activity
                await self.update_user_activity(user_id_str, {
                    "action": "wallet_link_initiated",
                    "chat_type": "group",
                    "timestamp": datetime.now().isoformat()
                })
                
                logger.info(f"User {user_id_str} initiated wallet linking from group chat")
                
            else:
                # Private chat handling
                if user_state == "wallet_address":
                    await self._process_wallet_address(update, context, user_id_str)
                else:
                    await self._initiate_wallet_linking(update, context, user_id_str)
                    
        except Exception as e:
            logger.error(f"Error in optimized wallet linking for user {user_id_str}: {e}")
            await safe_send_message(
                context.bot,
                update.effective_chat.id,
                "Sorry, there was an error processing your wallet linking request. Please try again."
            )
    
    async def _process_wallet_address(self, update: Update, context: CallbackContext, user_id_str: str):
        """Process wallet address input with validation and caching."""
        wallet_address = update.message.text.strip()
        
        try:
            # Validate wallet address format
            if not self._validate_wallet_address(wallet_address):
                await safe_send_message(
                    context.bot,
                    update.effective_chat.id,
                    "Invalid wallet address format. Please provide a valid NEAR wallet address."
                )
                return
            
            # Check if wallet is already linked (cached check)
            existing_link = await RedisClient.get_value(f"wallet_link:{wallet_address}")
            if existing_link and existing_link != user_id_str:
                await safe_send_message(
                    context.bot,
                    update.effective_chat.id,
                    "This wallet address is already linked to another account."
                )
                return
            
            # Link wallet (queue for batch processing)
            await bulk_manager.add_operation("wallet_links", {
                "user_id": user_id_str,
                "wallet_address": wallet_address,
                "timestamp": datetime.now().isoformat()
            })
            
            # Cache the wallet link immediately
            await RedisClient.set_value(f"wallet_link:{wallet_address}", user_id_str, ttl_seconds=3600)
            
            # Clear user state
            await RedisClient.delete_user_data_key(user_id_str, "awaiting")
            
            # Update user activity
            await self.update_user_activity(user_id_str, {
                "action": "wallet_linked",
                "wallet_address": wallet_address,
                "timestamp": datetime.now().isoformat()
            })
            
            await safe_send_message(
                context.bot,
                update.effective_chat.id,
                f"✅ Successfully linked your wallet: {wallet_address}"
            )
            
            logger.info(f"User {user_id_str} successfully linked wallet {wallet_address}")
            
        except Exception as e:
            logger.error(f"Error processing wallet address for user {user_id_str}: {e}")
            await safe_send_message(
                context.bot,
                update.effective_chat.id,
                "Sorry, there was an error linking your wallet. Please try again."
            )
    
    async def _initiate_wallet_linking(self, update: Update, context: CallbackContext, user_id_str: str):
        """Initiate wallet linking process."""
        try:
            wallet_prompt = (
                "Let's link your NEAR wallet. Please send me your wallet address "
                f"(e.g., 'yourname.{'testnet' if Config.is_development() else 'near'}')."
            )
            
            await safe_send_message(context.bot, update.effective_chat.id, wallet_prompt)
            
            # Set user state
            await RedisClient.set_user_data_key(user_id_str, "awaiting", "wallet_address")
            
            # Update user activity
            await self.update_user_activity(user_id_str, {
                "action": "wallet_link_initiated",
                "chat_type": "private",
                "timestamp": datetime.now().isoformat()
            })
            
        except Exception as e:
            logger.error(f"Error initiating wallet linking for user {user_id_str}: {e}")
    
    def _validate_wallet_address(self, address: str) -> bool:
        """Validate NEAR wallet address format."""
        if not address:
            return False
        
        # Basic NEAR address validation
        if Config.is_development():
            # Allow testnet addresses
            return (
                address.endswith('.testnet') or 
                address.endswith('.near') or
                len(address) == 64  # Implicit account
            )
        else:
            # Production - only mainnet addresses
            return (
                address.endswith('.near') or
                len(address) == 64  # Implicit account
            )
    
    @performance_monitor("get_user_statistics")
    async def get_user_statistics(self, user_id: str) -> Dict[str, Any]:
        """Get comprehensive user statistics with caching."""
        try:
            cache_key = f"user_stats:{user_id}"
            cached_stats = await RedisClient.get_value(cache_key)
            if cached_stats:
                return cached_stats
            
            # Calculate statistics
            user_profile = await self.get_user_profile(user_id)
            if not user_profile:
                return {}
            
            # Get various statistics (implement based on your models)
            stats = {
                "total_quizzes_participated": 0,  # Implement based on your quiz model
                "total_points_earned": 0,         # Implement based on your scoring system
                "average_score": 0.0,             # Implement based on your quiz results
                "rank": 0,                        # Implement based on leaderboard
                "wallet_linked": bool(user_profile.get("wallet_address")),
                "account_age_days": self._calculate_account_age(user_profile.get("created_at")),
                "last_active": user_profile.get("last_active")
            }
            
            # Cache for 10 minutes
            await RedisClient.set_value(cache_key, stats, ttl_seconds=600)
            return stats
            
        except Exception as e:
            logger.error(f"Error getting user statistics for {user_id}: {e}")
            return {}
    
    def _calculate_account_age(self, created_at_str: str) -> int:
        """Calculate account age in days."""
        try:
            if not created_at_str:
                return 0
            created_at = datetime.fromisoformat(created_at_str)
            return (datetime.now() - created_at).days
        except (ValueError, TypeError):
            return 0
    
    @performance_monitor("cleanup_inactive_users")
    async def cleanup_inactive_cache(self, days: int = 7):
        """Clean up cache for inactive users."""
        try:
            cutoff_time = datetime.now() - timedelta(days=days)
            
            # Get all user activity keys
            redis_client = await RedisClient.get_instance()
            inactive_keys = []
            
            async for key in redis_client.scan_iter(match="user_activity:*"):
                activity_data = await RedisClient.get_value(key.decode())
                if activity_data and activity_data.get("timestamp"):
                    try:
                        activity_time = datetime.fromisoformat(activity_data["timestamp"])
                        if activity_time < cutoff_time:
                            inactive_keys.append(key.decode())
                    except (ValueError, KeyError):
                        continue
            
            # Batch delete inactive keys
            if inactive_keys:
                for key in inactive_keys:
                    await RedisClient.delete_value(key)
                
                logger.info(f"Cleaned up {len(inactive_keys)} inactive user cache entries")
            
        except Exception as e:
            logger.error(f"Error cleaning up inactive user cache: {e}")


# Global optimized user service instance
optimized_user_service = OptimizedUserService()


# Legacy function wrappers for backward compatibility
async def link_wallet(update: Update, context: CallbackContext):
    """Legacy wrapper for link_wallet functionality."""
    await optimized_user_service.link_wallet_optimized(update, context)


async def get_user_profile(user_id: str) -> Optional[Dict[str, Any]]:
    """Legacy wrapper for get_user_profile functionality."""
    return await optimized_user_service.get_user_profile(user_id)


async def get_active_users_count(minutes: int = 10) -> int:
    """Legacy wrapper for get_active_users_count functionality."""
    return await optimized_user_service.get_active_users_count(minutes)
