from typing import Optional
import uuid
import logging
from telegram import Update, InlineKeyboardMarkup, InlineKeyboardButton
from telegram.ext import CallbackContext
from models.user import User
from store.database import SessionLocal
from utils.telegram_helpers import safe_send_message
from utils.redis_client import RedisClient
from utils.config import Config

logger = logging.getLogger(__name__)


async def link_wallet(update: Update, context: CallbackContext):
    """Handler for /linkwallet command - instructs user to link wallet via private message."""
    user = update.effective_user
    user_id_str = str(user.id)

    if update.effective_chat.type != "private":
        try:
            # Inform in group chat
            await safe_send_message(
                context.bot,
                update.effective_chat.id,
                f"@{user.username}, I'll send you a private message to help you link your NEAR wallet securely.",
            )
            # Send DM with environment-specific message
            if Config.is_development():
                wallet_prompt = "Let's link your NEAR wallet. Please send me your wallet address (e.g., 'yourname.near' or 'yourname.testnet')."
            else:
                wallet_prompt = "Let's link your NEAR mainnet wallet. Please send me your wallet address (e.g., 'yourname.near')."

            await safe_send_message(
                context.bot,
                user_id_str,  # Send to user's private chat
                wallet_prompt,
            )
            # Set user state to wait for wallet address
            await RedisClient.set_user_data_key(
                user_id_str, "awaiting", "wallet_address"
            )
            logger.info(
                f"User {user_id_str} (from group chat {update.effective_chat.id}) state set to 'awaiting: wallet_address' in Redis after DM."
            )
        except Exception as e:
            logger.error(
                f"Failed to send DM or set Redis state for user {user_id_str} from group chat: {e}"
            )
            await safe_send_message(
                context.bot,
                update.effective_chat.id,
                f"@{user.username}, I tried to send you a DM, but it failed. Please start a private chat with me to link your wallet.",
            )
        return

    # This is already a private chat, prompt for wallet address with environment-specific message
    if Config.is_development():
        wallet_prompt = "Great. What wallet address would you be linking? Please send me your NEAR wallet address (e.g., 'yourname.near' or 'yourname.testnet')."
    else:
        wallet_prompt = "Great. What wallet address would you be linking? Please send me your NEAR mainnet wallet address (e.g., 'yourname.near')."

    await safe_send_message(
        context.bot,
        update.effective_chat.id,
        wallet_prompt,
    )
    # Set user state to wait for wallet address
    await RedisClient.set_user_data_key(user_id_str, "awaiting", "wallet_address")
    logger.info(
        f"User {user_id_str} state attempted to set to 'awaiting: wallet_address' in Redis."
    )

    # Diagnostic: Immediately try to read back the value
    read_back_state = await RedisClient.get_user_data_key(user_id_str, "awaiting")
    logger.info(
        f"User {user_id_str} diagnostic read back 'awaiting' state from Redis: {read_back_state}"
    )


async def handle_wallet_address(update: Update, context: CallbackContext):
    """Process wallet address from user in private chat."""
    wallet_address_raw = update.message.text
    wallet_address = wallet_address_raw.strip()
    user_id = str(update.effective_user.id)

    logger.info(
        f"Handling wallet address for user {user_id}. Received raw: '{wallet_address_raw}', stripped: '{wallet_address}'"
    )

    try:
        if not wallet_address:  # Check if address is empty after stripping
            logger.warning(
                f"Empty wallet address received for user {user_id} after stripping."
            )
            # Environment-specific prompt
            if Config.is_development():
                example_text = "Please send a valid NEAR wallet address (e.g., 'yourname.near' or 'yourname.testnet')."
            else:
                example_text = "Please send a valid NEAR mainnet wallet address (e.g., 'yourname.near')."

            await safe_send_message(
                context.bot,
                update.effective_chat.id,
                f"⚠️ Wallet address cannot be empty. {example_text}",
            )
            return

        is_near = wallet_address.endswith(".near")
        is_testnet = wallet_address.endswith(".testnet")

        # Environment-based validation
        if Config.is_development():
            # Development: Allow both .near and .testnet addresses
            validation_fails = not (is_near or is_testnet)
            allowed_networks = ".near (mainnet) or .testnet"
        else:
            # Production: Only allow .near addresses (mainnet)
            validation_fails = not is_near
            allowed_networks = ".near (mainnet) only"

        logger.info(
            f"Environment: {Config.ENVIRONMENT}, wallet '{wallet_address}': ends_with_near={is_near}, ends_with_testnet={is_testnet}, validation_fails={validation_fails}"
        )

        if validation_fails:
            logger.warning(
                f"Wallet address validation failed for '{wallet_address}' in {Config.ENVIRONMENT} environment. Allowed: {allowed_networks}"
            )

            if Config.is_development():
                error_message = "❌ Invalid wallet address. Please provide a wallet address ending with '.near' or '.testnet'."
            else:
                error_message = "❌ Invalid wallet address. Please provide a NEAR mainnet wallet address ending with '.near' only. Testnet addresses are not supported in production."

            await safe_send_message(
                context.bot,
                update.effective_chat.id,
                error_message,
            )
            return

        logger.info(f"Wallet address '{wallet_address}' passed validation.")

        # Skip the challenge/signature part and directly save the wallet address
        session = SessionLocal()
        try:
            user = session.query(User).filter(User.id == user_id).first()
            if not user:
                user = User(id=user_id, wallet_address=wallet_address)
                session.add(user)
            else:
                user.wallet_address = wallet_address
            session.commit()
        finally:
            session.close()

        # Clear awaiting state
        await RedisClient.delete_user_data_key(user_id, "awaiting")
        # Invalidate user cache
        await RedisClient.delete_cached_object(f"user_profile:{user_id}")

        # Confirm wallet link to the user
        await safe_send_message(
            context.bot,
            update.effective_chat.id,
            f"Wallet {wallet_address} linked successfully! You're ready to play quizzes.",
        )

    except Exception as e:
        logger.error(f"Error handling wallet address: {e}", exc_info=True)
        await safe_send_message(
            context.bot,
            update.effective_chat.id,
            f"An error occurred while processing your wallet address. Please try again later.",
        )


