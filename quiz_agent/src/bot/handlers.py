from telegram import Update, InlineKeyboardMarkup, InlineKeyboardButton
from telegram.ext import (
    CallbackContext,
    ConversationHandler,
    CommandHandler,
    MessageHandler,
    CallbackQueryHandler,
    filters,
)
from services.quiz_service import (
    create_quiz,
    play_quiz,
    handle_quiz_answer,
    get_winners,
    distribute_quiz_rewards,
    process_questions,
    schedule_auto_distribution,
    save_quiz_payment_hash,  # Added import
    save_quiz_reward_details,  # Added import
    get_leaderboards_for_all_active_quizzes,  # Add this import
)
from services.user_service import (
    get_user_wallet,
    set_user_wallet,
    remove_user_wallet,
    link_wallet as service_link_wallet,  # Renamed import
    handle_wallet_address as service_handle_wallet_address,  # Renamed import
)
from agent import generate_quiz
import logging
import re  # Import re for duration_input and potentially wallet validation
import asyncio  # Add asyncio import
from typing import Optional  # Added for type hinting
from utils.config import Config  # Added to access DEPOSIT_ADDRESS
from store.database import SessionLocal
from models.quiz import Quiz
from utils.redis_client import RedisClient  # Added RedisClient import
from utils.telegram_helpers import safe_send_message  # Ensure this is imported
import html  # Add this import
from datetime import datetime, timezone  # Add this import

# Configure logger
logger = logging.getLogger(__name__)

async def start_handler(update, context):
    """Handle /start command - shows the main menu interface"""
    user = update.effective_user
    chat_type = update.effective_chat.type
    
    if chat_type == "private":
        # In private chat, show the main menu
        from .menu_handlers import show_main_menu
        await show_main_menu(update, context)
    else:
        # In group chat, show menu with DM suggestion
        from .menu_handlers import show_menu_in_group
        await show_menu_in_group(update, context)


# Helper function to escape specific MarkdownV2 characters
def _escape_markdown_v2_specials(text: str) -> str:
    # Targeted escape for characters known to cause issues in simple text strings
    # when parse_mode='MarkdownV2' is used.
    # Note: This is not a comprehensive MarkdownV2 escaper.
    # For a full solution, a library function or more extensive regex would be needed.
    # This targets the most common issues like '.', '!', '-'.
    if not text:  # Ensure text is not None
        return ""
    text = str(text)  # Ensure text is a string
    # Escape existing characters
    text = text.replace(".", "\\.")
    text = text.replace("!", "\\!")
    text = text.replace("-", "\\-")
    text = text.replace("(", "\\(")
    text = text.replace(")", "\\)")
    text = text.replace("+", "\\+")
    text = text.replace("=", "\\=")
    # Add escaping for > and <
    text = text.replace(">", "\\>")
    text = text.replace("<", "\\<")
    # Add other characters if they become problematic and are not part of intended Markdown like backticks or links.
    return text


# Define conversation states
TOPIC, NOTES_CHOICE, NOTES_INPUT, SIZE, CONTEXT_CHOICE, CONTEXT_INPUT, DURATION_CHOICE, DURATION_INPUT, REWARD_CHOICE, REWARD_CUSTOM_INPUT, REWARD_STRUCTURE_CHOICE, PAYMENT_VERIFICATION, CONFIRM = (
    range(13)
)

# States for reward configuration
(
    REWARD_METHOD_CHOICE,
    REWARD_WTA_INPUT,
    REWARD_TOP3_INPUT,
    REWARD_CUSTOM_INPUT,
    REWARD_MANUAL_INPUT,
) = range(7, 12)


# Helper function to parse reward details
def _parse_reward_details_for_total(
    reward_text: str, reward_type: str
) -> tuple[Optional[float], Optional[str]]:
    total_amount = 0.0
    currency = None

    try:
        if reward_type == "wta_amount":
            # e.g., "5 NEAR", "10.5 USDT" (currency must be 3+ letters to avoid ordinal suffixes)
            match = re.search(r"(\d+\.?\d*)\s*([A-Za-z]{3,})\b", reward_text)
            if match:
                total_amount = float(match.group(1))
                currency = match.group(2).upper()
                return total_amount, currency
            return None, None

        elif reward_type == "top3_details":
            # e.g., "3 NEAR for 1st, 2 NEAR for 2nd, 1 NEAR for 3rd" (ignore ordinal suffixes)
            matches = re.findall(r"(\d+\.?\d*)\s*([A-Za-z]{3,})\b", reward_text)
            if not matches:
                return None, None

            parsed_currency = matches[0][1].upper()
            for amount_str, curr_str in matches:
                if curr_str.upper() != parsed_currency:
                    logger.warning(
                        f"Mismatched currencies in top3_details: expected {parsed_currency}, got {curr_str.upper()}"
                    )
                    return None, None  # Mismatch in currencies
                total_amount += float(amount_str)
            currency = parsed_currency
            return total_amount, currency

        elif reward_type == "custom_details":
            # Basic sum for custom_details, sums all "X CURRENCY" found if currency is consistent (ignore ordinals)
            matches = re.findall(r"(\d+\.?\d*)\s*([A-Za-z]{3,})\b", reward_text)
            if not matches:
                return None, None

            parsed_currency = matches[0][1].upper()
            for amount_str, curr_str in matches:
                if curr_str.upper() != parsed_currency:
                    logger.warning(
                        f"Mismatched currencies in custom_details: expected {parsed_currency}, got {curr_str.upper()}"
                    )
                    return None, None  # Mismatched currencies
                total_amount += float(amount_str)
            currency = parsed_currency
            return total_amount, currency
    except ValueError as e:
        logger.error(
            f"ValueError during parsing reward details for {reward_type}: {reward_text} - {e}"
        )
        return None, None
    except Exception as e:
        logger.error(
            f"Unexpected error during parsing reward details for {reward_type}: {reward_text} - {e}"
        )
        return None, None

    return None, None


async def group_start(update, context):
    """Handle /start in group chat by showing menu and telling user to DM the bot."""
    user = update.effective_user
    from .menu_handlers import show_menu_in_group
    await show_menu_in_group(update, context)


async def start_createquiz_group(update, context):
    """Entry point for the quiz creation conversation"""
    user = update.effective_user
    chat_type = update.effective_chat.type
    redis_client = RedisClient()
    user_id = user.id

    logger.info(
        f"User {user_id} initiating /createquiz from {chat_type} chat {update.effective_chat.id}."
    )

    # Clear potentially stale user_data from previous incomplete flows
    await redis_client.delete_user_data_key(user_id, "awaiting_reward_input_type")
    await redis_client.delete_user_data_key(user_id, "current_quiz_id_for_reward_setup")
    await redis_client.delete_user_data_key(
        user_id, "awaiting"
    )  # Legacy reward structure flag
    await redis_client.delete_user_data_key(
        user_id, "awaiting_reward_quiz_id"
    )  # Legacy reward quiz ID flag

    # Clear quiz creation specific data
    await redis_client.delete_user_data_key(user_id, "topic")
    await redis_client.delete_user_data_key(user_id, "num_questions")
    await redis_client.delete_user_data_key(user_id, "context_text")
    await redis_client.delete_user_data_key(
        user_id, "duration_seconds"
    )  # Ensure any old duration is cleared
    await redis_client.delete_user_data_key(
        user_id, "awaiting_duration_input"
    )  # Clear this flag as well
    await redis_client.delete_user_data_key(user_id, "awaiting_notes")  # Clear notes flag

    # Check if user has a wallet - if not, create one first
    from services.wallet_service import WalletService
    wallet_service = WalletService()
    has_wallet = await wallet_service.has_wallet_robust(user_id)
    
    if not has_wallet:
        logger.info(f"User {user_id} has no wallet, creating one before quiz creation.")
        
        if chat_type != "private":
            await update.message.reply_text(
                f"@{user.username}, I'll create a wallet for you first, then we'll set up your quiz in private chat."
            )
        
        # Send initial loading message
        loading_message = await context.bot.send_message(
            chat_id=user_id,
            text="🔧 **Creating your NEAR wallet...**\n\n⏳ Please wait while we set up your account on the blockchain...",
            parse_mode='Markdown'
        )
        
        try:
            # Update loading message with progress
            await loading_message.edit_text(
                "🔧 **Creating your NEAR wallet...**\n\n⏳ Generating secure keys and creating your account...",
                parse_mode='Markdown'
            )
            
            # Create wallet using existing service
            wallet_info = await wallet_service.create_demo_wallet(user_id, user.first_name)
            
            # Update loading message with final step
            await loading_message.edit_text(
                "🔧 **Creating your NEAR wallet...**\n\n✅ Account created! Finalizing your wallet...",
                parse_mode='Markdown'
            )
            
            # Format the wallet info message
            wallet_message, mini_app_keyboard = await wallet_service.format_wallet_info_message(wallet_info)
            
            # Update the loading message with the wallet creation result
            await loading_message.edit_text(
                f"🎉 **Wallet Created Successfully!**\n\n{wallet_message}\n\nNow let's create your quiz!",
                parse_mode='Markdown'
            )
            
            logger.info(f"Wallet created successfully for user {user_id}, proceeding to quiz creation.")
            
        except Exception as e:
            logger.error(f"Error creating wallet for user {user_id}: {e}")
            await loading_message.edit_text(
                "❌ **Wallet Creation Failed**\n\nSorry, there was an error creating your wallet. Please try again later.",
                parse_mode='Markdown'
            )
            return ConversationHandler.END

    if chat_type != "private":
        logger.info(
            f"User {user_id} started quiz creation from group chat {update.effective_chat.id}. Will DM."
        )
        await update.message.reply_text(
            f"@{user.username}, let's create a quiz! I'll message you privately to set it up."
        )
        await context.bot.send_message(
            chat_id=user_id, 
            text="🎯 Create Quiz - Step 1 of 4\n\nWhat's your quiz topic?\n\n[Quick Topics: Crypto | Gaming | Technology | Custom...]"
        )
        await redis_client.set_user_data_key(
            user_id, "group_chat_id", update.effective_chat.id
        )
        logger.info(
            f"Stored group_chat_id {update.effective_chat.id} for user {user_id}."
        )
        return TOPIC
    else:
        logger.info(f"User {user_id} started quiz creation directly in private chat.")
        await update.message.reply_text(
            "🎯 Create Quiz - Step 1 of 4\n\nWhat's your quiz topic?\n\n[Quick Topics: Crypto | Gaming | Technology | Custom...]"
        )
        # Clear any potential leftover group_chat_id if starting fresh in DM
        await redis_client.delete_user_data_key(user_id, "group_chat_id")
        logger.info(f"User {user_id} in private chat.")
        return TOPIC


