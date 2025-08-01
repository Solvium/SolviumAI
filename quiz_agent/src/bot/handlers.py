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
TOPIC, SIZE, CONTEXT_CHOICE, CONTEXT_INPUT, DURATION_CHOICE, DURATION_INPUT, CONFIRM = (
    range(7)
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
    """Handle /createquiz in group chat by telling user to DM the bot."""
    user = update.effective_user
    await update.message.reply_text(
        f"@{user.username}, to set up a quiz, please DM me and send /createquiz."
    )
    # no conversation state here


async def start_createquiz_group(update, context):
    """Entry point for the quiz creation conversation"""
    user = update.effective_user
    chat_type = update.effective_chat.type
    redis_client = RedisClient()
    user_id = user.id

    logger.info(
        f"User {user_id} initiating /createquiz from {chat_type} chat {update.effective_chat.id}."
    )
    # logger.info(
    #     f"User_data BEFORE cleaning at quiz creation start for user {user_id}: {context.user_data}"
    # ) # Cannot log context.user_data directly anymore

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

    # logger.info(
    #     f"User_data AFTER cleaning for user {user_id} at quiz creation start: {context.user_data}"
    # ) # Cannot log context.user_data directly anymore

    if chat_type != "private":
        logger.info(
            f"User {user_id} started quiz creation from group chat {update.effective_chat.id}. Will DM."
        )
        await update.message.reply_text(
            f"@{user.username}, let's create a quiz! I'll message you privately to set it up."
        )
        await context.bot.send_message(
            chat_id=user_id, text="Great—what topic would you like your quiz to cover?"
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
            "Great—what topic would you like your quiz to cover?"
        )
        # Clear any potential leftover group_chat_id if starting fresh in DM
        await redis_client.delete_user_data_key(user_id, "group_chat_id")
        logger.info(f"User {user_id} in private chat.")
        return TOPIC


async def topic_received(update, context):
    user_id = update.effective_user.id
    redis_client = RedisClient()
    logger.info(f"Received topic: {update.message.text} from user {user_id}")
    await redis_client.set_user_data_key(user_id, "topic", update.message.text.strip())
    await update.message.reply_text("How many questions? (send a number)")
    return SIZE


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
    # ask for optional long text
    buttons = [
        [InlineKeyboardButton("Paste text", callback_data="paste")],
        [InlineKeyboardButton("Skip", callback_data="skip_context")],
    ]
    await update.message.reply_text(
        "If you have a passage or notes, paste them now; otherwise skip.",
        reply_markup=InlineKeyboardMarkup(buttons),
    )
    return CONTEXT_CHOICE


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

    if choice == "set_duration":
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


async def confirm_prompt(update, context):
    user_id = update.effective_user.id
    redis_client = RedisClient()

    topic = await redis_client.get_user_data_key(user_id, "topic")
    n = await redis_client.get_user_data_key(user_id, "num_questions")
    context_text_val = await redis_client.get_user_data_key(user_id, "context_text")
    has_ctx = bool(context_text_val)
    dur = await redis_client.get_user_data_key(user_id, "duration_seconds")

    # Ensure n and dur are not None before using in f-string or arithmetic
    n = n if n is not None else 0  # Default to 0 if not found, or handle error
    topic = topic if topic is not None else "[Unknown Topic]"  # Default if not found

    text = f"Ready to generate a {n}-question quiz on '{topic}'"
    text += " based on your text" if has_ctx else ""
    text += f", open for {dur//60} minutes" if dur else ""
    text += ". Generate now?"
    buttons = [
        [InlineKeyboardButton("Yes", callback_data="yes")],
        [InlineKeyboardButton("No", callback_data="no")],
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

    # yes: generate and post
    await update.callback_query.message.reply_text("🛠 Generating your quiz—one moment…")

    # Fetch all necessary data from Redis
    topic = await redis_client.get_user_data_key(user_id, "topic")
    num_questions = await redis_client.get_user_data_key(user_id, "num_questions")
    context_text = await redis_client.get_user_data_key(user_id, "context_text")
    group_chat_id = await redis_client.get_user_data_key(user_id, "group_chat_id")
    duration_seconds = await redis_client.get_user_data_key(user_id, "duration_seconds")

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

    # Call process_questions with duration_seconds
    await process_questions(
        update,
        context,
        topic,
        quiz_text,
        group_chat_id_to_use,
        duration_seconds=duration_seconds,  # Pass duration_seconds directly
    )

    # Clear conversation data for quiz creation
    await redis_client.clear_user_data(user_id)
    return ConversationHandler.END


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