async def handle_signature(update: Update, context: CallbackContext):
    """
    Legacy method maintained for backward compatibility.
    Signature verification is now skipped.
    """
    pass


async def check_wallet_linked(user_id: str) -> bool:
    """Check if a user has linked their NEAR wallet."""
    user_profile = await get_user_profile(user_id)
    return user_profile is not None and user_profile.get("wallet_address") is not None


async def get_user_wallet(user_id: str) -> str | None:
    """Retrieve the wallet address for a given user_id."""
    user_profile = await get_user_profile(user_id)
    return user_profile.get("wallet_address") if user_profile else None


async def get_user_profile(user_id: str) -> Optional[dict]:
    """Retrieve user profile, from cache if available, otherwise from DB."""
    cache_key = f"user_profile:{user_id}"

    cached_user = await RedisClient.get_cached_object(cache_key)
    if cached_user:
        logger.info(f"User profile for {user_id} found in cache.")
        return cached_user

    logger.info(f"User profile for {user_id} not in cache. Fetching from DB.")
    session = SessionLocal()
    try:
        user = session.query(User).filter(User.id == str(user_id)).first()
        if user:
            user_data = {
                "id": user.id,
                "wallet_address": user.wallet_address,
                "linked_at": user.linked_at.isoformat() if user.linked_at else None,
            }
            await RedisClient.set_cached_object(cache_key, user_data)
            return user_data
        return None
    except Exception as e:
        logger.error(f"Error getting user profile for {user_id}: {e}", exc_info=True)
        return None
    finally:
        session.close()


async def set_user_wallet(user_id: str, wallet_address: str) -> bool:
    """Set or update the wallet address for a given user_id."""
    session = SessionLocal()
    try:
        user = session.query(User).filter(User.id == str(user_id)).first()
        if not user:
            user = User(id=str(user_id), wallet_address=wallet_address)
            session.add(user)
        else:
            user.wallet_address = wallet_address
        session.commit()
        # Invalidate cache
        await RedisClient.delete_cached_object(f"user_profile:{user_id}")
        return True
    except Exception as e:
        logger.error(f"Error setting user wallet for {user_id}: {e}", exc_info=True)
        session.rollback()
        return False
    finally:
        session.close()


async def remove_user_wallet(user_id: str) -> bool:
    """Remove the wallet address for a given user_id."""
    session = SessionLocal()
    try:
        user = session.query(User).filter(User.id == str(user_id)).first()
        if user and user.wallet_address:
            user.wallet_address = None
            session.commit()
            # Invalidate cache
            await RedisClient.delete_cached_object(f"user_profile:{user_id}")
            return True
        elif not user or not user.wallet_address:
            # If user doesn't exist or no wallet is linked, consider it a success (idempotency)
            return True
        return False
    except Exception as e:
        logger.error(f"Error removing user wallet for {user_id}: {e}", exc_info=True)
        session.rollback()
        return False
    finally:
        session.close()
