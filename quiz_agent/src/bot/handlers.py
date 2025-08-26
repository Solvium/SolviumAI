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
    start_enhanced_quiz,
    send_enhanced_question,
    handle_enhanced_quiz_answer,
    active_quiz_sessions,
    QuizSession,
    announce_quiz_end,  # Added import for quiz end announcements
)
from services.user_service import (
    get_user_wallet,
    set_user_wallet,
    remove_user_wallet,
    link_wallet as service_link_wallet,  # Renamed import
    handle_wallet_address as service_handle_wallet_address,  # Renamed import
    check_wallet_linked,  # Add this import
)
from enhanced_agent import AdvancedQuizGenerator
import logging
import re  # Import re for duration_input and potentially wallet validation
import asyncio  # Add asyncio import
from typing import Optional  # Added for type hinting
from utils.config import Config  # Added to access DEPOSIT_ADDRESS
from store.database import SessionLocal
from models.quiz import Quiz, QuizStatus, QuizAnswer
from utils.redis_client import RedisClient  # Added RedisClient import
from utils.telegram_helpers import safe_send_message  # Ensure this is imported
import html  # Add this import
from datetime import datetime, timezone, timedelta  # Add this import

# Configure logger
logger = logging.getLogger(__name__)

# Initialize the quiz generator
quiz_generator = AdvancedQuizGenerator()


async def generate_quiz_questions(
    topic: str, num_questions: int, context_text: str = ""
) -> str:
    """Wrapper function for backward compatibility with the quiz service"""
    questions = await quiz_generator.generate_quiz(
        topic, num_questions, context_text=context_text
    )

    # Format as string for backward compatibility
    formatted_questions = []
    for i, q in enumerate(questions, 1):
        options_text = "\n".join(
            [f"{key}) {value}" for key, value in q.options.items()]
        )
        formatted_questions.append(
            f"Question {i}: {q.question}\n{options_text}\nCorrect Answer: {q.correct_answer}"
        )

    return "\n\n".join(formatted_questions)


async def start_handler(update, context):
    """Handle /start command - shows the main menu interface or handles deep links"""
    user = update.effective_user
    chat_type = update.effective_chat.type

    # Handle deep linking for quiz redirects (only in private chats)
    if chat_type == "private" and context.args:
        start_param = context.args[0]

        # Handle quiz deep linking
        if start_param.startswith("quiz_"):
            quiz_id = start_param[5:]  # Remove "quiz_" prefix
            from .menu_handlers import handle_quiz_deep_link

            await handle_quiz_deep_link(update, context, quiz_id)
            return

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
(
    TOPIC,
    NOTES_CHOICE,
    NOTES_INPUT,
    SIZE,
    CONTEXT_CHOICE,
    CONTEXT_INPUT,
    DURATION_CHOICE,
    DURATION_INPUT,
    REWARD_CHOICE,
    REWARD_CUSTOM_INPUT,
    REWARD_STRUCTURE_CHOICE,
    PAYMENT_VERIFICATION,
    CONFIRM,
) = range(13)

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
    await redis_client.delete_user_data_key(
        user_id, "awaiting_notes"
    )  # Clear notes flag

    # Check if user has a wallet - if not, create one first
    from services.wallet_service import WalletService
    from services.cache_service import cache_service

    wallet_service = WalletService()
    logger.info(f"Checking if user {user_id} has a wallet...")

    # Clear wallet cache to ensure fresh database check
    await cache_service.invalidate_wallet_cache(user_id)
    logger.info(f"Cleared wallet cache for user {user_id} before robust check")

    has_wallet = await wallet_service.has_wallet_robust(user_id)
    logger.info(f"Wallet check result for user {user_id}: {has_wallet}")

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
            parse_mode="Markdown",
        )

        try:
            # Update loading message with progress
            await loading_message.edit_text(
                "🔧 **Creating your NEAR wallet...**\n\n⏳ Generating secure keys and creating your account...",
                parse_mode="Markdown",
            )

            # Create wallet using existing service
            wallet_info = await wallet_service.create_demo_wallet(
                user_id, user_name=user.username or user.first_name
            )

            # Update loading message with final step
            await loading_message.edit_text(
                "🔧 **Creating your NEAR wallet...**\n\n✅ Account created! Finalizing your wallet...",
                parse_mode="Markdown",
            )

            # Format the wallet info message
            wallet_message, mini_app_keyboard = (
                await wallet_service.format_wallet_info_message(wallet_info)
            )

            # Update the loading message with the wallet creation result
            await loading_message.edit_text(
                f"🎉 **Wallet Created Successfully!**\n\n{wallet_message}\n\nNow let's create your quiz!",
                parse_mode="Markdown",
            )

            logger.info(
                f"Wallet created successfully for user {user_id}, proceeding to quiz creation."
            )

        except Exception as e:
            logger.error(f"Error creating wallet for user {user_id}: {e}")
            await loading_message.edit_text(
                "❌ **Wallet Creation Failed**\n\nSorry, there was an error creating your wallet. Please try again later.",
                parse_mode="Markdown",
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
            text="🎯 Create Quiz - Step 1 of 4\n\nWhat's your quiz topic?\n\n[Quick Topics: Crypto | Gaming | Technology | Custom...]",
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
        [InlineKeyboardButton("⏭️ Skip Notes", callback_data="skip_notes")],
    ]

    await update.message.reply_text(
        f"✅ Topic set: {topic}\n\n"
        f"Would you like to add any notes or context for your quiz?\n"
        f"(This helps AI generate better questions)",
        reply_markup=InlineKeyboardMarkup(buttons),
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
            [
                InlineKeyboardButton("5", callback_data="size_5"),
                InlineKeyboardButton("10", callback_data="size_10"),
                InlineKeyboardButton("15", callback_data="size_15"),
                InlineKeyboardButton("20", callback_data="size_20"),
            ],
            [InlineKeyboardButton("Custom", callback_data="size_custom")],
        ]

        await update.callback_query.message.reply_text(
            f"✅ Topic: {topic}\n"
            f"📝 Notes: None\n"
            f"❓ Step 2 of 4: How many questions?",
            reply_markup=InlineKeyboardMarkup(buttons),
        )
        return SIZE