async def topic_received(update, context):
    user_id = update.effective_user.id
    redis_client = RedisClient()
    topic = update.message.text.strip()
    logger.info(f"Received topic: {topic} from user {user_id}")
    await redis_client.set_user_data_key(user_id, "topic", topic)
    
    # Show topic and ask about notes
    buttons = [
        [InlineKeyboardButton("📝 Add Notes", callback_data="add_notes")],
        [InlineKeyboardButton("⏭️ Skip Notes", callback_data="skip_notes")]
    ]
    
    await update.message.reply_text(
        f"✅ Topic set: {topic}\n\n"
        f"Would you like to add any notes or context for your quiz?\n"
        f"(This helps AI generate better questions)",
        reply_markup=InlineKeyboardMarkup(buttons)
    )
    return NOTES_CHOICE


async def notes_choice(update, context):
    user_id = update.effective_user.id
    redis_client = RedisClient()
    choice = update.callback_query.data
    await update.callback_query.answer()
    
    if choice == "add_notes":
        await update.callback_query.message.reply_text(
            "📝 Add Quiz Notes (Optional)\n\n"
            "Share any additional information, context, or specific focus areas:\n\n"
            "Examples:\n"
            "• Focus on NEAR Protocol basics\n"
            "• Include questions about DeFi\n"
            "• Make it beginner-friendly\n"
            "• Based on recent crypto news\n\n"
            "💡 Tip: Keep notes concise (under 500 characters for best results)\n"
            "Type your notes or send 'skip' to continue:"
        )
        await redis_client.set_user_data_key(user_id, "awaiting_notes", True)
        return NOTES_INPUT
    
    elif choice == "skip_notes":
        await redis_client.set_user_data_key(user_id, "context_text", None)
        topic = await redis_client.get_user_data_key(user_id, "topic")
        
        buttons = [
            [InlineKeyboardButton("5", callback_data="size_5"),
             InlineKeyboardButton("10", callback_data="size_10"),
             InlineKeyboardButton("15", callback_data="size_15"),
             InlineKeyboardButton("20", callback_data="size_20")],
            [InlineKeyboardButton("Custom", callback_data="size_custom")]
        ]
        
        await update.callback_query.message.reply_text(
            f"✅ Topic: {topic}\n"
            f"📝 Notes: None\n"
            f"❓ Step 2 of 4: How many questions?",
            reply_markup=InlineKeyboardMarkup(buttons)
        )
        return SIZE


async def notes_input(update, context):
    user_id = update.effective_user.id
    redis_client = RedisClient()
    notes = update.message.text.strip()
    
    try:
        if notes.lower() == 'skip':
            await redis_client.set_user_data_key(user_id, "context_text", None)
            topic = await redis_client.get_user_data_key(user_id, "topic")
            
            buttons = [
                [InlineKeyboardButton("5", callback_data="size_5"),
                 InlineKeyboardButton("10", callback_data="size_10"),
                 InlineKeyboardButton("15", callback_data="size_15"),
                 InlineKeyboardButton("20", callback_data="size_20")],
                [InlineKeyboardButton("Custom", callback_data="size_custom")]
            ]
            
            await update.message.reply_text(
                f"✅ Topic: {topic}\n"
                f"📝 Notes: None\n"
                f"❓ Step 2 of 4: How many questions?",
                reply_markup=InlineKeyboardMarkup(buttons)
            )
        else:
            # Truncate notes if too long to prevent processing issues
            max_notes_length = 2000  # Limit to 2000 characters
            if len(notes) > max_notes_length:
                notes = notes[:max_notes_length] + "..."
                await update.message.reply_text(
                    f"📝 Notes truncated to {max_notes_length} characters for better processing."
                )
            
            await redis_client.set_user_data_key(user_id, "context_text", notes)
            topic = await redis_client.get_user_data_key(user_id, "topic")
            
            buttons = [
                [InlineKeyboardButton("5", callback_data="size_5"),
                 InlineKeyboardButton("10", callback_data="size_10"),
                 InlineKeyboardButton("15", callback_data="size_15"),
                 InlineKeyboardButton("20", callback_data="size_20")],
                [InlineKeyboardButton("Custom", callback_data="size_custom")]
            ]
            
            # Show a shorter preview of notes
            notes_preview = notes[:100] + "..." if len(notes) > 100 else notes
            
            await update.message.reply_text(
                f"✅ Topic: {topic}\n"
                f"📝 Notes: {notes_preview}\n"
                f"❓ Step 2 of 4: How many questions?",
                reply_markup=InlineKeyboardMarkup(buttons)
            )
        
        await redis_client.delete_user_data_key(user_id, "awaiting_notes")
        return SIZE
        
    except Exception as e:
        logger.error(f"Error in notes_input for user {user_id}: {e}")
        await update.message.reply_text(
            "Sorry, there was an error processing your notes. Please try again with shorter text or skip notes for now."
        )
        await redis_client.delete_user_data_key(user_id, "awaiting_notes")
        return SIZE


async def size_selection(update, context):
    """Handle size selection from inline keyboard buttons"""
    user_id = update.effective_user.id
    redis_client = RedisClient()
    choice = update.callback_query.data
    await update.callback_query.answer()
    
    size_map = {
        "size_5": 5,
        "size_10": 10,
        "size_15": 15,
        "size_20": 20,
        "size_custom": "custom"
    }
    
    if choice in size_map:
        if size_map[choice] == "custom":
            await update.callback_query.message.reply_text(
                "Enter custom number of questions:"
            )
            return SIZE
        else:
            n = size_map[choice]
            await redis_client.set_user_data_key(user_id, "num_questions", n)
            
            # Show progress and duration options with inline keyboard
            topic = await redis_client.get_user_data_key(user_id, "topic")
            context_text = await redis_client.get_user_data_key(user_id, "context_text")
            
            progress_text = f"✅ Topic: {topic}\n"
            if context_text:
                progress_text += f"📝 Notes: {context_text[:50]}{'...' if len(context_text) > 50 else ''}\n"
            else:
                progress_text += f"📝 Notes: None\n"
            progress_text += f"❓ Questions: {n}\n"
            progress_text += f"⏱ Step 3 of 4: Quiz duration"
            
            buttons = [
                [InlineKeyboardButton("5 min", callback_data="5_min"),
                 InlineKeyboardButton("10 min", callback_data="10_min"),
                 InlineKeyboardButton("30 min", callback_data="30_min")],
                [InlineKeyboardButton("1 hour", callback_data="1_hour"),
                 InlineKeyboardButton("No limit", callback_data="no_limit")],
                [InlineKeyboardButton("Custom duration", callback_data="set_duration")]
            ]
            
            await update.callback_query.message.reply_text(
                progress_text,
                reply_markup=InlineKeyboardMarkup(buttons)
            )
            return DURATION_CHOICE


async def size_received(update, context):
    user_id = update.effective_user.id
    redis_client = RedisClient()
    logger.info(f"Received size: {update.message.text} from user {user_id}")
    try:
        n = int(update.message.text.strip())
    except ValueError:
        await update.message.reply_text("Please send a valid number of questions.")
        return SIZE
    
    await redis_client.set_user_data_key(user_id, "num_questions", n)
    
    # Show progress and duration options with inline keyboard
    topic = await redis_client.get_user_data_key(user_id, "topic")
    context_text = await redis_client.get_user_data_key(user_id, "context_text")
    
    progress_text = f"✅ Topic: {topic}\n"
    if context_text:
        progress_text += f"📝 Notes: {context_text[:50]}{'...' if len(context_text) > 50 else ''}\n"
    else:
        progress_text += f"📝 Notes: None\n"
    progress_text += f"❓ Questions: {n}\n"
    progress_text += f"⏱ Step 3 of 4: Quiz duration"
    
    buttons = [
        [InlineKeyboardButton("5 min", callback_data="5_min"),
         InlineKeyboardButton("10 min", callback_data="10_min"),
         InlineKeyboardButton("30 min", callback_data="30_min")],
        [InlineKeyboardButton("1 hour", callback_data="1_hour"),
         InlineKeyboardButton("No limit", callback_data="no_limit")],
        [InlineKeyboardButton("Custom duration", callback_data="set_duration")]
    ]
    
    await update.message.reply_text(
        progress_text,
        reply_markup=InlineKeyboardMarkup(buttons)
    )
    return DURATION_CHOICE