async def notes_input(update, context):
    user_id = update.effective_user.id
    redis_client = RedisClient()
    notes = update.message.text.strip()

    try:
        if notes.lower() == "skip":
            await redis_client.set_user_data_key(user_id, "context_text", None)
            topic = await redis_client.get_user_data_key(user_id, "topic")

            buttons = [
                [
                    InlineKeyboardButton("5", callback_data="size_5"),
                    InlineKeyboardButton("10", callback_data="size_10"),
                    InlineKeyboardButton("15", callback_data="size_15"),
                    InlineKeyboardButton("20", callback_data="size_20"),
                ],
                [InlineKeyboardButton("Custom", callback_data="size_custom")],
            ]

            await update.message.reply_text(
                f"✅ Topic: {topic}\n"
                f"📝 Notes: None\n"
                f"❓ Step 2 of 4: How many questions?",
                reply_markup=InlineKeyboardMarkup(buttons),
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
                [
                    InlineKeyboardButton("5", callback_data="size_5"),
                    InlineKeyboardButton("10", callback_data="size_10"),
                    InlineKeyboardButton("15", callback_data="size_15"),
                    InlineKeyboardButton("20", callback_data="size_20"),
                ],
                [InlineKeyboardButton("Custom", callback_data="size_custom")],
            ]

            # Show a shorter preview of notes
            notes_preview = notes[:100] + "..." if len(notes) > 100 else notes

            await update.message.reply_text(
                f"✅ Topic: {topic}\n"
                f"📝 Notes: {notes_preview}\n"
                f"❓ Step 2 of 4: How many questions?",
                reply_markup=InlineKeyboardMarkup(buttons),
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
        "size_custom": "custom",
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
                [
                    InlineKeyboardButton("5 min", callback_data="5_min"),
                    InlineKeyboardButton("10 min", callback_data="10_min"),
                    InlineKeyboardButton("30 min", callback_data="30_min"),
                ],
                [
                    InlineKeyboardButton("1 hour", callback_data="1_hour"),
                    InlineKeyboardButton("No limit", callback_data="no_limit"),
                ],
                [InlineKeyboardButton("Custom duration", callback_data="set_duration")],
            ]

            await update.callback_query.message.reply_text(
                progress_text, reply_markup=InlineKeyboardMarkup(buttons)
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
        progress_text += (
            f"📝 Notes: {context_text[:50]}{'...' if len(context_text) > 50 else ''}\n"
        )
    else:
        progress_text += f"📝 Notes: None\n"
    progress_text += f"❓ Questions: {n}\n"
    progress_text += f"⏱ Step 3 of 4: Quiz duration"

    buttons = [
        [
            InlineKeyboardButton("5 min", callback_data="5_min"),
            InlineKeyboardButton("10 min", callback_data="10_min"),
            InlineKeyboardButton("30 min", callback_data="30_min"),
        ],
        [
            InlineKeyboardButton("1 hour", callback_data="1_hour"),
            InlineKeyboardButton("No limit", callback_data="no_limit"),
        ],
        [InlineKeyboardButton("Custom duration", callback_data="set_duration")],
    ]

    await update.message.reply_text(
        progress_text, reply_markup=InlineKeyboardMarkup(buttons)
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
        "no_limit": None,
    }

    if choice in duration_map:
        await redis_client.set_user_data_key(
            user_id, "duration_seconds", duration_map[choice]
        )
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

        # Note: Wallet balance check moved to reward_choice function for paid options only

        buttons = [
            [
                InlineKeyboardButton("Free Quiz", callback_data="reward_free"),
                InlineKeyboardButton("0.1 NEAR", callback_data="reward_0.1"),
                InlineKeyboardButton("0.5 NEAR", callback_data="reward_0.5"),
            ],
            [InlineKeyboardButton("Custom amount", callback_data="reward_custom")],
        ]

        await update.callback_query.message.reply_text(
            progress_text, reply_markup=InlineKeyboardMarkup(buttons)
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
            await redis_client.set_user_data_key(
                user_id, "payment_status", "not_required"
            )
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
                await redis_client.set_user_data_key(
                    user_id, "reward_amount", reward_amount
                )

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

    # Get wallet info and balance for display
    from services.wallet_service import WalletService

    wallet_service = WalletService()
    wallet = await wallet_service.get_user_wallet(user_id)
    wallet_balance = await wallet_service.get_wallet_balance(user_id)

    progress_text = f"✅ Topic: {topic}\n"
    if context_text:
        progress_text += (
            f"📝 Notes: {context_text[:50]}{'...' if len(context_text) > 50 else ''}\n"
        )
    else:
        progress_text += f"📝 Notes: None\n"
    progress_text += f"❓ Questions: {num_questions}\n"

    if duration_seconds:
        progress_text += f"⏱ Duration: {duration_seconds//60} minutes\n"
    else:
        progress_text += f"⏱ Duration: No limit\n"

    progress_text += f"💰 Reward Amount: {reward_amount} NEAR\n"
    progress_text += f"📊 Step 4b of 4: Reward Structure"

    # Add wallet information
    if wallet and wallet.get("account_id"):
        progress_text += (
            f"\n\n💳 Wallet: `{wallet['account_id']}`\n💰 Balance: {wallet_balance}"
        )
    else:
        progress_text += f"\n\n💳 Wallet Balance: {wallet_balance}"

    # Calculate total costs for different structures
    wta_total = reward_amount
    top3_total = reward_amount * 3  # 1st, 2nd, 3rd place
    custom_total = reward_amount  # Base amount, can be modified

    progress_text += f"\n\n💡 Total Cost Options:\n"
    progress_text += f"• Winner-takes-all: {wta_total} NEAR\n"
    progress_text += f"• Top 3 winners: {top3_total} NEAR\n"
    progress_text += f"• Custom structure: {custom_total} NEAR"

    buttons = [
        [
            InlineKeyboardButton(
                f"Winner-takes-all ({wta_total} NEAR)", callback_data="structure_wta"
            )
        ],
        [
            InlineKeyboardButton(
                f"Top 3 winners ({top3_total} NEAR)", callback_data="structure_top3"
            )
        ],
        [InlineKeyboardButton(f"Custom structure", callback_data="structure_custom")],
    ]

    if update.callback_query:
        await update.callback_query.message.reply_text(
            progress_text, reply_markup=InlineKeyboardMarkup(buttons)
        )
    else:
        await update.message.reply_text(
            progress_text, reply_markup=InlineKeyboardMarkup(buttons)
        )


async def reward_structure_choice(update, context):
    """Handle reward structure selection"""
    user_id = update.effective_user.id
    redis_client = RedisClient()
    choice = update.callback_query.data
    await update.callback_query.answer()

    if choice == "structure_wta":
        await redis_client.set_user_data_key(
            user_id, "reward_structure", "winner_takes_all"
        )
        await redis_client.set_user_data_key(
            user_id,
            "total_cost",
            await redis_client.get_user_data_key(user_id, "reward_amount"),
        )
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
    wallet_balance_str = await wallet_service.get_wallet_balance(
        user_id, force_refresh=True
    )

    # Parse balance (e.g., "0.5000 NEAR" -> 0.5)
    try:
        balance_match = re.search(r"(\d+\.?\d*)", wallet_balance_str)
        wallet_balance = float(balance_match.group(1)) if balance_match else 0.0
        logger.debug(
            f"Parsed wallet balance for user {user_id}: {wallet_balance} NEAR (from: {wallet_balance_str})"
        )
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
        return await show_funding_instructions(
            update, context, total_cost_float, wallet_balance
        )


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
        total_yocto = int(total_amount * (10**24))

        # Get main account address from config
        from utils.config import Config

        main_account_address = Config.NEAR_WALLET_ADDRESS

        # Process real NEAR transaction
        transaction_result = await process_real_near_payment(
            wallet, main_account_address, total_yocto, user_id
        )

        if transaction_result["success"]:
            # Store payment info
            await redis_client.set_user_data_key(user_id, "payment_status", "completed")
            await redis_client.set_user_data_key(user_id, "payment_amount", total_cost)
            await redis_client.set_user_data_key(
                user_id, "service_charge", service_charge
            )
            await redis_client.set_user_data_key(user_id, "total_paid", total_amount)
            await redis_client.set_user_data_key(
                user_id, "transaction_hash", transaction_result["transaction_hash"]
            )
            await redis_client.set_user_data_key(
                user_id, "payment_timestamp", str(datetime.now())
            )

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
                [
                    InlineKeyboardButton(
                        "🔄 Retry Payment", callback_data="retry_payment"
                    )
                ],
                [InlineKeyboardButton("❌ Cancel Quiz", callback_data="cancel_quiz")],
            ]

            await update.callback_query.message.reply_text(
                "Would you like to retry the payment?",
                reply_markup=InlineKeyboardMarkup(buttons),
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

    # Get wallet info with better error handling
    from services.wallet_service import WalletService

    wallet_service = WalletService()

    try:
        wallet = await wallet_service.get_user_wallet(user_id)
        logger.info(f"Retrieved wallet for user {user_id}: {wallet}")
    except Exception as e:
        logger.error(f"Error retrieving wallet for user {user_id}: {e}")
        wallet = None

    # Debug: Log the wallet structure
    if wallet:
        logger.info(f"Wallet keys for user {user_id}: {list(wallet.keys())}")
        logger.info(
            f"Account ID for user {user_id}: {wallet.get('account_id', 'NOT_FOUND')}"
        )
    else:
        logger.warning(f"No wallet found for user {user_id}")

    shortfall = required_amount - current_balance

    funding_text = f"💰 **Payment Required**\n\n"
    funding_text += f"Required: {required_amount} NEAR\n"
    funding_text += f"Current Balance: {current_balance} NEAR\n"
    funding_text += f"Shortfall: {shortfall} NEAR\n\n"

    if wallet and wallet.get("account_id"):
        funding_text += f"**Your Wallet Address:**\n`{wallet['account_id']}`\n\n"
        logger.info(
            f"Added wallet address to funding instructions: {wallet['account_id']}"
        )
    else:
        logger.warning(
            f"No wallet or account_id found for user {user_id}. Wallet: {wallet}"
        )

        # Try direct database fallback
        try:
            from services.database_service import db_service

            db_wallet = await db_service.get_user_wallet(user_id)
            logger.info(f"Direct DB wallet for user {user_id}: {db_wallet}")

            if db_wallet and db_wallet.get("account_id"):
                funding_text += (
                    f"**Your Wallet Address:**\n`{db_wallet['account_id']}`\n\n"
                )
                logger.info(
                    f"Added DB wallet address to funding instructions: {db_wallet['account_id']}"
                )
            else:
                funding_text += (
                    f"**Your Wallet Address:**\n*Unable to retrieve wallet address*\n\n"
                )
        except Exception as db_error:
            logger.error(
                f"Database fallback also failed for user {user_id}: {db_error}"
            )
            funding_text += (
                f"**Your Wallet Address:**\n*Unable to retrieve wallet address*\n\n"
            )

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
        [InlineKeyboardButton("❌ Cancel Quiz", callback_data="cancel_quiz")],
    ]

    await update.callback_query.message.reply_text(
        funding_text, parse_mode="Markdown", reply_markup=InlineKeyboardMarkup(buttons)
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


async def handle_quiz_interaction_callback(update, context):
    """Handle quiz interaction callbacks (play, leaderboard, share, etc.)"""
    query = update.callback_query
    await query.answer()

    user_id = update.effective_user.id
    chat_id = update.effective_chat.id

    try:
        # Parse callback data
        action, quiz_id = query.data.split(":", 1)

        if action == "play_quiz":
            await handle_play_quiz(update, context, quiz_id)

        elif action == "leaderboard":
            await handle_show_leaderboard(update, context, quiz_id)

        elif action == "past_winners":
            await handle_show_past_winners(update, context, quiz_id)

        elif action == "share_quiz":
            await handle_share_quiz(update, context, quiz_id)

        elif action == "hint":
            await handle_quiz_hint(update, context, quiz_id)

        elif action == "skip_question":
            await handle_skip_question(update, context, quiz_id)

        elif action == "answer":
            await handle_quiz_answer(update, context, quiz_id)

        elif action == "refresh_leaderboard":
            await handle_refresh_leaderboard(update, context, quiz_id)

        elif action == "join_quiz":
            await handle_join_quiz(update, context, quiz_id)

    except ValueError:
        await context.bot.send_message(
            chat_id=chat_id, text="❌ Invalid action. Please try again."
        )
    except Exception as e:
        logger.error(f"Error handling quiz interaction callback: {e}")
        await context.bot.send_message(
            chat_id=chat_id, text="❌ An error occurred. Please try again."
        )


async def handle_play_quiz(update, context, quiz_id):
    """Handle play quiz button click"""
    user_id = update.effective_user.id
    chat_id = update.effective_chat.id

    try:
        from store.database import SessionLocal
        from models.quiz import Quiz, QuizStatus
        from datetime import datetime

        session = SessionLocal()
        try:
            quiz = (
                session.query(Quiz)
                .filter(Quiz.id == quiz_id, Quiz.status == QuizStatus.ACTIVE)
                .first()
            )

            if not quiz:
                await context.bot.send_message(
                    chat_id=chat_id, text="❌ Quiz not found or no longer active."
                )
                return

            # Check if quiz has ended based on end_time
            if quiz.end_time and quiz.end_time <= datetime.utcnow():
                await context.bot.send_message(
                    chat_id=chat_id,
                    text="❌ This quiz has already ended. Check the final results!",
                )
                return

            # Start quiz for user
            await start_quiz_for_user(update, context, quiz)

        finally:
            session.close()

    except Exception as e:
        logger.error(f"Error starting quiz {quiz_id} for user {user_id}: {e}")
        await context.bot.send_message(
            chat_id=chat_id, text="❌ Error starting quiz. Please try again."
        )


async def handle_show_leaderboard(update, context, quiz_id):
    """Handle show leaderboard button click"""
    user_id = update.effective_user.id
    chat_id = update.effective_chat.id

    try:
        from utils.quiz_cards import create_leaderboard_card
        from store.database import SessionLocal
        from models.quiz import Quiz

        session = SessionLocal()
        try:
            quiz = session.query(Quiz).filter(Quiz.id == quiz_id).first()

            if not quiz:
                await context.bot.send_message(
                    chat_id=chat_id, text="❌ Quiz not found."
                )
                return

            # Get actual leaderboard data using the existing service
            from services.quiz_service import _generate_leaderboard_data_for_quiz
            from datetime import datetime, timezone

            # Generate leaderboard data
            leaderboard_info = await _generate_leaderboard_data_for_quiz(quiz, session)

            # Extract participant data for the leaderboard card
            leaderboard_data = []
            total_participants = len(leaderboard_info.get("participants", []))

            # Convert to the format expected by create_leaderboard_card
            for participant in leaderboard_info.get("participants", [])[:10]:  # Top 10
                score = participant.get("score", 0)
                questions_answered = participant.get("questions_answered", 0)
                username = participant.get("username", "UnknownUser")
                logger.info(
                    f"Leaderboard participant: {username}, score: {score}, questions_answered: {questions_answered}"
                )
                leaderboard_data.append(
                    {
                        "username": username,
                        "score": score,
                        "correct_answers": score,
                        "total_questions": questions_answered,
                    }
                )

            # Calculate time remaining
            time_remaining = 0
            if quiz.end_time:
                now = datetime.now(timezone.utc)
                # Ensure quiz.end_time is timezone-aware
                quiz_end_time = quiz.end_time
                if quiz_end_time.tzinfo is None:
                    quiz_end_time = quiz_end_time.replace(tzinfo=timezone.utc)

                if quiz_end_time > now:
                    time_remaining = int((quiz_end_time - now).total_seconds())

            # Create rich leaderboard card
            leaderboard_msg, leaderboard_keyboard = create_leaderboard_card(
                quiz_id, leaderboard_data, time_remaining, total_participants
            )

            await context.bot.send_message(
                chat_id=chat_id,
                text=leaderboard_msg,
                parse_mode="Markdown",
                reply_markup=leaderboard_keyboard,
            )

        finally:
            session.close()

    except Exception as e:
        logger.error(f"Error showing leaderboard for quiz {quiz_id}: {e}")
        await context.bot.send_message(
            chat_id=chat_id, text="❌ Error loading leaderboard. Please try again."
        )


async def handle_show_past_winners(update, context, quiz_id):
    """Handle show past winners button click"""
    chat_id = update.effective_chat.id

    try:
        from store.database import SessionLocal
        from models.quiz import Quiz

        session = SessionLocal()
        try:
            quiz = session.query(Quiz).filter(Quiz.id == quiz_id).first()

            if not quiz:
                await context.bot.send_message(
                    chat_id=chat_id, text="❌ Quiz not found."
                )
                return

            # TODO: Implement past winners functionality
            await context.bot.send_message(
                chat_id=chat_id,
                text=f"🏆 **Past Winners for: {quiz.topic}**\n\n"
                f"📊 This feature is coming soon!\n"
                f"🎯 We're working on tracking quiz winners and their achievements.",
            )

        finally:
            session.close()

    except Exception as e:
        logger.error(f"Error showing past winners for quiz {quiz_id}: {e}")
        await context.bot.send_message(
            chat_id=chat_id, text="❌ Error loading past winners. Please try again."
        )


async def handle_share_quiz(update, context, quiz_id):
    """Handle share quiz button click"""
    user_id = update.effective_user.id
    chat_id = update.effective_chat.id

    try:
        from store.database import SessionLocal
        from models.quiz import Quiz

        session = SessionLocal()
        try:
            quiz = session.query(Quiz).filter(Quiz.id == quiz_id).first()

            if not quiz:
                await context.bot.send_message(
                    chat_id=chat_id, text="❌ Quiz not found."
                )
                return

            # Create share message
            share_msg = f"""
🎯 **Share This Quiz!**

📝 **{quiz.topic}**
❓ {len(quiz.questions)} Questions
⏱ {quiz.duration_seconds // 60 if quiz.duration_seconds else 'No limit'} minutes

🎮 **Join the fun!**
Use /playquiz in this chat to start playing!

#QuizTime #Knowledge #Fun
"""

            await context.bot.send_message(
                chat_id=chat_id, text=share_msg.strip(), parse_mode="Markdown"
            )

        finally:
            session.close()

    except Exception as e:
        logger.error(f"Error sharing quiz {quiz_id}: {e}")
        await context.bot.send_message(
            chat_id=chat_id, text="❌ Error sharing quiz. Please try again."
        )


async def handle_quiz_hint(update, context, quiz_id):
    """Handle quiz hint button click"""
    chat_id = update.effective_chat.id

    # TODO: Implement hint system
    await context.bot.send_message(
        chat_id=chat_id,
        text="💡 **Hint System**\n\n"
        "🎯 This feature is coming soon!\n"
        "💡 Players will be able to get hints for difficult questions.",
    )


async def handle_skip_question(update, context, quiz_id):
    """Handle skip question button click"""
    chat_id = update.effective_chat.id

    # TODO: Implement skip question functionality
    await context.bot.send_message(
        chat_id=chat_id,
        text="⏭ **Skip Question**\n\n"
        "🎯 This feature is coming soon!\n"
        "⏭ Players will be able to skip questions they don't know.",
    )


async def handle_quiz_answer(update, context, quiz_id):
    """Handle quiz answer button click"""
    chat_id = update.effective_chat.id

    # TODO: Implement answer processing
    await context.bot.send_message(
        chat_id=chat_id,
        text="✅ **Answer Submitted**\n\n"
        "🎯 This feature is coming soon!\n"
        "✅ Players will be able to submit answers and see results.",
    )


async def handle_refresh_leaderboard(update, context, quiz_id):
    """Handle refresh leaderboard button click"""
    await handle_show_leaderboard(update, context, quiz_id)


async def handle_join_quiz(update, context, quiz_id):
    """Handle join quiz button click"""
    await handle_play_quiz(update, context, quiz_id)


async def start_quiz_for_user(update, context, quiz):
    """Start quiz for a specific user using enhanced quiz system"""
    user_id = str(update.effective_user.id)
    chat_id = update.effective_chat.id

    try:
        # Check if user has a wallet - if not, create one first
        from services.wallet_service import WalletService

        wallet_service = WalletService()
        has_wallet = await wallet_service.has_wallet_robust(user_id)

        if not has_wallet:
            logger.info(
                f"User {user_id} has no wallet, creating one before starting quiz."
            )

            # Send initial loading message
            loading_message = await context.bot.send_message(
                chat_id=chat_id,
                text="🔧 **Creating your NEAR wallet...**\n\n⏳ Please wait while we set up your account on the blockchain...",
                parse_mode="Markdown",
            )

            try:
                # Update loading message with progress
                await loading_message.edit_text(
                    "🔧 **Creating your NEAR wallet...**\n\n⏳ Generating secure keys and creating your account...",
                    parse_mode="Markdown",
                )

                # Create wallet using existing service
                wallet_info = await wallet_service.create_demo_wallet(
                    user_id,
                    user_name=update.effective_user.username
                    or update.effective_user.first_name,
                )

                # Update loading message with final step
                await loading_message.edit_text(
                    "🔧 **Creating your NEAR wallet...**\n\n✅ Account created! Finalizing your wallet...",
                    parse_mode="Markdown",
                )

                # Format the wallet info message
                wallet_message, mini_app_keyboard = (
                    await wallet_service.format_wallet_info_message(wallet_info)
                )

                # Update the loading message with the wallet creation result
                await loading_message.edit_text(
                    f"🎉 **Wallet Created Successfully!**\n\n{wallet_message}\n\nNow starting your quiz!",
                    parse_mode="Markdown",
                )

                logger.info(
                    f"Wallet created successfully for user {user_id}, proceeding to start quiz."
                )

            except Exception as e:
                logger.error(f"Error creating wallet for user {user_id}: {e}")
                await loading_message.edit_text(
                    "❌ **Wallet Creation Failed**\n\nSorry, there was an error creating your wallet. Please try again later.",
                    parse_mode="Markdown",
                )
                return

        # Send quiz intro with start button to user's DM
        total_questions = len(quiz.questions) if quiz.questions else 0
        timer_seconds = Config.QUESTION_TIMER_SECONDS

        intro_text = f"""🎲 Get ready for the quiz '{quiz.topic}'

🖊 {total_questions} questions
⏱ {timer_seconds} seconds per question
🔀 Questions and answers shuffled

🏁 Press the button below when you are ready.
Send /stop to stop it."""

        from telegram import InlineKeyboardButton, InlineKeyboardMarkup

        keyboard = [
            [
                InlineKeyboardButton(
                    "🚀 Start Quiz", callback_data=f"enhanced_quiz_start:{quiz.id}"
                )
            ]
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)

        # Send DM to user
        await safe_send_message(
            context.bot, user_id, intro_text, reply_markup=reply_markup
        )

        # Acknowledge button click in group chat if it was from a group
        if update.callback_query:
            await update.callback_query.answer("📱 Quiz intro sent to your DMs!")

        # Send confirmation to group chat if applicable
        if chat_id != int(user_id):  # If this was triggered from a group
            await safe_send_message(
                context.bot,
                chat_id,
                f"🎮 **{quiz.topic}** Quiz Ready! �\n\n📱 @{update.effective_user.username or update.effective_user.first_name}, check your DMs to start the quiz!",
            )

    except Exception as e:
        logger.error(f"Error starting quiz {quiz.id} for user {user_id}: {e}")
        if update.callback_query:
            await update.callback_query.answer(
                "❌ Error starting quiz. Please try again.", show_alert=True
            )
        else:
            await context.bot.send_message(
                chat_id=chat_id, text="❌ Error starting quiz. Please try again."
            )

    except Exception as e:
        logger.error(f"Error starting enhanced quiz for user {user_id}: {e}")
        await context.bot.send_message(
            chat_id=chat_id, text="❌ Error starting quiz. Please try again."
        )


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
                "free": "Free quiz",
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
        [InlineKeyboardButton("❌ Cancel", callback_data="no")],
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

    quiz_text = await generate_quiz_questions(topic, num_questions, context_text)

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
        total_cost=total_cost,
    )

    # Clear conversation data for quiz creation
    await redis_client.clear_user_data(user_id)
    return ConversationHandler.END


async def process_real_near_payment(
    wallet: dict, receiver_address: str, amount_yocto: int, user_id: int
) -> dict:
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
            wallet["encrypted_private_key"], wallet["iv"], wallet["tag"]
        )

        # Create Account instance for user's sub-account
        user_account = Account(
            account_id=wallet["account_id"],
            private_key=private_key,
            rpc_addr=Config.NEAR_RPC_ENDPOINT,
        )

        # Send money to main account
        logger.info(
            f"Processing NEAR payment: {wallet['account_id']} -> {receiver_address}, Amount: {amount_yocto} yoctoNEAR"
        )

        # Start the account connection
        await user_account.startup()

        transaction_result = await user_account.send_money(
            account_id=receiver_address,
            amount=amount_yocto,
            nowait=False,  # Wait for transaction execution
        )

        # Clear private key from memory for security
        private_key = None

        # Extract transaction hash
        logger.info(f"Transaction result type: {type(transaction_result)}")
        logger.info(f"Transaction result attributes: {dir(transaction_result)}")

        if hasattr(transaction_result, "transaction_hash"):
            transaction_hash = transaction_result.transaction_hash
        elif hasattr(transaction_result, "hash"):
            transaction_hash = transaction_result.hash
        elif hasattr(transaction_result, "transaction_id"):
            transaction_hash = transaction_result.transaction_id
        else:
            transaction_hash = str(transaction_result)

        logger.info(f"Extracted transaction hash: {transaction_hash}")

        logger.info(f"NEAR payment successful for user {user_id}: {transaction_hash}")

        return {
            "success": True,
            "transaction_hash": transaction_hash,
            "transaction_result": transaction_result,
        }

    except Exception as e:
        logger.error(f"NEAR payment failed for user {user_id}: {e}")

        # Clear private key from memory for security
        if "private_key" in locals():
            private_key = None

        return {"success": False, "error": str(e), "transaction_hash": None}


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
    total_cost=None,
):
    """
    Enhanced process_questions function with payment integration
    """
    user_id = update.effective_user.id
    redis_client = RedisClient()

    try:
        # Parse multiple questions
        from services.quiz_service import parse_multiple_questions

        questions_list = parse_multiple_questions(quiz_text)

        if not questions_list:
            await context.bot.send_message(
                chat_id=user_id,
                text="Failed to parse quiz questions. Please try again.",
            )
            return

        # Create quiz directly with payment information
        from store.database import SessionLocal
        from models.quiz import Quiz, QuizStatus
        from utils.config import Config

        session = SessionLocal()
        try:
            # Create quiz with ACTIVE status (not DRAFT)
            quiz = Quiz(
                topic=topic,
                questions=questions_list,
                status=QuizStatus.ACTIVE,  # Directly activate the quiz
                group_chat_id=group_chat_id,
                duration_seconds=duration_seconds,
                deposit_address=Config.DEPOSIT_ADDRESS,
            )
            session.add(quiz)
            session.commit()
            quiz_id = quiz.id
            logger.info(f"Created active quiz with ID: {quiz_id} for user {user_id}")

            # Set activation time and end time for all quizzes (free and paid)
            from datetime import datetime, timedelta, timezone

            quiz.activated_at = datetime.now(timezone.utc)

            if duration_seconds and duration_seconds > 0:
                quiz.end_time = quiz.activated_at + timedelta(seconds=duration_seconds)
                logger.info(
                    f"Quiz {quiz_id} end time set to: {quiz.end_time} (duration: {duration_seconds}s)"
                )

            session.commit()

        finally:
            session.close()

        # Schedule quiz end announcement for all quizzes with duration
        if duration_seconds and duration_seconds > 0:
            from services.quiz_service import schedule_quiz_end_announcement

            logger.info(
                f"Scheduling end announcement for quiz {quiz_id} in {duration_seconds} seconds"
            )
            await schedule_quiz_end_announcement(
                context.application, str(quiz_id), duration_seconds
            )

        # Store payment information
        if reward_amount and float(reward_amount) > 0:
            await store_payment_info_in_quiz(
                user_id,
                {
                    "quiz_id": quiz_id,
                    "reward_amount": reward_amount,
                    "reward_structure": reward_structure,
                    "payment_status": payment_status,
                    "total_cost": total_cost,
                    "payment_timestamp": await redis_client.get_user_data_key(
                        user_id, "payment_timestamp"
                    ),
                    "transaction_hash": await redis_client.get_user_data_key(
                        user_id, "transaction_hash"
                    ),
                },
            )

        # Import rich card formatting
        from utils.quiz_cards import create_quiz_announcement_card

        # Calculate duration in minutes
        duration_minutes = duration_seconds // 60 if duration_seconds else 0

        # Get bot username from config
        from utils.config import Config

        # Create rich announcement card
        announcement_msg, announcement_keyboard = create_quiz_announcement_card(
            topic=topic,
            num_questions=len(questions_list),
            duration_minutes=duration_minutes,
            reward_amount=reward_amount if reward_amount else 0,
            reward_structure=reward_structure if reward_structure else "Free Quiz",
            quiz_id=str(quiz_id),
            is_free=not (reward_amount and float(reward_amount) > 0),
            bot_username=Config.BOT_USERNAME,
        )

        # Debug: Log the announcement message
        logger.info(
            f"Sending announcement to group {group_chat_id}: {announcement_msg}"
        )

        # Send rich announcement to group
        await context.bot.send_message(
            chat_id=group_chat_id,
            text=announcement_msg,
            parse_mode="Markdown",
            reply_markup=announcement_keyboard,
        )

        # Sanitize content for Markdown
        def sanitize_markdown(text):
            """Sanitize text to prevent Markdown parsing errors"""
            if not text:
                return ""
            # Escape special Markdown characters
            text = (
                str(text)
                .replace("*", "\\*")
                .replace("_", "\\_")
                .replace("[", "\\[")
                .replace("]", "\\]")
                .replace("(", "\\(")
                .replace(")", "\\)")
                .replace("~", "\\~")
                .replace("`", "\\`")
                .replace(">", "\\>")
                .replace("#", "\\#")
                .replace("+", "\\+")
                .replace("-", "\\-")
                .replace("=", "\\=")
                .replace("|", "\\|")
                .replace("{", "\\{")
                .replace("}", "\\}")
                .replace(".", "\\.")
                .replace("!", "\\!")
            )
            return text

        # Send confirmation to user with rich formatting
        safe_topic = sanitize_markdown(topic)
        safe_quiz_id = sanitize_markdown(quiz_id)
        safe_payment_status = (
            sanitize_markdown(payment_status) if payment_status else ""
        )

        user_msg = f"""
✅ **QUIZ CREATED SUCCESSFULLY!** ✅
══════════════════════════════════════════

🎯 **Topic:** {safe_topic}
❓ **Questions:** {len(questions_list)}
⏱ **Duration:** {duration_seconds // 60 if duration_seconds else 'No limit'} minutes
🆔 **Quiz ID:** {safe_quiz_id}

"""

        if reward_amount and float(reward_amount) > 0:
            # Debug: Log the original reward structure
            logger.info(f"Original reward_structure: '{reward_structure}'")

            # Sanitize reward_structure for Markdown
            safe_reward_structure = reward_structure
            if "Top 3 winners" in reward_structure:
                safe_reward_structure = "Top 3 Winners"
            elif "Winner-takes-all" in reward_structure:
                safe_reward_structure = "Winner Takes All"

            # Sanitize the reward structure
            safe_reward_structure = sanitize_markdown(safe_reward_structure)
            logger.info(f"Sanitized reward_structure: '{safe_reward_structure}'")

            user_msg += f"""
💰 **Reward:** {reward_amount} NEAR
📊 **Structure:** {safe_reward_structure}
💳 **Payment:** {safe_payment_status}
"""
        else:
            user_msg += f"💰 **Reward:** Free Quiz\n"

        user_msg += f"""
══════════════════════════════════════════
🎮 **Your quiz is now active and ready to play!**
"""

        # Create user action buttons
        from telegram import InlineKeyboardButton, InlineKeyboardMarkup

        user_buttons = [
            [
                InlineKeyboardButton(
                    "📊 View Leaderboard", callback_data=f"leaderboard:{quiz_id}"
                ),
                InlineKeyboardButton(
                    "📤 Share Quiz", callback_data=f"share_quiz:{quiz_id}"
                ),
            ]
        ]

        user_keyboard = InlineKeyboardMarkup(user_buttons)

        # Debug: Log the message to see what's being sent
        final_message = user_msg.strip()
        logger.info(f"Sending message to user {user_id}: {final_message}")

        await context.bot.send_message(
            chat_id=user_id,
            text=final_message,
            parse_mode="Markdown",
            reply_markup=user_keyboard,
        )

        logger.info(
            f"Quiz {quiz_id} created and announced successfully for user {user_id}"
        )

    except Exception as e:
        logger.error(f"Error in process_questions_with_payment for user {user_id}: {e}")
        await context.bot.send_message(
            chat_id=user_id, text="❌ Error creating quiz. Please try again."
        )