async def context_choice(update, context):
    user_id = update.effective_user.id
    redis_client = RedisClient()
    choice = update.callback_query.data
    await update.callback_query.answer()
    if choice == "paste":
        await update.callback_query.message.reply_text(
            "Please send the text to base your quiz on."
        )
        return CONTEXT_INPUT
    # skip
    await redis_client.set_user_data_key(user_id, "context_text", None)
    # move to duration
    buttons = [
        [InlineKeyboardButton("Specify duration", callback_data="set_duration")],
        [InlineKeyboardButton("Skip", callback_data="skip_duration")],
    ]
    await update.callback_query.message.reply_text(
        "How long should the quiz be open? e.g. '5 minutes', or skip.",
        reply_markup=InlineKeyboardMarkup(buttons),
    )
    # Set the expectation that if user doesn't click a button, they might type a duration
    await redis_client.set_user_data_key(user_id, "awaiting_duration_input", True)
    logger.info(
        f"Showing duration options to user {user_id} after context_choice, set awaiting_duration_input=True"
    )
    return DURATION_CHOICE


async def context_input(update, context):
    user_id = update.effective_user.id
    redis_client = RedisClient()
    await redis_client.set_user_data_key(user_id, "context_text", update.message.text)
    # ask duration
    buttons = [
        [InlineKeyboardButton("Specify duration", callback_data="set_duration")],
        [InlineKeyboardButton("Skip", callback_data="skip_duration")],
    ]
    await update.message.reply_text(
        "How long should the quiz be open? e.g. '5 minutes', or skip.",
        reply_markup=InlineKeyboardMarkup(buttons),
    )
    # Set the expectation that if user doesn't click a button, they might type a duration
    await redis_client.set_user_data_key(user_id, "awaiting_duration_input", True)
    logger.info(
        f"Showing duration options to user {user_id} after context_input, set awaiting_duration_input=True"
    )
    return DURATION_CHOICE


async def duration_choice(update, context):
    user_id = update.effective_user.id
    redis_client = RedisClient()
    choice = update.callback_query.data
    await update.callback_query.answer()
    logger.info(f"duration_choice: User {user_id} selected {choice}")

    # Handle quick duration selections
    duration_map = {
        "5_min": 300,
        "10_min": 600, 
        "30_min": 1800,
        "1_hour": 3600,
        "no_limit": None
    }
    
    if choice in duration_map:
        await redis_client.set_user_data_key(user_id, "duration_seconds", duration_map[choice])
        await redis_client.delete_user_data_key(user_id, "awaiting_duration_input")
        
        # Show final step with reward options
        topic = await redis_client.get_user_data_key(user_id, "topic")
        num_questions = await redis_client.get_user_data_key(user_id, "num_questions")
        context_text = await redis_client.get_user_data_key(user_id, "context_text")
        
        progress_text = f"✅ Topic: {topic}\n"
        if context_text:
            progress_text += f"📝 Notes: {context_text[:50]}{'...' if len(context_text) > 50 else ''}\n"
        else:
            progress_text += f"📝 Notes: None\n"
        progress_text += f"❓ Questions: {num_questions}\n"
        
        if duration_map[choice]:
            progress_text += f"⏱ Duration: {duration_map[choice]//60} minutes\n"
        else:
            progress_text += f"⏱ Duration: No limit\n"
        
        progress_text += f"💰 Step 4 of 4: Reward Setup"
        
        # Get wallet info and balance for user
        from services.wallet_service import WalletService
        wallet_service = WalletService()
        wallet = await wallet_service.get_user_wallet(user_id)
        wallet_balance = await wallet_service.get_wallet_balance(user_id)
        
        if wallet and wallet.get('account_id'):
            progress_text += f"\n\n💳 Wallet: `{wallet['account_id']}`\n💰 Balance: {wallet_balance}"
        else:
            progress_text += f"\n\n💳 Wallet Balance: {wallet_balance}"
        
        buttons = [
            [InlineKeyboardButton("Free Quiz", callback_data="reward_free"),
             InlineKeyboardButton("0.1 NEAR", callback_data="reward_0.1"),
             InlineKeyboardButton("0.5 NEAR", callback_data="reward_0.5")],
            [InlineKeyboardButton("Custom amount", callback_data="reward_custom")]
        ]
        
        await update.callback_query.message.reply_text(
            progress_text,
            reply_markup=InlineKeyboardMarkup(buttons)
        )
        return REWARD_CHOICE
    
    elif choice == "set_duration":
        # Set a special flag to identify duration input messages
        await redis_client.set_user_data_key(user_id, "awaiting_duration_input", True)
        logger.info(f"Setting awaiting_duration_input flag for user {user_id}")

        await update.callback_query.message.reply_text(
            "Send duration, e.g. '5 minutes' or '2 hours'."
        )
        logger.info(
            f"duration_choice: Returning DURATION_INPUT state for user {user_id}"
        )
        return DURATION_INPUT
    
    # skip ("skip_duration")
    await redis_client.set_user_data_key(
        user_id, "duration_seconds", None
    )  # Explicitly set to None if skipped
    # Clear the flag if it was set and then skipped via button
    await redis_client.delete_user_data_key(user_id, "awaiting_duration_input")
    logger.info(
        f"duration_choice: User {user_id} skipped duration, duration_seconds set to None. Going to confirm_prompt"
    )
    # preview
    return await confirm_prompt(
        update, context
    )  # confirm_prompt will need redis_client too


async def duration_input(update, context):
    user_id = update.effective_user.id
    redis_client = RedisClient()
    message_text = update.message.text
    logger.info(
        f"Attempting to process DURATION_INPUT: '{message_text}' from user {user_id}"
    )
    # logger.debug(f"User data for {user_id} at duration_input: {context.user_data}") # Cannot log context.user_data
    txt = message_text.strip().lower()

    parsed_successfully = False
    secs = None

    # Primary regex: attempts to match common patterns like "10 min", "2 hours", "30minutes"
    m = re.match(r"(\d+)\s*(minute|min|hour|hr)s?", txt)
    if m:
        val = int(m.group(1))
        unit = m.group(2)
        if unit.startswith("hour") or unit.startswith("hr"):
            secs = val * 3600
        else:  # minute or min
            secs = val * 60

        await redis_client.set_user_data_key(user_id, "duration_seconds", secs)
        logger.info(
            f"Successfully parsed duration (primary regex) for user {user_id}: {secs} seconds from '{message_text}'"
        )
        parsed_successfully = True
    else:
        # Fallback: search for a number, then check for keywords if primary regex fails
        m_val_search = re.search(r"(\d+)", txt)
        if m_val_search:
            val = int(m_val_search.group(1))
            if "hour" in txt or "hr" in txt:
                secs = val * 3600
                await redis_client.set_user_data_key(user_id, "duration_seconds", secs)
                logger.info(
                    f"Successfully parsed duration (fallback - hours) for user {user_id}: {secs} seconds from '{message_text}'"
                )
                parsed_successfully = True
            elif "minute" in txt or "min" in txt:
                secs = val * 60
                await redis_client.set_user_data_key(user_id, "duration_seconds", secs)
                logger.info(
                    f"Successfully parsed duration (fallback - minutes) for user {user_id}: {secs} seconds from '{message_text}'"
                )
                parsed_successfully = True

    if parsed_successfully:
        await redis_client.delete_user_data_key(
            user_id, "awaiting_duration_input"
        )  # Clear flag as input is now processed
        duration_seconds_val = await redis_client.get_user_data_key(
            user_id, "duration_seconds"
        )
        logger.info(
            f"duration_input: Parsed successfully, proceeding to confirm_prompt for user {user_id}. duration_seconds: {duration_seconds_val}"
        )
        return await confirm_prompt(
            update, context
        )  # confirm_prompt will need redis_client too
    else:
        # If parsing failed either way
        await update.message.reply_text(
            "Sorry, I didn't understand that duration. Please use a format like '10 minutes' or '1 hour'. You can also use the 'Skip' button from the previous message if you don't want to set a duration."
        )
        # Stay in DURATION_INPUT state to allow user to retry or use the skip button from the prior message.
        # The 'awaiting_duration_input' flag remains True.
        return DURATION_INPUT


async def reward_choice(update, context):
    user_id = update.effective_user.id
    redis_client = RedisClient()
    choice = update.callback_query.data
    await update.callback_query.answer()
    
    # Handle reward amount selection
    if choice.startswith("reward_"):
        reward_type = choice.replace("reward_", "")
        
        if reward_type == "free":
            await redis_client.set_user_data_key(user_id, "reward_amount", 0)
            await redis_client.set_user_data_key(user_id, "reward_structure", "free")
            await redis_client.set_user_data_key(user_id, "total_cost", 0)
            await redis_client.set_user_data_key(user_id, "payment_status", "not_required")
            return await confirm_prompt(update, context)
        
        elif reward_type == "custom":
            await update.callback_query.message.reply_text(
                "Enter custom reward amount in NEAR:"
            )
            return REWARD_CUSTOM_INPUT
        
        else:
            # Handle 0.1 or 0.5 NEAR rewards
            try:
                reward_amount = float(reward_type)
                await redis_client.set_user_data_key(user_id, "reward_amount", reward_amount)
                
                # Show reward structure options
                await show_reward_structure_options(update, context, reward_amount)
                return REWARD_STRUCTURE_CHOICE
                
            except ValueError:
                await update.callback_query.message.reply_text(
                    "Please select a valid reward option."
                )
                return REWARD_CHOICE
    
    # Handle text input for reward (if user types instead of using buttons)
    try:
        reward_amount = float(choice)
        await redis_client.set_user_data_key(user_id, "reward_amount", reward_amount)
        await show_reward_structure_options(update, context, reward_amount)
        return REWARD_STRUCTURE_CHOICE
    except ValueError:
        await update.callback_query.message.reply_text(
            "Please enter a valid reward amount in NEAR or use the buttons above."
        )
        return REWARD_CHOICE


async def show_reward_structure_options(update, context, reward_amount):
    """Show reward structure options for paid quizzes"""
    user_id = update.effective_user.id
    redis_client = RedisClient()
    
    # Get current quiz details for display
    topic = await redis_client.get_user_data_key(user_id, "topic")
    num_questions = await redis_client.get_user_data_key(user_id, "num_questions")
    context_text = await redis_client.get_user_data_key(user_id, "context_text")
    duration_seconds = await redis_client.get_user_data_key(user_id, "duration_seconds")
    
    progress_text = f"✅ Topic: {topic}\n"
    if context_text:
        progress_text += f"📝 Notes: {context_text[:50]}{'...' if len(context_text) > 50 else ''}\n"
    else:
        progress_text += f"📝 Notes: None\n"
    progress_text += f"❓ Questions: {num_questions}\n"
    
    if duration_seconds:
        progress_text += f"⏱ Duration: {duration_seconds//60} minutes\n"
    else:
        progress_text += f"⏱ Duration: No limit\n"
    
    progress_text += f"💰 Reward Amount: {reward_amount} NEAR\n"
    progress_text += f"📊 Step 4b of 4: Reward Structure"
    
    # Calculate total costs for different structures
    wta_total = reward_amount
    top3_total = reward_amount * 3  # 1st, 2nd, 3rd place
    custom_total = reward_amount  # Base amount, can be modified
    
    progress_text += f"\n\n💡 Total Cost Options:\n"
    progress_text += f"• Winner-takes-all: {wta_total} NEAR\n"
    progress_text += f"• Top 3 winners: {top3_total} NEAR\n"
    progress_text += f"• Custom structure: {custom_total} NEAR"
    
    buttons = [
        [InlineKeyboardButton(f"Winner-takes-all ({wta_total} NEAR)", callback_data="structure_wta")],
        [InlineKeyboardButton(f"Top 3 winners ({top3_total} NEAR)", callback_data="structure_top3")],
        [InlineKeyboardButton(f"Custom structure", callback_data="structure_custom")]
    ]
    
    if update.callback_query:
        await update.callback_query.message.reply_text(
            progress_text,
            reply_markup=InlineKeyboardMarkup(buttons)
        )
    else:
        await update.message.reply_text(
            progress_text,
            reply_markup=InlineKeyboardMarkup(buttons)
        )


async def reward_structure_choice(update, context):
    """Handle reward structure selection"""
    user_id = update.effective_user.id
    redis_client = RedisClient()
    choice = update.callback_query.data
    await update.callback_query.answer()
    
    if choice == "structure_wta":
        await redis_client.set_user_data_key(user_id, "reward_structure", "winner_takes_all")
        await redis_client.set_user_data_key(user_id, "total_cost", await redis_client.get_user_data_key(user_id, "reward_amount"))
        return await payment_verification(update, context)
    
    elif choice == "structure_top3":
        reward_amount = await redis_client.get_user_data_key(user_id, "reward_amount")
        total_cost = float(reward_amount) * 3
        await redis_client.set_user_data_key(user_id, "reward_structure", "top_3")
        await redis_client.set_user_data_key(user_id, "total_cost", total_cost)
        return await payment_verification(update, context)
    
    elif choice == "structure_custom":
        await update.callback_query.message.reply_text(
            "Enter custom reward structure (e.g., '0.5 NEAR for 1st, 0.3 NEAR for 2nd, 0.2 NEAR for 3rd'):"
        )
        return REWARD_CUSTOM_STRUCTURE_INPUT


async def payment_verification(update, context):
    """Handle payment verification and processing"""
    user_id = update.effective_user.id
    redis_client = RedisClient()
    
    # Get quiz details and cost
    total_cost = await redis_client.get_user_data_key(user_id, "total_cost")
    reward_amount = await redis_client.get_user_data_key(user_id, "reward_amount")
    reward_structure = await redis_client.get_user_data_key(user_id, "reward_structure")
    
    # Check if it's a free quiz
    if total_cost == 0 or reward_amount == 0:
        await redis_client.set_user_data_key(user_id, "payment_status", "not_required")
        return await confirm_prompt(update, context)
    
    # Get wallet balance (force refresh for payment verification)
    from services.wallet_service import WalletService
    wallet_service = WalletService()
    wallet_balance_str = await wallet_service.get_wallet_balance(user_id, force_refresh=True)
    
    # Parse balance (e.g., "0.5000 NEAR" -> 0.5)
    try:
        balance_match = re.search(r'(\d+\.?\d*)', wallet_balance_str)
        wallet_balance = float(balance_match.group(1)) if balance_match else 0.0
        logger.debug(f"Parsed wallet balance for user {user_id}: {wallet_balance} NEAR (from: {wallet_balance_str})")
    except Exception as e:
        logger.error(f"Error parsing wallet balance for user {user_id}: {e}")
        wallet_balance = 0.0
    
    total_cost_float = float(total_cost)
    
    # Check if user has sufficient funds
    if wallet_balance >= total_cost_float:
        # Sufficient funds - proceed with payment
        return await process_payment(update, context, total_cost_float)
    else:
        # Insufficient funds - show funding instructions
        return await show_funding_instructions(update, context, total_cost_float, wallet_balance)


async def process_payment(update, context, total_cost):
    """Process payment for quiz creation"""
    user_id = update.effective_user.id
    redis_client = RedisClient()
    
    try:
        # Get wallet info
        from services.wallet_service import WalletService
        wallet_service = WalletService()
        wallet = await wallet_service.get_user_wallet(user_id)
        
        if not wallet:
            await update.callback_query.message.reply_text(
                "❌ Error: Wallet not found. Please try again."
            )
            return ConversationHandler.END
        
        # Show payment processing message
        processing_msg = await update.callback_query.message.reply_text(
            f"💳 Processing payment of {total_cost} NEAR...\n\n⏳ Please wait while we process the transaction..."
        )
        
        # Calculate payment with 1% charge
        base_amount = float(total_cost)
        service_charge = base_amount * 0.01  # 1% charge
        total_amount = base_amount + service_charge
        
        # Convert to yoctoNEAR
        total_yocto = int(total_amount * (10 ** 24))
        
        # Get main account address from config
        from utils.config import Config
        main_account_address = Config.NEAR_WALLET_ADDRESS
        
        # Process real NEAR transaction
        transaction_result = await process_real_near_payment(
            wallet, 
            main_account_address, 
            total_yocto,
            user_id
        )
        
        if transaction_result['success']:
            # Store payment info
            await redis_client.set_user_data_key(user_id, "payment_status", "completed")
            await redis_client.set_user_data_key(user_id, "payment_amount", total_cost)
            await redis_client.set_user_data_key(user_id, "service_charge", service_charge)
            await redis_client.set_user_data_key(user_id, "total_paid", total_amount)
            await redis_client.set_user_data_key(user_id, "transaction_hash", transaction_result['transaction_hash'])
            await redis_client.set_user_data_key(user_id, "payment_timestamp", str(datetime.datetime.now()))
            
            # Update processing message
            await processing_msg.edit_text(
                f"✅ Payment successful!\n\n"
                f"💳 Amount: {total_cost} NEAR\n"
                f"💰 Service Charge: {service_charge:.4f} NEAR\n"
                f"💸 Total Paid: {total_amount:.4f} NEAR\n"
                f"🔗 Transaction: {transaction_result['transaction_hash'][:20]}...\n"
                f"📊 Status: Confirmed\n\n"
                f"🛠 Generating your quiz..."
            )
            
            # Proceed to quiz generation
            return await confirm_prompt(update, context)
        else:
            # Payment failed - show retry option
            await processing_msg.edit_text(
                f"❌ Payment failed!\n\n"
                f"💳 Amount: {total_cost} NEAR\n"
                f"💰 Service Charge: {service_charge:.4f} NEAR\n"
                f"💸 Total: {total_amount:.4f} NEAR\n"
                f"❌ Error: {transaction_result['error']}\n\n"
                f"Please check your balance and try again."
            )
            
            # Show retry buttons
            buttons = [
                [InlineKeyboardButton("🔄 Retry Payment", callback_data="retry_payment")],
                [InlineKeyboardButton("❌ Cancel Quiz", callback_data="cancel_quiz")]
            ]
            
            await update.callback_query.message.reply_text(
                "Would you like to retry the payment?",
                reply_markup=InlineKeyboardMarkup(buttons)
            )
            
            return PAYMENT_VERIFICATION
        
    except Exception as e:
        logger.error(f"Error processing payment for user {user_id}: {e}")
        await update.callback_query.message.reply_text(
            "❌ Payment processing failed. Please try again."
        )
        return ConversationHandler.END