async def store_payment_info_in_quiz(user_id: int, payment_info: dict):
    """
    Store payment information in the quiz record
    """
    try:
        logger.info(f"Payment info for user {user_id}: {payment_info}")

        quiz_id = payment_info.get("quiz_id")
        reward_amount = payment_info.get("reward_amount")
        reward_structure = payment_info.get("reward_structure")

        if not quiz_id:
            logger.error(f"No quiz_id in payment_info for user {user_id}")
            return

        # Store reward information in the database
        from store.database import SessionLocal
        from models.quiz import Quiz

        session = SessionLocal()
        try:
            quiz = session.query(Quiz).filter(Quiz.id == quiz_id).first()
            if not quiz:
                logger.error(f"Quiz {quiz_id} not found when storing payment info")
                return

            # Create proper reward_schedule based on structure
            if reward_structure == "winner_takes_all" and reward_amount:
                quiz.reward_schedule = {
                    "type": "wta_amount",
                    "details_text": f"{reward_amount} NEAR",
                }
                logger.info(
                    f"Set reward_schedule for quiz {quiz_id}: {quiz.reward_schedule}"
                )
            elif reward_structure == "top_3" and reward_amount:
                # Handle top 3 structure - create proper rank-based distribution
                # For top 3, we'll distribute the total amount as: 50% for 1st, 30% for 2nd, 20% for 3rd
                total_amount = float(reward_amount)
                first_place = round(total_amount * 0.5, 6)
                second_place = round(total_amount * 0.3, 6)
                third_place = round(total_amount * 0.2, 6)

                quiz.reward_schedule = {
                    "type": "top3_details",
                    "details_text": f"{first_place} NEAR for 1st, {second_place} NEAR for 2nd, {third_place} NEAR for 3rd",
                }
                logger.info(
                    f"Set reward_schedule for quiz {quiz_id}: {quiz.reward_schedule}"
                )
            else:
                logger.warning(
                    f"Unknown reward structure '{reward_structure}' for quiz {quiz_id}"
                )

            session.commit()
            logger.info(f"Successfully stored payment info for quiz {quiz_id}")

        finally:
            session.close()

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
    """Handler for /playquiz command - now uses enhanced quiz system."""
    user_id = update.effective_user.id
    user_username = update.effective_user.username or update.effective_user.first_name

    # Check if user has a wallet - if not, create one first
    from services.wallet_service import WalletService

    wallet_service = WalletService()
    has_wallet = await wallet_service.has_wallet_robust(user_id)

    if not has_wallet:
        logger.info(
            f"User {user_id} has no wallet, redirecting to private chat for wallet creation."
        )

        if chat_type != "private":
            await update.message.reply_text(
                f"@{user_username}, I'll create a wallet for you first, then we'll play quizzes in private chat."
            )

        # Send initial loading message in private chat
        loading_message = await context.bot.send_message(
            chat_id=user_id,
            text="🔧 **Creating your NEAR wallet...**\n\n⏳ Please wait while we set up your account on the blockchain...",
            parse_mode="Markdown",
        )

        try:
            # Update loading message with progress
            await loading_message.edit_text(
                "🔧 **Creating your NEAR wallet...**\n\n⏳ Generating secure keys and creating your account...",
                parse_mode="Markdown",
            )

            # Create wallet using existing service
            wallet_info = await wallet_service.create_demo_wallet(
                user_id,
                user_name=update.effective_user.username
                or update.effective_user.first_name,
            )

            # Update loading message with final step
            await loading_message.edit_text(
                "🔧 **Creating your NEAR wallet...**\n\n✅ Account created! Finalizing your wallet...",
                parse_mode="Markdown",
            )

            # Format the wallet info message
            wallet_message, mini_app_keyboard = (
                await wallet_service.format_wallet_info_message(wallet_info)
            )

            # Update the loading message with the wallet creation result
            await loading_message.edit_text(
                f"🎉 **Wallet Created Successfully!**\n\n{wallet_message}\n\nNow let's find a quiz for you!",
                parse_mode="Markdown",
            )

            logger.info(
                f"Wallet created successfully for user {user_id}, proceeding to quiz selection."
            )

        except Exception as e:
            logger.error(f"Error creating wallet for user {user_id}: {e}")
            await loading_message.edit_text(
                "❌ **Wallet Creation Failed**\n\nSorry, there was an error creating your wallet. Please try again later.",
                parse_mode="Markdown",
            )
            return

    quiz_id_to_play = None
    if context.args:
        quiz_id_to_play = context.args[0]
        logger.info(f"Quiz ID provided via args: {quiz_id_to_play}")

    session = SessionLocal()
    try:
        group_chat_id = None
        if update.effective_chat.type in ["group", "supergroup"]:
            group_chat_id = update.effective_chat.id

        if not quiz_id_to_play and group_chat_id:
            # Check for active quizzes in group
            active_quizzes = (
                session.query(Quiz)
                .filter(
                    Quiz.status == QuizStatus.ACTIVE,
                    Quiz.group_chat_id == group_chat_id,
                    Quiz.end_time > datetime.utcnow(),
                )
                .order_by(Quiz.end_time)
                .all()
            )

            if len(active_quizzes) > 1:
                # Multiple quizzes - show selection
                buttons = []
                for i, q in enumerate(active_quizzes):
                    num_questions = len(q.questions) if q.questions else 0
                    buttons.append(
                        [
                            InlineKeyboardButton(
                                f"{q.topic} ({num_questions} questions)",
                                callback_data=f"playquiz_select:{q.id}:{user_id}",
                            )
                        ]
                    )

                reply_markup = InlineKeyboardMarkup(buttons)
                await safe_send_message(
                    context.bot,
                    update.effective_chat.id,
                    "Multiple quizzes are active. Choose one to play:",
                    reply_markup=reply_markup,
                )
                return
            elif len(active_quizzes) == 1:
                quiz_id_to_play = active_quizzes[0].id

        if quiz_id_to_play:
            # Get the specific quiz
            quiz = session.query(Quiz).filter(Quiz.id == quiz_id_to_play).first()
            if not quiz:
                await safe_send_message(
                    context.bot, update.effective_chat.id, "❌ Quiz not found."
                )
                return

            # Check if quiz is still active
            if quiz.status != QuizStatus.ACTIVE or (
                quiz.end_time and quiz.end_time <= datetime.utcnow()
            ):
                await safe_send_message(
                    context.bot,
                    update.effective_chat.id,
                    "❌ This quiz is no longer active.",
                )
                return

            # Send quiz intro with start button (don't create session yet)
            total_questions = len(quiz.questions) if quiz.questions else 0
            timer_seconds = Config.QUESTION_TIMER_SECONDS

            intro_text = f"""🎲 Get ready for the quiz '{quiz.topic}'

🖊 {total_questions} questions
⏱ {timer_seconds} seconds per question
🔀 Questions and answers shuffled

🏁 Press the button below when you are ready.
Send /stop to stop it."""

            from telegram import InlineKeyboardButton, InlineKeyboardMarkup

            keyboard = [
                [
                    InlineKeyboardButton(
                        "🚀 Start Quiz", callback_data=f"enhanced_quiz_start:{quiz.id}"
                    )
                ]
            ]
            reply_markup = InlineKeyboardMarkup(keyboard)

            # Send to user's DM
            await safe_send_message(
                context.bot, user_id, intro_text, reply_markup=reply_markup
            )

            # Confirm in group chat
            await safe_send_message(
                context.bot,
                update.effective_chat.id,
                f"🎮 **{quiz.topic}** Challenge Ready! 🏆\n\n📱 Check your DMs to start the quiz!",
            )
        else:
            await safe_send_message(
                context.bot,
                update.effective_chat.id,
                "❌ No active quizzes found. Use /createquiz to create a new quiz.",
            )

    except Exception as e:
        logger.error(f"Error in enhanced play_quiz_handler: {e}")
        await safe_send_message(
            context.bot,
            update.effective_chat.id,
            "❌ Error starting quiz. Please try again.",
        )
    finally:
        session.close()


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

    # Get the quiz from database
    session = SessionLocal()
    try:
        quiz = session.query(Quiz).filter(Quiz.id == quiz_id).first()
        if not quiz:
            await query.edit_message_text("❌ Quiz not found.")
            return

        # Check if quiz is still active
        if quiz.status != QuizStatus.ACTIVE or (
            quiz.end_time and quiz.end_time <= datetime.utcnow()
        ):
            await query.edit_message_text("❌ This quiz is no longer active.")
            return

        # Send quiz intro with start button (don't create session yet)
        total_questions = len(quiz.questions) if quiz.questions else 0
        timer_seconds = Config.QUESTION_TIMER_SECONDS

        intro_text = f"""🎲 Get ready for the quiz '{quiz.topic}'

🖊 {total_questions} questions
⏱ {timer_seconds} seconds per question
🔀 Questions and answers shuffled

🏁 Press the button below when you are ready.
Send /stop to stop it."""

        from telegram import InlineKeyboardButton, InlineKeyboardMarkup

        keyboard = [
            [
                InlineKeyboardButton(
                    "🚀 Start Quiz", callback_data=f"enhanced_quiz_start:{quiz.id}"
                )
            ]
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)

        # Send to user's DM
        await safe_send_message(
            context.bot, current_user_id, intro_text, reply_markup=reply_markup
        )

        # Update the selection message
        await query.edit_message_text(
            f"🎯 **{quiz.topic}** Quiz Ready! ⚡\n\n📱 Check your DMs to start the quiz!"
        )

    except Exception as e:
        logger.error(f"Error in enhanced play_quiz_selection_callback: {e}")
        await query.edit_message_text("❌ Error starting quiz. Please try again.")
    finally:
        session.close()


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