async def show_funding_instructions(update, context, required_amount, current_balance):
    """Show funding instructions for insufficient funds"""
    user_id = update.effective_user.id
    redis_client = RedisClient()
    
    # Get wallet info
    from services.wallet_service import WalletService
    wallet_service = WalletService()
    wallet = await wallet_service.get_user_wallet(user_id)
    
    shortfall = required_amount - current_balance
    
    funding_text = f"💰 **Payment Required**\n\n"
    funding_text += f"Required: {required_amount} NEAR\n"
    funding_text += f"Current Balance: {current_balance} NEAR\n"
    funding_text += f"Shortfall: {shortfall} NEAR\n\n"
    
    if wallet and wallet.get('account_id'):
        funding_text += f"**Your Wallet Address:**\n`{wallet['account_id']}`\n\n"
    
    funding_text += f"To fund your wallet:\n\n"
    funding_text += f"1️⃣ **Copy your wallet address** above\n"
    funding_text += f"2️⃣ **Send NEAR** to that address\n"
    funding_text += f"3️⃣ **Wait for confirmation** (usually 1-2 minutes)\n"
    funding_text += f"4️⃣ **Click 'Check Balance'** below\n\n"
    funding_text += f"💡 **Quick Funding Options:**\n"
    funding_text += f"• Use a faucet for testnet NEAR\n"
    funding_text += f"• Buy from exchanges like Binance, Coinbase\n"
    funding_text += f"• Transfer from another wallet\n\n"
    funding_text += f"💡 **Note:** Your account was created with {Config.MINIMAL_ACCOUNT_BALANCE} NEAR for storage costs.\n\n"
    funding_text += f"Once funded, click 'Check Balance' to continue."
    
    buttons = [
        [InlineKeyboardButton("🔄 Check Balance", callback_data="check_balance")],
        [InlineKeyboardButton("❌ Cancel Quiz", callback_data="cancel_quiz")]
    ]
    
    await update.callback_query.message.reply_text(
        funding_text,
        parse_mode='Markdown',
        reply_markup=InlineKeyboardMarkup(buttons)
    )
    
    return PAYMENT_VERIFICATION


async def handle_payment_verification_callback(update, context):
    """Handle payment verification callbacks"""
    user_id = update.effective_user.id
    choice = update.callback_query.data
    await update.callback_query.answer()
    
    if choice == "check_balance":
        # Re-check balance and proceed if sufficient (force refresh)
        return await payment_verification(update, context)
    
    elif choice == "retry_payment":
        # Retry payment with current settings
        redis_client = RedisClient()
        total_cost = await redis_client.get_user_data_key(user_id, "total_cost")
        if total_cost:
            return await process_payment(update, context, total_cost)
        else:
            await update.callback_query.message.reply_text(
                "❌ Error: Payment amount not found. Please start over."
            )
            return ConversationHandler.END
    
    elif choice == "cancel_quiz":
        # Clear quiz data and end conversation
        redis_client = RedisClient()
        await redis_client.clear_user_data(user_id)
        await update.callback_query.message.reply_text(
            "❌ Quiz creation cancelled. You can start over with /createquiz"
        )
        return ConversationHandler.END


async def reward_custom_input(update, context):
    user_id = update.effective_user.id
    redis_client = RedisClient()
    
    try:
        reward_amount = float(update.message.text.strip())
        await redis_client.set_user_data_key(user_id, "reward_amount", reward_amount)
        
        # Show reward structure options for custom amount
        await show_reward_structure_options(update, context, reward_amount)
        return REWARD_STRUCTURE_CHOICE
        
    except ValueError:
        await update.message.reply_text(
            "Please enter a valid number for the reward amount in NEAR."
        )
        return REWARD_CUSTOM_INPUT


async def confirm_prompt(update, context):
    user_id = update.effective_user.id
    redis_client = RedisClient()

    topic = await redis_client.get_user_data_key(user_id, "topic")
    n = await redis_client.get_user_data_key(user_id, "num_questions")
    context_text = await redis_client.get_user_data_key(user_id, "context_text")
    dur = await redis_client.get_user_data_key(user_id, "duration_seconds")
    reward_amount = await redis_client.get_user_data_key(user_id, "reward_amount")
    reward_structure = await redis_client.get_user_data_key(user_id, "reward_structure")
    total_cost = await redis_client.get_user_data_key(user_id, "total_cost")
    payment_status = await redis_client.get_user_data_key(user_id, "payment_status")
    service_charge = await redis_client.get_user_data_key(user_id, "service_charge")
    total_paid = await redis_client.get_user_data_key(user_id, "total_paid")
    transaction_hash = await redis_client.get_user_data_key(user_id, "transaction_hash")

    # Ensure values are not None before using in f-string or arithmetic
    n = n if n is not None else 0
    topic = topic if topic is not None else "[Unknown Topic]"
    reward_amount = reward_amount if reward_amount is not None else 0
    total_cost = total_cost if total_cost is not None else 0

    text = f"🎯 Quiz Summary:\n\n"
    text += f" Topic: {topic}\n"
    text += f"❓ Questions: {n}\n"
    
    if context_text:
        text += f"📋 Notes: {context_text[:100]}{'...' if len(context_text) > 100 else ''}\n"
    
    if dur:
        text += f"⏱ Duration: {dur//60} minutes\n"
    else:
        text += f"⏱ Duration: No limit\n"
    
    if reward_amount > 0:
        text += f"💰 Reward Amount: {reward_amount} NEAR\n"
        if reward_structure:
            structure_display = {
                "winner_takes_all": "Winner-takes-all",
                "top_3": "Top 3 winners",
                "free": "Free quiz"
            }.get(reward_structure, reward_structure)
            text += f"📊 Structure: {structure_display}\n"
        if total_cost > 0:
            text += f"💳 Total Cost: {total_cost} NEAR\n"
            if service_charge:
                text += f"💰 Service Charge: {service_charge} NEAR\n"
            if total_paid:
                text += f"💸 Total Paid: {total_paid} NEAR\n"
            if payment_status == "completed":
                text += f"✅ Payment: Completed\n"
                if transaction_hash:
                    text += f"🔗 Transaction: {transaction_hash[:20]}...\n"
            elif payment_status == "not_required":
                text += f"✅ Payment: Not Required\n"
            else:
                text += f"⏳ Payment: Pending\n"
    else:
        text += f"💰 Reward: Free\n"
    
    text += f"\nGenerate this quiz?"

    buttons = [
        [InlineKeyboardButton("✅ Generate Quiz", callback_data="yes")],
        [InlineKeyboardButton("❌ Cancel", callback_data="no")]
    ]
    
    if update.callback_query:
        msg = update.callback_query.message
    else:
        msg = update.message
        
    await msg.reply_text(text, reply_markup=InlineKeyboardMarkup(buttons))
    return CONFIRM


async def confirm_choice(update, context):
    user_id = update.effective_user.id
    redis_client = RedisClient()
    choice = update.callback_query.data
    await update.callback_query.answer()

    if choice == "no":
        await update.callback_query.message.reply_text("Quiz creation canceled.")
        await redis_client.clear_user_data(user_id)  # Clear data on cancellation
        return ConversationHandler.END

    # Check payment status before generating quiz
    payment_status = await redis_client.get_user_data_key(user_id, "payment_status")
    total_cost = await redis_client.get_user_data_key(user_id, "total_cost")
    
    # For paid quizzes, ensure payment is completed
    if total_cost and float(total_cost) > 0:
        if payment_status != "completed":
            await update.callback_query.message.reply_text(
                "❌ Payment verification required. Please complete payment before generating quiz."
            )
            return ConversationHandler.END
    
    # yes: generate and post
    await update.callback_query.message.reply_text("🛠 Generating your quiz—one moment…")

    # Fetch all necessary data from Redis
    topic = await redis_client.get_user_data_key(user_id, "topic")
    num_questions = await redis_client.get_user_data_key(user_id, "num_questions")
    context_text = await redis_client.get_user_data_key(user_id, "context_text")
    group_chat_id = await redis_client.get_user_data_key(user_id, "group_chat_id")
    duration_seconds = await redis_client.get_user_data_key(user_id, "duration_seconds")
    reward_amount = await redis_client.get_user_data_key(user_id, "reward_amount")
    reward_structure = await redis_client.get_user_data_key(user_id, "reward_structure")

    # Handle cases where essential data might be missing (e.g., if Redis errored or keys expired)
    if not topic or num_questions is None:  # num_questions can be 0, so check for None
        logger.error(
            f"Missing essential quiz data for user {user_id} in confirm_choice. Topic: {topic}, NumQ: {num_questions}"
        )
        await update.callback_query.message.reply_text(
            "Sorry, some quiz details were lost. Please start over."
        )
        await redis_client.clear_user_data(user_id)
        return ConversationHandler.END

    quiz_text = await generate_quiz(topic, num_questions, context_text)

    group_chat_id_to_use = group_chat_id if group_chat_id else update.effective_chat.id

    # Call process_questions with enhanced data including payment info
    await process_questions_with_payment(
        update,
        context,
        topic,
        quiz_text,
        group_chat_id_to_use,
        duration_seconds=duration_seconds,
        reward_amount=reward_amount,
        reward_structure=reward_structure,
        payment_status=payment_status,
        total_cost=total_cost
    )

    # Clear conversation data for quiz creation
    await redis_client.clear_user_data(user_id)
    return ConversationHandler.END