async def announce_quiz_end_handler(update: Update, context: CallbackContext):
    """Handler for /announceend command to manually trigger quiz end announcement."""
    if not context.args:
        await safe_send_message(
            context.bot,
            update.effective_chat.id,
            "❌ Please provide a quiz ID. Usage: /announceend <quiz_id>",
        )
        return

    quiz_id = context.args[0]
    await announce_quiz_end(context.application, quiz_id)

    await safe_send_message(
        context.bot,
        update.effective_chat.id,
        f"✅ Quiz end announcement triggered for quiz {quiz_id}",
    )


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


async def handle_enhanced_quiz_start_callback(update: Update, context: CallbackContext):
    """Handle enhanced quiz start button"""
    query = update.callback_query
    await query.answer()

    user_id = str(query.from_user.id)
    quiz_id = query.data.split(":")[1]

    # Get quiz from database
    db_session = SessionLocal()
    try:
        quiz = db_session.query(Quiz).filter(Quiz.id == quiz_id).first()
        if not quiz:
            await safe_send_message(context.bot, user_id, "❌ Quiz not found.")
            return

        # Check if quiz is still active and not ended
        if quiz.status != QuizStatus.ACTIVE:
            await safe_send_message(
                context.bot, user_id, "❌ This quiz is no longer active."
            )
            return

        if quiz.end_time and quiz.end_time <= datetime.utcnow():
            await safe_send_message(
                context.bot,
                user_id,
                "❌ This quiz has already ended. Check the final results!",
            )
            return

        # Create quiz session directly (don't call start_enhanced_quiz to avoid duplicate intro)
        # Parse questions
        questions_list = quiz.questions
        if isinstance(questions_list, dict):
            questions_list = [questions_list]

        if not questions_list:
            await safe_send_message(
                context.bot, user_id, "❌ This quiz has no questions available."
            )
            return

        # Check if user has already attempted this quiz (completed or started)
        existing_answers = (
            db_session.query(QuizAnswer)
            .filter(QuizAnswer.user_id == user_id, QuizAnswer.quiz_id == quiz_id)
            .count()
        )

        if existing_answers > 0:
            await safe_send_message(
                context.bot,
                user_id,
                f"❌ You have already attempted the quiz '{quiz.topic}'. Each quiz can only be played once, even if you didn't finish it.",
            )
            return

        # Check if user already has an active session for THIS SPECIFIC quiz
        # (Allow multiple different quizzes, but not the same quiz)
        session_key = f"{user_id}:{quiz.id}"  # Use quiz.id to match the format in start_enhanced_quiz

        # Debug: Log all active sessions for this user
        user_sessions = [
            k for k in active_quiz_sessions.keys() if k.startswith(f"{user_id}:")
        ]
        logger.info(f"User {user_id} active sessions: {user_sessions}")
        logger.info(f"Looking for session key: {session_key}")

        # Comprehensive session cleanup for this user
        current_time = datetime.utcnow()
        stale_sessions = []
        for key in user_sessions:
            if key in active_quiz_sessions:
                quiz_session = active_quiz_sessions[key]
                should_remove = False

                # Remove sessions that don't have a start_time (incomplete initialization)
                if (
                    not hasattr(quiz_session, "start_time")
                    or quiz_session.start_time is None
                ):
                    should_remove = True
                    logger.info(f"Found session without start_time: {key}")

                # Check if session is older than 30 minutes (1800 seconds)
                elif hasattr(quiz_session, "start_time") and quiz_session.start_time:
                    time_diff = (current_time - quiz_session.start_time).total_seconds()
                    if time_diff > 1800:  # 30 minutes instead of 1 hour
                        should_remove = True
                        logger.info(
                            f"Found stale session {key}, age: {time_diff} seconds"
                        )

                # Remove sessions that don't have proper quiz_id or user_id
                elif not hasattr(quiz_session, "quiz_id") or not hasattr(
                    quiz_session, "user_id"
                ):
                    should_remove = True
                    logger.info(f"Found session with missing quiz_id or user_id: {key}")

                # Remove sessions where the quiz_id doesn't match the session key
                elif (
                    hasattr(quiz_session, "quiz_id")
                    and f"{user_id}:{quiz_session.quiz_id}" != key
                ):
                    should_remove = True
                    logger.info(
                        f"Found session with mismatched quiz_id: {key} vs expected {user_id}:{quiz_session.quiz_id}"
                    )

                if should_remove:
                    stale_sessions.append(key)

        # Remove stale sessions
        for key in stale_sessions:
            active_quiz_sessions.pop(key, None)
            logger.info(f"Removed stale session: {key}")

        # Check if session already exists for this quiz
        if session_key in active_quiz_sessions:
            logger.info(
                f"Found existing session for {session_key}, using it to start quiz"
            )
            quiz_session = active_quiz_sessions[session_key]
        else:
            # Create new quiz session
            quiz_session = QuizSession(
                user_id=user_id,
                quiz_id=quiz.id,
                questions=questions_list,
                shuffle_questions=True,
                shuffle_answers=True,
            )

            active_quiz_sessions[session_key] = quiz_session
            logger.info(
                f"Enhanced quiz session created: {session_key}, total_sessions={len(active_quiz_sessions)}"
            )

        # Create a record that the user has started this quiz (prevents restarting if abandoned)
        try:
            quiz_attempt = QuizAnswer(
                user_id=user_id,
                quiz_id=quiz_id,
                answer="",  # Empty answer indicates quiz was started but not completed
                is_correct=False,
                answered_at=datetime.utcnow(),
                question_index=0,
            )
            db_session.add(quiz_attempt)
            db_session.commit()
            logger.info(
                f"Created quiz attempt record for user {user_id}, quiz {quiz_id}"
            )
        except Exception as e:
            logger.error(f"Error creating quiz attempt record: {e}")
            db_session.rollback()

        # Send first question immediately
        await send_enhanced_question(context.application, user_id, quiz_session, quiz)

    except Exception as e:
        logger.error(f"Error starting enhanced quiz: {e}")
        await safe_send_message(
            context.bot, user_id, "❌ Error starting quiz. Please try again."
        )
    finally:
        db_session.close()