async def process_real_near_payment(wallet: dict, receiver_address: str, amount_yocto: int, user_id: int) -> dict:
    """
    Process real NEAR payment from user's sub-account to main account
    """
    try:
        from py_near.account import Account
        from utils.config import Config
        from services.near_wallet_service import NEARWalletService
        
        # Decrypt user's private key
        near_service = NEARWalletService()
        private_key = near_service.decrypt_private_key(
            wallet['encrypted_private_key'],
            wallet['iv'],
            wallet['tag']
        )
        
        # Create Account instance for user's sub-account
        user_account = Account(
            account_id=wallet['account_id'],
            private_key=private_key,
            rpc_addr=Config.NEAR_RPC_ENDPOINT
        )
        
        # Send money to main account
        logger.info(f"Processing NEAR payment: {wallet['account_id']} -> {receiver_address}, Amount: {amount_yocto} yoctoNEAR")
        
        transaction_result = await user_account.send_money(
            receiver_id=receiver_address,
            amount=amount_yocto,
            nowait=False  # Wait for transaction execution
        )
        
        # Clear private key from memory for security
        private_key = None
        
        # Extract transaction hash
        if hasattr(transaction_result, 'transaction_hash'):
            transaction_hash = transaction_result.transaction_hash
        elif hasattr(transaction_result, 'hash'):
            transaction_hash = transaction_result.hash
        else:
            transaction_hash = str(transaction_result)
        
        logger.info(f"NEAR payment successful for user {user_id}: {transaction_hash}")
        
        return {
            'success': True,
            'transaction_hash': transaction_hash,
            'transaction_result': transaction_result
        }
        
    except Exception as e:
        logger.error(f"NEAR payment failed for user {user_id}: {e}")
        
        # Clear private key from memory for security
        if 'private_key' in locals():
            private_key = None
        
        return {
            'success': False,
            'error': str(e),
            'transaction_hash': None
        }


async def process_questions_with_payment(
    update, 
    context, 
    topic, 
    quiz_text, 
    group_chat_id, 
    duration_seconds=None,
    reward_amount=None,
    reward_structure=None,
    payment_status=None,
    total_cost=None
):
    """
    Enhanced process_questions function with payment integration
    """
    user_id = update.effective_user.id
    redis_client = RedisClient()
    
    try:
        # Process the quiz questions using existing logic
        await process_questions(
            update,
            context,
            topic,
            quiz_text,
            group_chat_id,
            duration_seconds=duration_seconds
        )
        
        # Add payment and reward information to the quiz
        if reward_amount and float(reward_amount) > 0:
            # Store payment information in the quiz record
            await store_payment_info_in_quiz(user_id, {
                'reward_amount': reward_amount,
                'reward_structure': reward_structure,
                'payment_status': payment_status,
                'total_cost': total_cost,
                'payment_timestamp': await redis_client.get_user_data_key(user_id, "payment_timestamp")
            })
            
            # Send payment confirmation message
            payment_msg = f"💳 **Payment Confirmed**\n\n"
            payment_msg += f"💰 Amount: {total_cost} NEAR\n"
            payment_msg += f"📊 Structure: {reward_structure}\n"
            payment_msg += f"✅ Status: {payment_status}\n\n"
            payment_msg += f"🎯 Your quiz is now active with rewards!"
            
            await context.bot.send_message(
                chat_id=user_id,
                text=payment_msg,
                parse_mode='Markdown'
            )
            
            logger.info(f"Payment confirmed for quiz creation by user {user_id}: {total_cost} NEAR")
        
        else:
            # Free quiz - no payment required
            logger.info(f"Free quiz created by user {user_id}")
            
    except Exception as e:
        logger.error(f"Error in process_questions_with_payment for user {user_id}: {e}")
        await context.bot.send_message(
            chat_id=user_id,
            text="❌ Error creating quiz. Please try again."
        )


async def store_payment_info_in_quiz(user_id: int, payment_info: dict):
    """
    Store payment information in the quiz record
    """
    try:
        # TODO: Implement actual database storage for payment info
        # For now, log the payment information
        logger.info(f"Payment info for user {user_id}: {payment_info}")
        
        # In the future, this would store payment info in the quiz table
        # await db_service.update_quiz_payment_info(quiz_id, payment_info)
        
    except Exception as e:
        logger.error(f"Error storing payment info for user {user_id}: {e}")


async def start_reward_setup_callback(update: Update, context: CallbackContext):
    """Handles the 'Setup Rewards' button press and presents reward configuration options."""
    query = update.callback_query
    await query.answer()  # Acknowledge the button press
    user_id = update.effective_user.id
    redis_client = RedisClient()

    try:
        action, quiz_id = query.data.split(":")
        if action != "reward_setup_start":
            logger.warning(
                f"Unexpected action in start_reward_setup_callback: {action}"
            )
            await query.edit_message_text(
                "Sorry, there was an error. Please try creating the quiz again."
            )
            return
    except ValueError:
        logger.error(f"Could not parse quiz_id from callback_data: {query.data}")
        await query.edit_message_text(
            "Error: Could not identify the quiz. Please try again."
        )
        return

    await redis_client.set_user_data_key(
        user_id, "current_quiz_id_for_reward_setup", quiz_id
    )

    logger.info(f"User {user_id} starting reward setup for quiz {quiz_id}")

    keyboard = [
        [
            InlineKeyboardButton(
                "🏆 Winner Takes All", callback_data=f"reward_method:wta:{quiz_id}"
            )
        ],
        [
            InlineKeyboardButton(
                "🥇🥈🥉 Reward Top 3", callback_data=f"reward_method:top3:{quiz_id}"
            )
        ],
        [
            InlineKeyboardButton(
                "✨ Custom Setup (Guided)",
                callback_data=f"reward_method:custom:{quiz_id}",
            )
        ],
        [
            InlineKeyboardButton(
                "✍️ Type Manually", callback_data=f"reward_method:manual:{quiz_id}"
            )
        ],
        [
            InlineKeyboardButton(
                "🔙 Cancel", callback_data=f"reward_method:cancel_setup:{quiz_id}"
            )
        ],
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)

    await query.edit_message_text(
        text=f"Let's set up rewards for your quiz (ID: {quiz_id}). How would you like to do it?",
        reply_markup=reply_markup,
    )
    return  # Or a new state for a ConversationHandler


async def handle_reward_method_choice(update: Update, context: CallbackContext):
    """Handles the choice of reward method (WTA, Top3, Custom, Manual)."""
    query = update.callback_query
    await query.answer()
    user_id = update.effective_user.id
    redis_client = RedisClient()

    try:
        _, method, quiz_id = query.data.split(":")
    except ValueError:
        logger.error(
            f"Could not parse reward method/quiz_id from callback_data: {query.data}"
        )
        await query.edit_message_text("Error: Invalid selection. Please try again.")
        return

    await redis_client.set_user_data_key(
        user_id, "current_quiz_id_for_reward_setup", quiz_id
    )  # Ensure it's set

    if method == "wta":
        await redis_client.set_user_data_key(
            user_id, "awaiting_reward_input_type", "wta_amount"
        )
        await query.edit_message_text(
            f"🏆 Winner Takes All selected for Quiz {quiz_id}.\nPlease enter the total prize amount (e.g., '5 NEAR', '10 USDT')."
        )
    elif method == "top3":
        await redis_client.set_user_data_key(
            user_id, "awaiting_reward_input_type", "top3_details"
        )
        await query.edit_message_text(
            f"🥇🥈🥉 Reward Top 3 selected for Quiz {quiz_id}.\nPlease describe the rewards for 1st, 2nd, and 3rd place (e.g., '3 NEAR for 1st, 2 NEAR for 2nd, 1 NEAR for 3rd')."
        )
    elif method == "custom":
        await redis_client.set_user_data_key(
            user_id, "awaiting_reward_input_type", "custom_details"
        )
        await query.edit_message_text(
            f"✨ Custom Setup for Quiz {quiz_id}.\nFor now, please describe the reward structure manually (e.g., '1st: 5N, 2nd-5th: 1N each')."
        )
    elif method == "manual":
        await redis_client.set_user_data_key(
            user_id, "awaiting_reward_input_type", "manual_free_text"
        )
        await query.edit_message_text(
            f"✍️ Manual Input selected for Quiz {quiz_id}.\nPlease type the reward structure (e.g., '2 Near for 1st, 1 Near for 2nd')."
        )
    elif method == "cancel_setup":
        await query.edit_message_text(f"Reward setup for Quiz {quiz_id} cancelled.")
        await redis_client.delete_user_data_key(
            user_id, "current_quiz_id_for_reward_setup"
        )
        await redis_client.delete_user_data_key(user_id, "awaiting_reward_input_type")
        return ConversationHandler.END  # Or just return if not in a conv
    else:
        await query.edit_message_text("Invalid choice. Please try again.")
        return

    logger.info(
        f"User {user_id} selected reward method {method} for quiz {quiz_id}."  # Cannot log user_data directly
    )
    # Subsequent input will be handled by private_message_handler
    # based on 'awaiting_reward_input_type'.


async def create_quiz_handler(update: Update, context: CallbackContext):
    """Handler for /createquiz command."""
    await create_quiz(update, context)


async def link_wallet_handler(update: Update, context: CallbackContext):
    """Handler for /linkwallet command - uses service to prompt for wallet."""
    # This now calls the function from user_service.py
    await service_link_wallet(update, context)


async def unlink_wallet_handler(update: Update, context: CallbackContext):
    """Handler for /unlinkwallet command."""
    user = update.effective_user
    if not user:
        await update.message.reply_text("Could not identify user.")
        return

    user_id = user.id

    existing_wallet = await get_user_wallet(user_id)
    if not existing_wallet:
        await update.message.reply_text("You do not have any wallet linked.")
        return

    # This assumes remove_user_wallet returns True on success, False on failure
    if await remove_user_wallet(user_id):
        await update.message.reply_text(
            f"✅ Your wallet `{existing_wallet}` has been unlinked successfully."
        )
    else:
        await update.message.reply_text(
            "⚠️ Failed to unlink your wallet. Please try again or contact support."
        )


async def play_quiz_handler(update: Update, context: CallbackContext):
    """Handler for /playquiz command."""
    await play_quiz(update, context)