async def handle_poll_answer(update: Update, context: CallbackContext):
    """Handle poll answer submissions for enhanced quizzes"""
    if not update.poll_answer:
        return

    poll_answer = update.poll_answer
    user_id = str(poll_answer.user.id)
    poll_id = poll_answer.poll_id
    selected_option = poll_answer.option_ids[0] if poll_answer.option_ids else None

    if selected_option is None:
        return

    logger.info(
        f"Poll answer received: user={user_id}, poll_id={poll_id}, option={selected_option}"
    )
    logger.info(f"Active quiz sessions: {list(active_quiz_sessions.keys())}")
    logger.info(
        f"User sessions: {[k for k in active_quiz_sessions.keys() if k.startswith(f'{user_id}:')]}"
    )

    # Find which quiz session this poll belongs to
    session_key = None
    quiz_session = None

    # Look for active sessions for this user
    for key, session in active_quiz_sessions.items():
        if key.startswith(f"{user_id}:"):
            # For now, assume this is the correct session if user has only one active session
            # This is a simplified approach - in a more complex system, you might want to
            # track poll IDs to session mappings
            session_key = key
            quiz_session = session
            break

    if not quiz_session:
        logger.warning(f"No active quiz session found for user {user_id}")
        return

    logger.info(f"Found quiz session: {session_key}")

    # Get the selected answer text
    current_q = quiz_session.get_current_question()
    if not current_q:
        logger.warning(f"No current question found for session {session_key}")
        return

    shuffled_options = current_q.get("shuffled_options", {})
    options_list = list(shuffled_options.values())

    if selected_option >= len(options_list):
        logger.warning(
            f"Invalid option {selected_option} for question with {len(options_list)} options"
        )
        return

    selected_answer = options_list[selected_option]

    logger.info(
        f"Processing answer: {selected_answer} for question {quiz_session.current_question_index}"
    )

    # IMMEDIATELY delete the poll message when answer is received
    try:
        from utils.redis_client import RedisClient
        from telegram.error import BadRequest

        redis_client = RedisClient()
        current_question_index = quiz_session.current_question_index
        poll_message_id = await redis_client.get_user_quiz_data(
            user_id, quiz_session.quiz_id, f"poll_message_{current_question_index}"
        )
        await redis_client.close()

        if poll_message_id:
            # Delete the poll message immediately
            await context.application.bot.delete_message(
                chat_id=user_id, message_id=int(poll_message_id)
            )
            logger.info(
                f"Immediately deleted poll message {poll_message_id} for user {user_id}"
            )

    except BadRequest as e:
        if "message to delete not found" in str(e).lower():
            logger.info(f"Poll message {poll_message_id} already deleted")
        elif "message can't be deleted" in str(e).lower():
            # Fallback: Stop the poll if deletion fails
            logger.warning(
                f"Cannot delete poll message {poll_message_id}, falling back to stop_poll"
            )
            try:
                await context.application.bot.stop_poll(
                    chat_id=user_id, message_id=int(poll_message_id)
                )
                logger.info(f"Successfully stopped poll {poll_message_id} as fallback")
            except Exception as stop_error:
                logger.error(f"Failed to stop poll as fallback: {stop_error}")
        else:
            logger.error(f"BadRequest when deleting poll message: {e}")
    except Exception as e:
        logger.error(f"Error deleting poll message: {e}")

    # Handle the answer
    logger.info(
        f"Calling handle_enhanced_quiz_answer for user {user_id}, quiz {quiz_session.quiz_id}"
    )
    result = await handle_enhanced_quiz_answer(
        context.application, user_id, quiz_session.quiz_id, selected_answer
    )
    logger.info(f"handle_enhanced_quiz_answer result: {result}")