# Handle selection when multiple quizzes are active in a group
async def play_quiz_selection_callback(update: Update, context: CallbackContext):
    """Handles selection of a quiz when multiple active quizzes exist in a group"""
    query = update.callback_query
    await query.answer()

    # Extract chosen quiz ID and original user ID from callback data
    try:
        _, quiz_id, original_user_id = query.data.split(":", 2)
    except ValueError:
        await query.edit_message_text("Invalid selection. Please try /playquiz again.")
        return

    # Check if the current user is the same as the original user who requested the quiz
    current_user_id = str(update.effective_user.id)
    if current_user_id != original_user_id:
        # Show a notification to the wrong user, but don't edit the message
        await query.answer(
            "This quiz selection is for another user. Please run /playquiz yourself to start a quiz.",
            show_alert=True,
        )
        return

    # Confirm selection to the correct user
    await query.edit_message_text(
        f"✅ You selected Quiz {quiz_id}. Sending your quiz via DM..."
    )
    # Set quiz_id for standard play_quiz handler
    context.args = [quiz_id]
    # Delegate to play_quiz logic
    from services.quiz_service import play_quiz

    await play_quiz(update, context)


async def quiz_answer_handler(update: Update, context: CallbackContext):
    """Handler for quiz answer callbacks."""
    if update.callback_query and update.callback_query.data.startswith("quiz:"):
        await handle_quiz_answer(update, context)


async def private_message_handler(update: Update, context: CallbackContext):
    """Route private text messages to the appropriate handler."""
    user_id = str(update.effective_user.id)  # Ensure user_id is string
    message_text = update.message.text
    # redis_client = RedisClient() # Removed instance creation

    logger.info(
        f"PRIVATE_MESSAGE_HANDLER received: '{message_text}' from user {user_id}"
    )

    # Check if awaiting wallet address
    is_awaiting_wallet = await RedisClient.get_user_data_key(
        user_id, "awaiting"
    )  # Use static method
    logger.info(f"User {user_id} 'awaiting' state from Redis: {is_awaiting_wallet}")
    if is_awaiting_wallet == "wallet_address":
        logger.info(
            f"User {user_id} is awaiting wallet_address. Calling service_handle_wallet_address."
        )
        await service_handle_wallet_address(update, context)
        return

    # Check if awaiting payment hash
    quiz_id_awaiting_hash = await RedisClient.get_user_data_key(  # Use static method
        user_id, "awaiting_payment_hash_for_quiz_id"
    )
    if quiz_id_awaiting_hash:
        payment_hash = message_text.strip()
        logger.info(
            f"Handling payment hash input '{payment_hash}' for quiz {quiz_id_awaiting_hash} from user {user_id}"
        )

        # First verify the transaction hash on blockchain before saving to DB
        app = context.application
        blockchain_monitor = getattr(app, "blockchain_monitor", None)

        if not blockchain_monitor:
            blockchain_monitor = getattr(app, "_blockchain_monitor", None)

        if not blockchain_monitor:
            await update.message.reply_text(
                "❌ Sorry, I couldn't access the blockchain monitor to verify your transaction. Please wait for automatic verification or contact an administrator."
            )
            return

        # Verify transaction on blockchain first (disable announcement since we send our own)
        verification_success, verification_message = (
            await blockchain_monitor.verify_transaction_by_hash(
                payment_hash, quiz_id_awaiting_hash, user_id, send_announcement=False
            )
        )

        if not verification_success:
            await update.message.reply_text(f"❌ {verification_message}")
            return

        # Only if blockchain verification succeeds, save to database
        save_success, save_message = await save_quiz_payment_hash(
            quiz_id_awaiting_hash,
            payment_hash,
            context.application,  # Pass application context
        )

        if save_success:
            await update.message.reply_text(
                f"✅ Transaction hash '{payment_hash}' received and linked to Quiz ID {quiz_id_awaiting_hash}.\n"
                "The quiz setup is now complete and funded!"
            )

            # Announce quiz activation in the original group chat
            session = SessionLocal()
            try:
                quiz = (
                    session.query(Quiz).filter(Quiz.id == quiz_id_awaiting_hash).first()
                )
                if quiz and quiz.group_chat_id:
                    # ... (rest of the announcement logic remains the same)
                    announce_text = "@everyone \n"
                    announce_text += f"📣 New quiz '**{_escape_markdown_v2_specials(quiz.topic)}**' is now active! 🎯\n\n"

                    num_questions = len(quiz.questions) if quiz.questions else "N/A"
                    announce_text += f"📚 **{num_questions} Questions**\n"

                    schedule = quiz.reward_schedule or {}
                    reward_details_text = schedule.get("details_text", "")
                    reward_type = schedule.get("type", "")

                    if reward_details_text:
                        announce_text += f"🏆 **Rewards**: {_escape_markdown_v2_specials(reward_details_text)}\n"
                    elif reward_type:
                        announce_text += f"🏆 **Reward Type**: {_escape_markdown_v2_specials(reward_type.replace('_', ' ').title())}\n"
                    else:
                        announce_text += (
                            "🏆 Rewards: To be announced or manually handled.\n"
                        )

                    announce_text += "\n"

                    if getattr(quiz, "end_time", None):
                        end_str = quiz.end_time.strftime("%Y-%m-%d %H:%M UTC")
                        announce_text += f"⏳ **Ends at**: {end_str}\n"
                    else:
                        announce_text += f"⏳ **Ends**: No specific end time set.\n"

                    announce_text += "\nType `/playquiz` to participate!"
                    logger.info(
                        f"Attempting to send announcement to group {quiz.group_chat_id}:\n{announce_text}"
                    )
                    try:
                        await context.bot.send_message(
                            chat_id=quiz.group_chat_id,
                            text=announce_text,
                            parse_mode="MarkdownV2",
                        )
                        logger.info("Announcement sent successfully.")
                    except Exception as e:
                        logger.error(
                            f"Failed to send announcement with MarkdownV2: {e}. Sending as plain text."
                        )
                        plain_announce_text = "@everyone \n"
                        plain_announce_text += (
                            f"New quiz '{quiz.topic}' is now active! \n"
                        )
                        plain_announce_text += f"{num_questions} Questions\n"
                        if reward_details_text:
                            plain_announce_text += f"Rewards: {reward_details_text}\n"
                        elif reward_type:
                            plain_announce_text += f"Reward Type: {reward_type.replace('_', ' ').title()}\n"
                        else:
                            plain_announce_text += (
                                "Rewards: To be announced or manually handled.\n"
                            )
                        if getattr(quiz, "end_time", None):
                            end_str = quiz.end_time.strftime("%Y-%m-%d %H:%M UTC")
                            plain_announce_text += f"Ends at: {end_str}\n"
                        else:
                            plain_announce_text += f"Ends: No specific end time set.\n"
                        plain_announce_text += "Type /playquiz to participate!"
                        await context.bot.send_message(
                            chat_id=quiz.group_chat_id, text=plain_announce_text
                        )
            except Exception as e:
                logger.error(f"Error during quiz announcement: {e}", exc_info=True)
            finally:
                session.close()
        else:
            await update.message.reply_text(f"❌ {save_message}")
            return
        await RedisClient.delete_user_data_key(  # Use static method
            user_id, "awaiting_payment_hash_for_quiz_id"
        )
        return

    # Check for reward input (WTA, Top3, Custom, Manual)
    # Ensure awaiting_reward_type and quiz_id_for_setup are fetched before use
    awaiting_reward_type = await RedisClient.get_user_data_key(
        user_id, "awaiting_reward_input_type"
    )
    quiz_id_for_setup = await RedisClient.get_user_data_key(
        user_id, "current_quiz_id_for_reward_setup"
    )

    if awaiting_reward_type and quiz_id_for_setup:
        logger.info(
            f"Handling reward input type: {awaiting_reward_type} for quiz {quiz_id_for_setup} from user {user_id}. Message: '{message_text}'"
        )

        # First, try to parse the input
        total_amount, currency = _parse_reward_details_for_total(
            message_text, awaiting_reward_type
        )
        logger.info(f"Parsed reward: Amount={total_amount}, Currency={currency}")

        if total_amount is not None and currency:
            # Parsing successful, now save and proceed
            save_reward_success = await save_quiz_reward_details(
                quiz_id_for_setup, awaiting_reward_type, message_text
            )

            if save_reward_success:
                friendly_method_name = "your reward details"
                if awaiting_reward_type == "wta_amount":
                    friendly_method_name = "Winner Takes All amount"
                elif awaiting_reward_type == "top3_details":
                    friendly_method_name = "Top 3 reward details"
                elif awaiting_reward_type == "custom_details":
                    friendly_method_name = "custom reward details"
                elif awaiting_reward_type == "manual_free_text":
                    friendly_method_name = "manually entered reward text"

                reward_confirmation_content = (
                    f"✅ Got it! I\\'ve noted down {friendly_method_name} as: '{_escape_markdown_v2_specials(message_text)}' for Quiz ID {quiz_id_for_setup}.\\n"
                    f"The rewards for this quiz are now set up."
                )
                logger.info(
                    f"Reward confirmation content prepared: {reward_confirmation_content}"
                )

                fee = round(total_amount * 0.02, 6)  # Calculate 2% fee
                total_with_fee = round(total_amount + fee, 6)
                deposit_instructions = (
                    f"💰 Please deposit *{total_with_fee} {currency}* (includes 2% fee: {fee} {currency}) "
                    f"to the following address to fund the quiz: `{Config.DEPOSIT_ADDRESS}`\\n\\n"
                    f"Once sent, please reply with the *transaction hash*."
                )
                logger.info(f"Deposit instructions prepared: {deposit_instructions}")
                prompt_for_hash_message = "I\\'m now awaiting the transaction hash."

                try:
                    logger.info(
                        f"Attempting to send reward confirmation for {awaiting_reward_type} to user {user_id}."
                    )
                    await asyncio.wait_for(
                        update.message.reply_text(text=reward_confirmation_content),
                        timeout=30.0,
                    )
                    logger.info(
                        f"Reward confirmation sent. Attempting to send deposit instructions for {awaiting_reward_type} to user {user_id}."
                    )
                    await asyncio.wait_for(
                        update.message.reply_text(
                            text=deposit_instructions, parse_mode="Markdown"
                        ),
                        timeout=30.0,
                    )
                    logger.info(
                        f"Deposit instructions sent. Attempting to send prompt for hash for {awaiting_reward_type} to user {user_id}."
                    )
                    await asyncio.wait_for(
                        update.message.reply_text(text=prompt_for_hash_message),
                        timeout=30.0,
                    )
                    logger.info(
                        f"All reward setup messages sent successfully for {awaiting_reward_type} to user {user_id}."
                    )

                    await RedisClient.set_user_data_key(  # Use static method
                        user_id, "awaiting_payment_hash_for_quiz_id", quiz_id_for_setup
                    )
                    await RedisClient.delete_user_data_key(  # Use static method
                        user_id, "awaiting_reward_input_type"
                    )
                    await RedisClient.delete_user_data_key(  # Use static method
                        user_id, "current_quiz_id_for_reward_setup"
                    )
                    logger.info(
                        f"Set 'awaiting_payment_hash_for_quiz_id' to {quiz_id_for_setup} for user {user_id}."
                    )
                except asyncio.TimeoutError:
                    logger.error(
                        f"Timeout occurred during reward setup/payment prompt for {awaiting_reward_type} to user {user_id}"
                    )
                    await update.message.reply_text(
                        "⚠️ I tried to send the next steps, but it took too long. "
                        "If you\\'ve already provided the reward details, please send the transaction hash for your deposit. "
                        f"If not, you might need to restart the reward setup for Quiz ID {quiz_id_for_setup}."
                    )
                except Exception as e:
                    logger.error(
                        f"Error sending reward setup/payment prompt for {awaiting_reward_type} to user {user_id}: {e}",
                        exc_info=True,
                    )
                    await update.message.reply_text(
                        "⚠️ An error occurred while sending the next steps. "
                        f"Please check the logs or contact support. You might need to restart reward setup for Quiz ID {quiz_id_for_setup}."
                    )
            else:  # save_reward_success was False
                await update.message.reply_text(
                    "⚠️ There was an issue saving your reward details. Please try sending them again."
                )
        else:  # Parsing failed (total_amount is None or currency is None)
            # Save the raw input anyway, in case it's useful or for manual review
            await save_quiz_reward_details(
                quiz_id_for_setup, awaiting_reward_type, message_text
            )
            await update.message.reply_text(
                f"⚠️ I couldn\\'t automatically determine the total amount and currency from your input: '{_escape_markdown_v2_specials(message_text)}'.\\n"
                f"Please enter the prize amount including the currency (e.g., '5 NEAR', '0.1 USDT')."
            )
            # Do not change Redis state, user needs to re-enter.

        logger.info(
            f"Returning from private_message_handler after processing reward input for {awaiting_reward_type} for user {user_id}."
        )
        return

    # Check for duration input flag
    is_awaiting_duration_input = (
        await RedisClient.get_user_data_key(  # Use static method
            user_id, "awaiting_duration_input"
        )
    )
    if is_awaiting_duration_input:
        logger.info(
            f"User {user_id} is awaiting duration input. Processing duration: '{message_text}' in private_message_handler"
        )
        await RedisClient.delete_user_data_key(
            user_id, "awaiting_duration_input"
        )  # Use static method

        txt = message_text.strip().lower()
        m = re.match(r"(\d+)\s*(minute|hour|min)s?", txt)
        if m:
            val = int(m.group(1))
            unit = m.group(2)
            if unit in ("minute", "min"):
                secs = val * 60
            elif unit == "hour":
                secs = val * 3600
            await RedisClient.set_user_data_key(
                user_id, "duration_seconds", secs
            )  # Use static method
            logger.info(
                f"Successfully parsed duration '{message_text}' to {secs} seconds for user {user_id}. Proceeding to confirm_prompt."
            )
            await confirm_prompt(update, context)
            return
        else:
            logger.warning(
                f"Could not parse duration input '{message_text}' from user {user_id} using primary regex. Replying with error."
            )
            await update.message.reply_text(
                "Hmm, I didn't quite catch that duration. Please use a format like '10 minutes' or '2 hours'."
            )
            return

    logger.info(
        f"Message from user {user_id} ('{message_text}') is NOT for reward structure or duration input. Checking ConversationHandler."
    )