async def stop_enhanced_quiz(update: Update, context: CallbackContext):
    """Stop current enhanced quiz session"""
    user_id = str(update.effective_user.id)

    # Find and remove ALL user's active sessions (in case there are multiple)
    removed_sessions = []
    for key in list(active_quiz_sessions.keys()):
        if key.startswith(f"{user_id}:"):
            removed_sessions.append(key)
            active_quiz_sessions.pop(key, None)

    # Also clean up any scheduled tasks for this user
    from services.quiz_service import scheduled_tasks

    removed_tasks = []
    for task_key in list(scheduled_tasks.keys()):
        if task_key.startswith(f"{user_id}:"):
            try:
                scheduled_tasks[task_key].cancel()
                removed_tasks.append(task_key)
            except Exception as e:
                logger.error(f"Error cancelling task {task_key}: {e}")
            finally:
                scheduled_tasks.pop(task_key, None)

    # Clean up Redis data and delete any active poll messages for this user
    try:
        from utils.redis_client import RedisClient
        from telegram.error import BadRequest

        redis_client = RedisClient()
        # Get all quiz data for this user and clean it up
        user_quiz_keys = await redis_client.get_user_quiz_keys(user_id)

        # Delete any active poll messages before cleaning up Redis data
        for quiz_key in user_quiz_keys:
            # Try to find and delete poll messages for this quiz
            try:
                # Get all poll message IDs for this quiz
                for i in range(20):  # Check up to 20 questions
                    poll_message_id = await redis_client.get_user_quiz_data(
                        user_id, quiz_key, f"poll_message_{i}"
                    )
                    if poll_message_id:
                        try:
                            await context.bot.delete_message(
                                chat_id=user_id, message_id=int(poll_message_id)
                            )
                            logger.info(
                                f"Deleted poll message {poll_message_id} during quiz stop"
                            )
                        except BadRequest as e:
                            if "message to delete not found" in str(e).lower():
                                logger.info(
                                    f"Poll message {poll_message_id} already deleted"
                                )
                            else:
                                logger.warning(
                                    f"Could not delete poll message {poll_message_id}: {e}"
                                )
                        except Exception as e:
                            logger.warning(
                                f"Error deleting poll message {poll_message_id}: {e}"
                            )
            except Exception as e:
                logger.warning(
                    f"Error processing poll messages for quiz {quiz_key}: {e}"
                )

            # Clean up the Redis data
            await redis_client.delete_user_quiz_data(user_id, quiz_key)

        await redis_client.close()
    except Exception as e:
        logger.error(f"Error cleaning up Redis data for user {user_id}: {e}")

    if removed_sessions:
        session_count = len(removed_sessions)
        task_count = len(removed_tasks)
        await safe_send_message(
            context.bot,
            user_id,
            f"🛑 Quiz stopped successfully!\n\n📊 Cleaned up:\n• {session_count} active session(s)\n• {task_count} scheduled task(s)\n\n🎮 You can start a new quiz anytime!",
        )
        logger.info(
            f"Stopped {session_count} sessions and {task_count} tasks for user {user_id}"
        )
    else:
        await safe_send_message(context.bot, user_id, "ℹ️ No active quiz to stop.")


async def debug_sessions_handler(update: Update, context: CallbackContext):
    """Debug command to show user's active sessions"""
    user_id = str(update.effective_user.id)

    # Check active sessions
    user_sessions = [
        key for key in active_quiz_sessions.keys() if key.startswith(f"{user_id}:")
    ]

    # Check scheduled tasks
    from services.quiz_service import scheduled_tasks

    user_tasks = [
        key for key in scheduled_tasks.keys() if key.startswith(f"{user_id}:")
    ]

    # Check Redis data
    try:
        from utils.redis_client import RedisClient

        redis_client = RedisClient()
        user_quiz_keys = await redis_client.get_user_quiz_keys(user_id)
        await redis_client.close()
    except Exception as e:
        user_quiz_keys = []
        logger.error(f"Error checking Redis data: {e}")

    debug_text = f"🔍 **Debug Info for User {user_id}**\n\n"
    debug_text += f"📊 **Active Sessions:** {len(user_sessions)}\n"
    for session in user_sessions:
        debug_text += f"• {session}\n"

    debug_text += f"\n⏰ **Scheduled Tasks:** {len(user_tasks)}\n"
    for task in user_tasks:
        debug_text += f"• {task}\n"

    debug_text += f"\n💾 **Redis Keys:** {len(user_quiz_keys)}\n"
    for key in user_quiz_keys:
        debug_text += f"• {key}\n"

    if not user_sessions and not user_tasks and not user_quiz_keys:
        debug_text += "\n✅ **All clear!** No active sessions or tasks found."
    else:
        debug_text += "\n💡 Use /stop to clean up all sessions and tasks."

    await safe_send_message(context.bot, user_id, debug_text, parse_mode="Markdown")