async def winners_handler(update: Update, context: CallbackContext):
    """Handler for /winners command to display quiz results."""
    await get_winners(update, context)


async def distribute_rewards_handler(update: Update, context: CallbackContext):
    """Handler for /distributerewards command to send NEAR rewards to winners."""
    await distribute_quiz_rewards(update, context)


async def show_all_active_leaderboards_command(
    update: Update, context: CallbackContext
):
    """Displays leaderboards for all active quizzes in a more user-friendly format."""
    session = SessionLocal()
    try:
        active_quizzes = await get_leaderboards_for_all_active_quizzes()

        if not active_quizzes:
            await safe_send_message(
                context.bot,
                update.effective_chat.id,
                "🏁 No active quizzes found at the moment. Create one with /createquiz!",
            )
            return

        response_message = "🏆 <b>Active Quiz Leaderboards</b> 🏆\n\n"

        for quiz_info in active_quizzes:
            quiz_id_full = quiz_info.get("quiz_id", "N/A")
            quiz_id_short = quiz_id_full[:8]  # Use the full ID for slicing
            quiz_topic = html.escape(quiz_info.get("quiz_topic", "N/A"))
            response_message += f"<pre>------------------------------</pre>\n"
            # Corrected f-string syntax below
            response_message += (
                f'🎯 <b>Quiz: "{quiz_topic}"</b> (ID: {quiz_id_short})\n'
            )

            # Display the parsed reward description returned by the service
            reward_desc = quiz_info.get("reward_description") or "Not specified"
            response_message += f"💰 Reward: {html.escape(str(reward_desc))}\n"

            if quiz_info.get("end_time"):
                try:
                    end_time_dt = datetime.fromisoformat(
                        quiz_info["end_time"].replace("Z", "+00:00")
                    )
                    # Ensure timezone-aware datetime for correct comparisons
                    if (
                        end_time_dt.tzinfo is None
                        or end_time_dt.tzinfo.utcoffset(end_time_dt) is None
                    ):
                        end_time_dt = end_time_dt.replace(tzinfo=timezone.utc)
                    time_left_str = "Ended"
                    now_utc = datetime.now(timezone.utc)
                    if end_time_dt > now_utc:
                        delta = end_time_dt - now_utc
                        days, remainder = divmod(delta.total_seconds(), 86400)
                        hours, remainder = divmod(remainder, 3600)
                        minutes, _ = divmod(remainder, 60)
                        time_left_parts = []
                        if days > 0:
                            time_left_parts.append(f"{int(days)}d")
                        if hours > 0:
                            time_left_parts.append(f"{int(hours)}h")
                        if minutes > 0 or not time_left_parts:
                            time_left_parts.append(f"{int(minutes)}m")
                        # Corrected join logic for time_left_str
                        if time_left_parts:
                            time_left_str = " ".join(time_left_parts) + " left"
                        else:
                            time_left_str = "Ending soon"
                    response_message += f"⏳ Ends: {html.escape(end_time_dt.strftime('%b %d, %H:%M UTC'))} ({html.escape(time_left_str)})\n"
                except ValueError:
                    response_message += f"⏳ Ends: {html.escape(quiz_info['end_time'])} (Could not parse time)\n"
            else:
                response_message += "⏳ Ends: Not specified\n"

            response_message += "\n"
            if quiz_info.get("participants", []):
                response_message += "<b>Leaderboard:</b>\n"
                for i, entry in enumerate(quiz_info["participants"][:3]):
                    rank_emoji = ["🥇", "🥈", "🥉"][i] if i < 3 else "🏅"
                    # Improve username display and tagging
                    username = entry.get("username")
                    if not username:
                        user_id = entry.get("user_id", "Unknown")
                        username = (
                            f"User_{user_id[:8]}" if user_id != "Unknown" else "Unknown"
                        )
                    username = html.escape(username)

                    score = entry.get(
                        "score", "-"
                    )  # Changed from entry["correct_count"] to entry.get("score", "-")
                    response_message += (
                        f"{rank_emoji} {i+1}. @{username} - Score: {score}\n"
                    )
            else:
                response_message += "<i>No participants yet. Be the first!</i>\n"

            response_message += (
                f"\n➡️ Play this quiz: <code> /playquiz {quiz_id_full}</code>\n"
            )

        response_message += "<pre>------------------------------</pre>\n"
        response_message += "\nCreate your own quiz with /createquiz!"

        await safe_send_message(
            context.bot,
            update.effective_chat.id,
            response_message,
            parse_mode="HTML",
        )

    except Exception as e:
        logger.error(
            f"Error in show_all_active_leaderboards_command: {e}", exc_info=True
        )
        await safe_send_message(
            context.bot,
            update.effective_chat.id,
            "Sorry, I couldn't fetch the leaderboards right now. Please try again later.",
        )
    finally:
        session.close()
