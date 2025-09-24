from telegram import (
    Update,
    InlineKeyboardMarkup,
    InlineKeyboardButton,
    ReplyKeyboardMarkup,
    KeyboardButton,
)
from telegram.ext import CallbackContext
from .keyboard_markups import (
    create_main_menu_keyboard,
    create_wallet_keyboard,
    create_leaderboards_keyboard,
    create_withdrawal_keyboard,
    create_history_keyboard,
    create_cancel_keyboard,
    remove_keyboard,
    create_inline_cancel_keyboard,
    create_inline_main_menu_keyboard,
    create_inline_leaderboards_keyboard,
)
from utils.redis_client import RedisClient
from services.wallet_service import WalletService
import logging
from utils.config import Config

logger = logging.getLogger(__name__)


async def send_message_with_keyboard(
    update: Update, context: CallbackContext, text: str, keyboard_func=None
):
    """
    Helper function to ensure all messages include the appropriate keyboard.
    This prevents the menu keyboard from disappearing.

    Args:
        update: Telegram update object
        context: Callback context
        text: Message text to send
        keyboard_func: Function that returns the appropriate keyboard (defaults to main menu)
    """
    if keyboard_func is None:
        keyboard_func = create_main_menu_keyboard

    if update.callback_query:
        # Handle callback query updates
        await update.callback_query.answer()
        await update.callback_query.message.reply_text(
            text, reply_markup=keyboard_func()
        )
    else:
        # Handle regular message updates
        await update.message.reply_text(text, reply_markup=keyboard_func())


async def handle_first_time_wallet_creation(
    update: Update, context: CallbackContext
) -> None:
    """
    Handles wallet creation for first-time users
    """
    user_id = update.effective_user.id
    user_name = update.effective_user.username or update.effective_user.first_name

    # Send initial loading message
    loading_message = await update.message.reply_text(
        "🔧 **Creating your NEAR wallet...**\n⏳ Please wait while we set up your account on the blockchain...",
        parse_mode="Markdown",
    )

    try:
        # Update loading message with progress
        await loading_message.edit_text(
            "🔧 **Creating your NEAR wallet...**\n⏳ Generating secure keys and creating your account...",
            parse_mode="Markdown",
        )

        # Create wallet service and generate demo wallet
        wallet_service = WalletService()
        network = "mainnet" if Config.is_mainnet_enabled() else "testnet"
        wallet_info = await wallet_service.create_wallet(
            user_id, user_name=user_name, network=network
        )

        # Update loading message with final step
        await loading_message.edit_text(
            "🔧 **Creating your NEAR wallet...**\n✅ Account created! Finalizing your wallet...",
            parse_mode="Markdown",
        )

        # Format the wallet info message and get mini app keyboard
        wallet_message, mini_app_keyboard = (
            await wallet_service.format_wallet_info_message(wallet_info)
        )

        # Store user state in Redis
        redis_client = RedisClient()
        await redis_client.set_user_data_key(user_id, "current_menu", "main")

        # Update the loading message with the wallet creation result
        # Note: editMessageText only supports InlineKeyboardMarkup, not ReplyKeyboardMarkup
        await loading_message.edit_text(
            f"🎉 Welcome to SolviumAI, {user_name}!\n{wallet_message}",
            parse_mode="Markdown",
        )

        # Send the main menu keyboard as a separate message
        await update.message.reply_text(
            "🎮 **Choose an option:**",
            parse_mode="Markdown",
            reply_markup=create_main_menu_keyboard(),
        )

    except Exception as e:
        logger.error(f"Error creating wallet for user {user_id}: {e}")
        await loading_message.edit_text(
            "❌ **Wallet Creation Failed**\nSorry, there was an error creating your wallet. Please try again.",
            parse_mode="Markdown",
        )

        # Send the main menu keyboard as a separate message
        await update.message.reply_text(
            "🎮 **Choose an option:**",
            parse_mode="Markdown",
            reply_markup=create_main_menu_keyboard(),
        )


async def handle_silent_wallet_creation(
    update: Update, context: CallbackContext
) -> bool:
    """
    Handles wallet creation for first-time users with wallet info messages
    Returns True if successful, False otherwise
    """
    user_id = update.effective_user.id
    user_name = update.effective_user.username or update.effective_user.first_name

    try:
        # Send initial loading message
        loading_message = await context.bot.send_message(
            chat_id=user_id,
            text="🔧 **Creating your NEAR wallet...**\n⏳ Please wait while we set up your account on the blockchain...",
            parse_mode="Markdown",
        )

        # Create wallet service and generate demo wallet
        wallet_service = WalletService()
        network = "mainnet" if Config.is_mainnet_enabled() else "testnet"

        wallet_info = await wallet_service.create_wallet(
            user_id, user_name=user_name, network=network
        )

        # Format the wallet info message
        wallet_message, mini_app_keyboard = (
            await wallet_service.format_wallet_info_message(wallet_info)
        )

        # Send the wallet creation result
        await loading_message.edit_text(
            f"🎉 **Wallet Created Successfully!**\n{wallet_message}",
            parse_mode="Markdown",
            reply_markup=mini_app_keyboard,
        )

        # Store user state in Redis
        redis_client = RedisClient()
        await redis_client.set_user_data_key(user_id, "current_menu", "main")

        return True
    except Exception as e:
        logger.error(f"Error creating wallet for user {user_id}: {e}")
        logger.error(f"Error type: {type(e).__name__}")

        # Determine error type and provide appropriate message
        error_message = "Sorry, there was an error creating your wallet."
        if "timeout" in str(e).lower() or "timed out" in str(e).lower():
            error_message = "The wallet creation is taking longer than expected. Your wallet may have been created successfully, but we couldn't confirm it in time."
        elif "connection" in str(e).lower() or "network" in str(e).lower():
            error_message = "There was a network connection issue. Please check your internet connection and try again."
        elif "database" in str(e).lower() or "db" in str(e).lower():
            error_message = "There was a database issue. Your wallet may have been created, but we couldn't save the information properly."

        # Try to send error message if loading message was created
        try:
            # Create retry keyboard
            retry_keyboard = InlineKeyboardMarkup(
                [
                    [
                        InlineKeyboardButton(
                            "🔄 Try Again",
                            callback_data=f"retry_wallet_creation:{user_id}",
                        )
                    ],
                    [
                        InlineKeyboardButton(
                            "🆘 Contact Support", callback_data="contact_support"
                        )
                    ],
                ]
            )

            await loading_message.edit_text(
                f"❌ **Wallet Creation Failed**\n{error_message} Please try again later.",
                parse_mode="Markdown",
                reply_markup=retry_keyboard,
            )
        except:
            pass
        return False


# Main Button - Show main menu - Work on it
async def show_main_menu(update: Update, context: CallbackContext) -> None:
    """
    Shows the main menu with the 2x2 grid of buttons directly below the keyboard input.
    This is the primary interface users will see using ReplyKeyboardMarkup.
    """
    user_id = update.effective_user.id
    user_name = update.effective_user.username or update.effective_user.first_name

    welcome_text = (
        f"🎉 Welcome to SolviumAI, {user_name}!\nWhat would you like to do today?"
    )

    # Store user state in Redis
    redis_client = RedisClient()
    await redis_client.set_user_data_key(user_id, "current_menu", "main")

    # Send message with reply keyboard that appears directly below the input field
    # Handle both message updates and callback queries
    if update.callback_query:
        # From inline keyboard - delete the old message and send new one with reply keyboard
        await update.callback_query.answer()
        await update.callback_query.delete_message()

        await context.bot.send_message(
            chat_id=update.effective_chat.id,
            text=welcome_text,
            reply_markup=create_main_menu_keyboard(),
        )
    else:
        # From regular message or command
        await update.message.reply_text(
            welcome_text, reply_markup=create_main_menu_keyboard()
        )


async def handle_text_message(update: Update, context: CallbackContext) -> None:
    """
    Handles text messages that correspond to ReplyKeyboardMarkup button presses.
    This replaces the callback query handling for ReplyKeyboardMarkup.
    """
    user_id = update.effective_user.id
    message_text = update.message.text

    logger.info(f"Text message from user {user_id}: {message_text}")

    # Only process messages that are actual menu button presses
    # If it's not a menu button, let other handlers deal with it
    menu_buttons = [
        # Main menu buttons
        "💰 My Wallet",
        "🎯 My Points",
        "🏆 Leaderboards",
        "📜 History",
        # Wallet submenu buttons
        "💰 View Balance",
        "🔑 Export Keys",
        "📤 Withdraw",
        "📥 Receive",
        "📊 Transactions",
        # Receive screen buttons
        "🔄 Check NEAR Balance",
        "🪙 Check Token Balance",
        "💰 Check All Balances",
        "⬅️ Back to Wallet",
        # Leaderboard submenu buttons
        "🏆 Global Leaderboard",
        "👥 Group Leaderboard",
        "📊 Weekly Top",
        "🎖️ All Time Best",
        # History submenu buttons
        "📝 Quiz Activity",
        "💰 Points History",
        "💳 Wallet Activity",
        "🏆 Achievements",
        # Navigation buttons
        "⬅️ Back to Main Menu",
        "❌ Cancel",
        "⬅️ Back",
    ]

    if message_text not in menu_buttons:
        logger.info(
            f"Message '{message_text}' from user {user_id} is not a menu button, letting other handlers deal with it"
        )
        return  # Let other handlers process this message

    # Check if user has a wallet - if not, create one first
    wallet_service = WalletService()
    has_wallet = await wallet_service.has_wallet_robust(user_id)

    if not has_wallet:
        # Create wallet for first-time user
        await handle_first_time_wallet_creation(update, context)
        return

    # Parse the button text and route to appropriate handler
    if message_text == "💰 My Wallet":
        await handle_my_wallet(update, context)
    elif message_text == "🎯 My Points":
        await handle_my_points(update, context)
    elif message_text == "🏆 Leaderboards":
        await handle_leaderboards(update, context)
    elif message_text == "📜 History":
        await handle_history(update, context)
    # Wallet submenu handlers
    elif message_text == "💰 View Balance":
        await handle_view_balance(update, context)
    elif message_text == "🔑 Export Keys":
        await handle_export_keys(update, context)
    elif message_text == "📤 Withdraw":
        await handle_withdraw(update, context)
    elif message_text == "📥 Receive":
        await handle_receive(update, context)
    elif message_text == "📊 Transactions":
        await handle_transactions(update, context)
    # Receive screen handlers
    elif message_text == "🔄 Check NEAR Balance":
        await handle_check_near_balance_after_deposit(update, context)
    elif message_text == "🪙 Check Token Balance":
        await handle_check_token_balance_after_deposit(update, context)
    elif message_text == "💰 Check All Balances":
        await handle_check_all_balances_after_deposit(update, context)
    elif message_text == "⬅️ Back to Wallet":
        await handle_my_wallet(update, context)
    # Leaderboard submenu handlers
    elif message_text == "🏆 Global Leaderboard":
        await handle_global_leaderboard(update, context)
    elif message_text == "👥 Group Leaderboard":
        await handle_group_leaderboard(update, context)
    elif message_text == "📊 Weekly Top":
        await handle_weekly_top(update, context)
    elif message_text == "🎖️ All Time Best":
        await handle_all_time_best(update, context)
    # History submenu handlers
    elif message_text == "📝 Quiz Activity":
        await handle_quiz_activity(update, context)
    elif message_text == "💰 Points History":
        await handle_points_history(update, context)
    elif message_text == "💳 Wallet Activity":
        await handle_wallet_activity(update, context)
    elif message_text == "🏆 Achievements":
        await handle_achievements(update, context)
    # Navigation handlers
    elif message_text == "⬅️ Back to Main Menu":
        await show_main_menu(update, context)
    elif message_text in ["❌ Cancel", "⬅️ Back"]:
        await show_main_menu(update, context)
        await handle_challenge_stats(update, context)
    # Community handlers
    elif message_text == "📢 Join Announcements":
        await handle_join_announcements(update, context)
    elif message_text == "💬 Join Discussion":
        await handle_join_discussion(update, context)
    elif message_text == "🎮 Join Gaming":
        await handle_join_gaming(update, context)
    elif message_text == "📈 Join Trading":
        await handle_join_trading(update, context)
    # App handlers
    elif message_text == "🌐 Open Web App":
        await handle_open_web_app(update, context)
    elif message_text == "📱 Download Mobile":
        await handle_download_mobile(update, context)
    elif message_text == "💳 Connect Wallet":
        await handle_connect_wallet(update, context)
    elif message_text == "💰 View Rewards":
        await handle_view_rewards(update, context)
    # Quiz creation handlers
    elif message_text == "📝 Quick Quiz":
        await handle_quick_quiz(update, context)
    elif message_text == "⚙️ Custom Quiz":
        await handle_custom_quiz(update, context)
    elif message_text == "📊 Quiz Templates":
        await handle_quiz_templates(update, context)
    elif message_text == "📈 My Quizzes":
        await handle_my_quizzes(update, context)
    # Quiz play handlers
    elif message_text == "🎯 Active Quizzes":
        await handle_active_quizzes(update, context)
    elif message_text == "🏆 My Results":
        await handle_my_results(update, context)
    elif message_text == "📊 Quiz History":
        await handle_quiz_history(update, context)
    elif message_text == "🎖️ Achievements":
        await handle_achievements(update, context)
    # Rewards handlers
    elif message_text == "💳 Connect Wallet":
        await handle_connect_wallet(update, context)
    elif message_text == "💰 View Balance":
        await handle_view_balance(update, context)
    elif message_text == "🏆 Claim Rewards":
        await handle_claim_rewards(update, context)
    elif message_text == "📈 Transaction History":
        await handle_transaction_history(update, context)
    # Leaderboard handlers
    elif message_text == "🏆 Global Leaderboard":
        await handle_global_leaderboard(update, context)
    elif message_text == "👥 Group Leaderboard":
        await handle_group_leaderboard(update, context)
    elif message_text == "📊 Weekly Top":
        await handle_weekly_top(update, context)
    elif message_text == "🎖️ All Time Best":
        await handle_all_time_best(update, context)
    # Navigation handlers
    elif message_text == "❌ Cancel":
        await show_main_menu(update, context)
    elif message_text == "⬅️ Back":
        await handle_back_navigation(update, context)
    else:
        # Handle unknown text - could be a regular message
        await handle_unknown_message(update, context)


async def handle_my_points(update: Update, context: CallbackContext) -> None:
    """Handle 'My Points' button press"""
    user_id = str(update.effective_user.id)
    username = (
        update.effective_user.username or update.effective_user.first_name or "User"
    )

    try:
        from services.point_service import PointService

        # Get user's points
        points_data = await PointService.get_user_points(user_id)

        if not points_data:
            await update.message.reply_text(
                "🎯 **Your Points**\n\n"
                "You haven't earned any points yet!\n"
                "Start playing quizzes to earn points:\n"
                "• +5 points for each correct answer\n"
                "• +3 bonus points for first correct answer in timed quizzes\n"
                "• +2 points for each unique player who answers your quiz\n"
                "• +1 bonus point for each correct answer in your quiz",
                parse_mode="Markdown",
                reply_markup=create_main_menu_keyboard(),
            )
            return

        # Format points display
        points_text = f"🎯 **{username}'s Points**\n\n"
        points_text += f"💰 **Total Points:** {points_data['total_points']}\n"
        points_text += f"📊 **Breakdown:**\n"
        points_text += f"   • Quiz Taker Points: {points_data['quiz_taker_points']}\n"
        points_text += (
            f"   • Quiz Creator Points: {points_data['quiz_creator_points']}\n\n"
        )
        points_text += f"📈 **Statistics:**\n"
        points_text += f"   • Correct Answers: {points_data['total_correct_answers']}\n"
        points_text += f"   • Quizzes Created: {points_data['total_quizzes_created']}\n"
        points_text += f"   • Quizzes Taken: {points_data['total_quizzes_taken']}\n"
        points_text += (
            f"   • First Correct Answers: {points_data['first_correct_answers']}\n\n"
        )
        points_text += f"🕒 **Last Updated:** {points_data['last_updated'][:19] if points_data['last_updated'] else 'Never'}\n\n"
        points_text += "💡 **How to earn more points:**\n"
        points_text += "• Answer quiz questions correctly (+5 points each)\n"
        points_text += "• Be first to answer correctly in timed quizzes (+3 bonus)\n"
        points_text += "• Create quizzes that others play (+2 per unique player)\n"
        points_text += "• Get bonus points when players answer correctly (+1 each)"

        await update.message.reply_text(
            points_text, parse_mode="Markdown", reply_markup=create_main_menu_keyboard()
        )

    except Exception as e:
        logger.error(f"Error getting user points for {user_id}: {e}")
        await update.message.reply_text(
            "❌ **Error loading your points**\n\n"
            "There was an error retrieving your point information. Please try again later.",
            parse_mode="Markdown",
            reply_markup=create_main_menu_keyboard(),
        )


async def handle_leaderboards(update: Update, context: CallbackContext) -> None:
    """Handle 'Leaderboards' button press"""
    user_id = update.effective_user.id
    redis_client = RedisClient()

    await update.message.reply_text(
        "🏆 View leaderboards:", reply_markup=create_leaderboards_keyboard()
    )
    await redis_client.set_user_data_key(user_id, "current_menu", "leaderboards")


async def handle_challenge_group(update: Update, context: CallbackContext) -> None:
    """Handle 'Challenge Group' button press"""
    await update.message.reply_text(
        "👥 Group challenges coming soon!\nThis feature will allow you to challenge entire groups to compete in quizzes.",
        reply_markup=create_cancel_keyboard(),
    )


async def handle_challenge_friend(update: Update, context: CallbackContext) -> None:
    """Handle 'Challenge Friend' button press"""
    await update.message.reply_text(
        "👤 Friend challenges coming soon!\nThis feature will allow you to challenge individual friends to quiz battles.",
        reply_markup=create_cancel_keyboard(),
    )


async def handle_my_challenges(update: Update, context: CallbackContext) -> None:
    """Handle 'My Challenges' button press"""
    await update.message.reply_text(
        "🏅 Your challenge history:\nNo active challenges found.",
        reply_markup=create_cancel_keyboard(),
    )


async def handle_challenge_stats(update: Update, context: CallbackContext) -> None:
    """Handle 'Challenge Stats' button press"""
    await update.message.reply_text(
        "📊 Your challenge statistics:\n• Total Challenges: 0\n• Wins: 0\n• Losses: 0\n• Win Rate: 0%",
        reply_markup=create_cancel_keyboard(),
    )


async def handle_join_announcements(update: Update, context: CallbackContext) -> None:
    """Handle 'Join Announcements' button press"""
    await update.message.reply_text(
        "📢 Join our announcements channel:\nhttps://t.me/solvium_announcements",
        reply_markup=create_cancel_keyboard(),
    )


async def handle_join_discussion(update: Update, context: CallbackContext) -> None:
    """Handle 'Join Discussion' button press"""
    await update.message.reply_text(
        "💬 Join our discussion group:\nhttps://t.me/solvium_community",
        reply_markup=create_cancel_keyboard(),
    )


async def handle_join_gaming(update: Update, context: CallbackContext) -> None:
    """Handle 'Join Gaming' button press"""
    await update.message.reply_text(
        "🎮 Join our gaming group:\nhttps://t.me/solvium_gaming",
        reply_markup=create_cancel_keyboard(),
    )


async def handle_join_trading(update: Update, context: CallbackContext) -> None:
    """Handle 'Join Trading' button press"""
    await update.message.reply_text(
        "📈 Join our trading group:\nhttps://t.me/solvium_trading",
        reply_markup=create_cancel_keyboard(),
    )


async def handle_open_web_app(update: Update, context: CallbackContext) -> None:
    """Handle 'Open Web App' button press"""
    await update.message.reply_text(
        "🌐 Opening web app...\nhttps://solvium.ai",
        reply_markup=create_cancel_keyboard(),
    )


async def handle_download_mobile(update: Update, context: CallbackContext) -> None:
    """Handle 'Download Mobile' button press"""
    await update.message.reply_text(
        "📱 Download our mobile app:\nhttps://play.google.com/store/apps/solvium",
        reply_markup=create_cancel_keyboard(),
    )


async def handle_connect_wallet(update: Update, context: CallbackContext) -> None:
    """Handle 'Connect Wallet' button press"""
    user_id = update.effective_user.id
    wallet_service = WalletService()

    try:
        wallet = await wallet_service.get_user_wallet(user_id)
        if wallet:
            wallet_message = await wallet_service.format_wallet_info_message(wallet)

            await update.message.reply_text(
                f"💳 **Your Connected Wallet**\n{wallet_message}",
                parse_mode="Markdown",
                reply_markup=create_cancel_keyboard(),
            )
        else:
            await update.message.reply_text(
                "❌ No wallet found. Please contact support.",
                reply_markup=create_cancel_keyboard(),
            )
    except Exception as e:
        logger.error(f"Error connecting wallet for user {user_id}: {e}")
        await update.message.reply_text(
            "❌ Error connecting wallet. Please try again.",
            reply_markup=create_cancel_keyboard(),
        )


async def handle_view_rewards(update: Update, context: CallbackContext) -> None:
    """Handle 'View Rewards' button press"""
    await update.message.reply_text(
        "💰 Your rewards:\n• Available Balance: 0 SOLV\n• Pending Rewards: 0 SOLV\n• Total Earned: 0 SOLV",
        reply_markup=create_cancel_keyboard(),
    )


async def handle_quick_quiz(update: Update, context: CallbackContext) -> None:
    """Handle 'Quick Quiz' button press"""
    await update.message.reply_text(
        "📝 Quick quiz creation...", reply_markup=create_main_menu_keyboard()
    )
    from bot.handlers import start_createquiz_group

    await start_createquiz_group(update, context)


async def handle_custom_quiz(update: Update, context: CallbackContext) -> None:
    """Handle 'Custom Quiz' button press"""
    await update.message.reply_text(
        "⚙️ Custom quiz creation...", reply_markup=create_main_menu_keyboard()
    )
    from bot.handlers import start_createquiz_group

    await start_createquiz_group(update, context)


async def handle_quiz_templates(update: Update, context: CallbackContext) -> None:
    """Handle 'Quiz Templates' button press"""
    await update.message.reply_text(
        "📊 Quiz templates:\n• General Knowledge\n• Science & Technology\n• History\n• Sports\n• Entertainment",
        reply_markup=create_cancel_keyboard(),
    )


async def handle_my_quizzes(update: Update, context: CallbackContext) -> None:
    """Handle 'My Quizzes' button press"""
    await update.message.reply_text(
        "📈 Your quizzes:\nNo quizzes created yet. Create your first quiz!",
        reply_markup=create_cancel_keyboard(),
    )


# Add handlers for new quiz-focused buttons
async def handle_active_quizzes(update: Update, context: CallbackContext) -> None:
    """Handle 'Active Quizzes' button press"""
    await update.message.reply_text(
        "🎲 Loading available quizzes...", reply_markup=create_main_menu_keyboard()
    )
    from services.quiz_service import play_quiz

    context.args = []
    await play_quiz(update, context)


async def handle_my_results(update: Update, context: CallbackContext) -> None:
    """Handle 'My Results' button press"""
    await update.message.reply_text(
        "🏆 Your recent results:\n• Quiz: General Knowledge - Score: 85%\n• Quiz: Science - Score: 92%\n• Quiz: History - Score: 78%",
        reply_markup=create_cancel_keyboard(),
    )


async def handle_quiz_history(update: Update, context: CallbackContext) -> None:
    """Handle 'Quiz History' button press"""
    await update.message.reply_text(
        "📊 Your quiz history:\n• Total Quizzes: 15\n• Average Score: 82%\n• Best Score: 95%\n• Total Rewards: 450 SOLV",
        reply_markup=create_cancel_keyboard(),
    )


async def handle_achievements(update: Update, context: CallbackContext) -> None:
    """Handle 'Achievements' button press"""
    await update.message.reply_text(
        "🎖️ Your achievements:\n🏆 Quiz Master - Complete 10 quizzes\n🥇 Perfect Score - Get 100% on any quiz\n💰 Reward Collector - Earn 1000 SOLV\n📚 Knowledge Seeker - Play 5 different categories",
        reply_markup=create_cancel_keyboard(),
    )


async def handle_view_balance(update: Update, context: CallbackContext) -> None:
    """Handle 'View Balance' button press"""
    user_id = update.effective_user.id
    wallet_service = WalletService()

    try:
        wallet = await wallet_service.get_user_wallet(user_id)
        if wallet:
            # Force refresh to get real-time balance
            balance = await wallet_service.get_wallet_balance(
                user_id, force_refresh=True
            )
            account_id = wallet.get("account_id", "Unknown")

            await update.message.reply_text(
                f"💰 **Your Wallet Balance**\n"
                f"**Account:** `{account_id}`\n"
                f"**Balance:** {balance}\n",
                f"*{'This is a demo wallet for testing purposes' if Config.is_testnet_enabled() else 'Live wallet on mainnet'}*",
                parse_mode="Markdown",
                reply_markup=create_cancel_keyboard(),
            )
        else:
            await update.message.reply_text(
                "❌ No wallet found. Please contact support.",
                reply_markup=create_cancel_keyboard(),
            )
    except Exception as e:
        logger.error(f"Error viewing balance for user {user_id}: {e}")
        await update.message.reply_text(
            "❌ Error retrieving wallet balance. Please try again.",
            reply_markup=create_cancel_keyboard(),
        )


async def handle_claim_rewards(update: Update, context: CallbackContext) -> None:
    """Handle 'Claim Rewards' button press"""
    await update.message.reply_text(
        "🏆 Claiming rewards...\n✅ Successfully claimed 150 SOLV!\nNew balance: 1,400 SOLV",
        reply_markup=create_cancel_keyboard(),
    )


async def handle_transaction_history(update: Update, context: CallbackContext) -> None:
    """Handle 'Transaction History' button press"""
    await update.message.reply_text(
        "📈 Recent transactions:\n• +150 SOLV - Quiz reward (2 hours ago)\n• +200 SOLV - Quiz reward (1 day ago)\n• +100 SOLV - Quiz reward (3 days ago)",
        reply_markup=create_cancel_keyboard(),
    )





async def handle_back_navigation(update: Update, context: CallbackContext) -> None:
    """Handle 'Back' button press"""
    user_id = update.effective_user.id
    redis_client = RedisClient()

    current_menu = await redis_client.get_user_data_key(user_id, "current_menu")

    if current_menu == "games":
        await show_main_menu(update, context)
    else:
        # Default back to main menu
        await show_main_menu(update, context)


# =============================================================================
# HISTORY HANDLERS
# =============================================================================

async def handle_history(update: Update, context: CallbackContext) -> None:
    """Handle '📜 History' button press"""
    await update.message.reply_text(
        "📜 **Your History**\n\nView your activity and progress across all areas of the platform:",
        reply_markup=create_history_keyboard(),
        parse_mode="Markdown",
    )


async def handle_quiz_activity(update: Update, context: CallbackContext) -> None:
    """Handle '📝 Quiz Activity' button press - show user's quiz history"""
    user_id = str(update.effective_user.id)

    try:
        from store.database import SessionLocal
        from models.quiz import Quiz, QuizAnswer
        from models.user import User
        from sqlalchemy import desc, func
        import datetime

        session = SessionLocal()

        # Get quizzes created by user (last 10)
        created_quizzes = (
            session.query(Quiz)
            .filter(Quiz.creator_id == user_id)
            .order_by(desc(Quiz.created_at))
            .limit(10)
            .all()
        )

        # Get recent quiz participations (last 10)
        participated_quizzes = (
            session.query(QuizAnswer.quiz_id, Quiz.topic, func.count(QuizAnswer.id).label('answers_count'),
                         func.sum(func.case([(QuizAnswer.is_correct == 'True', 1)], else_=0)).label('correct_count'))
            .join(Quiz, QuizAnswer.quiz_id == Quiz.id)
            .filter(QuizAnswer.user_id == user_id)
            .group_by(QuizAnswer.quiz_id, Quiz.topic)
            .order_by(desc(func.max(QuizAnswer.answered_at)))
            .limit(10)
            .all()
        )

        session.close()

        # Format the message
        message = "📝 **Quiz Activity History**\n\n"

        # Created Quizzes Section
        message += "🎯 **Quizzes You Created:**\n"
        if created_quizzes:
            for i, quiz in enumerate(created_quizzes[:5], 1):
                status_emoji = {"DRAFT": "✏️", "FUNDING": "💰", "ACTIVE": "🔥", "CLOSED": "✅"}.get(quiz.status.value, "❓")
                created_date = quiz.created_at.strftime("%m/%d") if quiz.created_at else "N/A"
                message += f"{i}. {status_emoji} {quiz.topic[:30]}{'...' if len(quiz.topic) > 30 else ''} ({created_date})\n"
        else:
            message += "   No quizzes created yet\n"

        message += "\n"

        # Participated Quizzes Section
        message += "🎮 **Recent Quiz Participation:**\n"
        if participated_quizzes:
            for i, (quiz_id, topic, total_answers, correct_answers) in enumerate(participated_quizzes[:5], 1):
                accuracy = f"{int((correct_answers or 0) / total_answers * 100)}%" if total_answers > 0 else "0%"
                message += f"{i}. {topic[:25]}{'...' if len(topic) > 25 else ''}\n   📊 {correct_answers or 0}/{total_answers} ({accuracy})\n"
        else:
            message += "   No quiz participation yet\n"

        await update.message.reply_text(
            message,
            reply_markup=create_history_keyboard(),
            parse_mode="Markdown",
        )

    except Exception as e:
        logger.error(f"Error getting quiz activity for user {user_id}: {e}")
        await update.message.reply_text(
            "❌ Unable to load quiz activity history. Please try again.",
            reply_markup=create_history_keyboard(),
        )


async def handle_points_history(update: Update, context: CallbackContext) -> None:
    """Handle '💰 Points History' button press - show user's point transaction history"""
    user_id = str(update.effective_user.id)

    try:
        from services.point_service import PointService

        # Get point history from the service
        history = await PointService.get_user_point_history(user_id, limit=15)

        if not history:
            await update.message.reply_text(
                "💰 **Points History**\n\n📊 No point transactions found yet.\n\nStart participating in quizzes to earn points!",
                reply_markup=create_history_keyboard(),
                parse_mode="Markdown",
            )
            return

        # Format the message
        message = "💰 **Points History**\n\n"

        total_shown = 0
        for transaction in history:
            if total_shown >= 10:  # Show only last 10 transactions
                break

            # Parse transaction data
            points = transaction.get('points', 0)
            description = transaction.get('description', 'Unknown transaction')
            transaction_type = transaction.get('transaction_type', '')
            created_at = transaction.get('created_at', '')

            # Format date
            try:
                from datetime import datetime
                date_obj = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                date_str = date_obj.strftime("%m/%d %H:%M")
            except:
                date_str = "Unknown"

            # Choose emoji based on transaction type
            if 'CORRECT_ANSWER' in transaction_type:
                emoji = "✅"
            elif 'FIRST_CORRECT' in transaction_type:
                emoji = "🥇"
            elif 'CREATOR_UNIQUE' in transaction_type:
                emoji = "👥"
            elif 'CREATOR_CORRECT' in transaction_type:
                emoji = "🎯"
            else:
                emoji = "💰"

            sign = "+" if points > 0 else ""
            message += f"{emoji} {sign}{points} pts - {description}\n   📅 {date_str}\n\n"
            total_shown += 1

        if len(history) > 10:
            message += f"... and {len(history) - 10} more transactions"

        await update.message.reply_text(
            message,
            reply_markup=create_history_keyboard(),
            parse_mode="Markdown",
        )

    except Exception as e:
        logger.error(f"Error getting points history for user {user_id}: {e}")
        await update.message.reply_text(
            "❌ Unable to load points history. Please try again.",
            reply_markup=create_history_keyboard(),
        )


async def handle_wallet_activity(update: Update, context: CallbackContext) -> None:
    """Handle '💳 Wallet Activity' button press - show user's wallet transaction history"""
    user_id = str(update.effective_user.id)

    try:
        from store.database import SessionLocal
        from models.quiz import Quiz
        from models.wallet import UserWallet
        from sqlalchemy import desc

        session = SessionLocal()

        # Get user's wallet info
        user_wallet = (
            session.query(UserWallet)
            .filter(UserWallet.telegram_user_id == user_id, UserWallet.is_active == True)
            .first()
        )

        if not user_wallet:
            session.close()
            await update.message.reply_text(
                "💳 **Wallet Activity**\n\n❌ No wallet found.\n\nCreate a wallet first from the 'My Wallet' menu to view transaction history.",
                reply_markup=create_history_keyboard(),
                parse_mode="Markdown",
            )
            return

        # Get quiz payments made by this user
        quiz_payments = (
            session.query(Quiz)
            .filter(Quiz.creator_id == user_id, Quiz.payment_transaction_hash.isnot(None))
            .order_by(desc(Quiz.created_at))
            .limit(10)
            .all()
        )

        session.close()

        # Format the message
        message = f"💳 **Wallet Activity**\n\n"
        message += f"🏦 **Wallet:** `{user_wallet.account_id}`\n"
        message += f"🌐 **Network:** {user_wallet.network.title()}\n"
        message += f"📅 **Created:** {user_wallet.created_at.strftime('%m/%d/%Y') if user_wallet.created_at else 'N/A'}\n\n"

        # Quiz Payments Section
        message += "💰 **Quiz Creation Payments:**\n"
        if quiz_payments:
            for i, quiz in enumerate(quiz_payments[:5], 1):
                created_date = quiz.created_at.strftime("%m/%d") if quiz.created_at else "N/A"
                tx_hash_short = f"{quiz.payment_transaction_hash[:8]}...{quiz.payment_transaction_hash[-8:]}" if quiz.payment_transaction_hash else "N/A"
                message += f"{i}. {quiz.topic[:25]}{'...' if len(quiz.topic) > 25 else ''}\n"
                message += f"   📅 {created_date} | 🔗 `{tx_hash_short}`\n"
        else:
            message += "   No quiz payments found\n"

        message += "\n💡 **Tip:** View full transaction details on NEAR Explorer using the transaction hash."

        await update.message.reply_text(
            message,
            reply_markup=create_history_keyboard(),
            parse_mode="Markdown",
        )

    except Exception as e:
        logger.error(f"Error getting wallet activity for user {user_id}: {e}")
        await update.message.reply_text(
            "❌ Unable to load wallet activity. Please try again.",
            reply_markup=create_history_keyboard(),
        )


async def handle_achievements(update: Update, context: CallbackContext) -> None:
    """Handle '🏆 Achievements' button press - show user's achievements and milestones"""
    user_id = str(update.effective_user.id)

    try:
        from services.point_service import PointService

        # Get user points data which contains achievement stats
        user_points = await PointService.get_user_points(user_id)

        if not user_points:
            await update.message.reply_text(
                "🏆 **Achievements**\n\n📊 No achievements data found.\n\nStart participating in quizzes to unlock achievements!",
                reply_markup=create_history_keyboard(),
                parse_mode="Markdown",
            )
            return

        # Get user's current ranking
        leaderboard = await PointService.get_leaderboard(limit=100, leaderboard_type="total")
        user_rank = None
        for entry in leaderboard:
            if entry['user_id'] == user_id:
                user_rank = entry['rank']
                break

        # Calculate achievement levels and badges
        total_points = user_points.get('total_points', 0)
        total_correct = user_points.get('total_correct_answers', 0)
        total_created = user_points.get('total_quizzes_created', 0)
        total_taken = user_points.get('total_quizzes_taken', 0)
        first_correct = user_points.get('first_correct_answers', 0)

        # Format the message
        message = "🏆 **Your Achievements**\n\n"

        # Points Achievements
        message += "💰 **Points Milestones:**\n"
        if total_points >= 1000:
            message += "🥇 Points Master (1000+ pts) ✅\n"
        elif total_points >= 500:
            message += "🥈 Points Expert (500+ pts) ✅\n"
        elif total_points >= 100:
            message += "🥉 Points Collector (100+ pts) ✅\n"
        else:
            next_milestone = 100 if total_points < 100 else (500 if total_points < 500 else 1000)
            message += f"🎯 Next: {next_milestone} pts ({total_points}/{next_milestone})\n"

        message += "\n"

        # Quiz Participation Achievements
        message += "🎮 **Quiz Participation:**\n"
        if total_taken >= 50:
            message += "🏆 Quiz Master (50+ quizzes) ✅\n"
        elif total_taken >= 20:
            message += "🥇 Quiz Expert (20+ quizzes) ✅\n"
        elif total_taken >= 10:
            message += "🥈 Quiz Regular (10+ quizzes) ✅\n"
        elif total_taken >= 5:
            message += "🥉 Quiz Explorer (5+ quizzes) ✅\n"
        else:
            next_milestone = 5 if total_taken < 5 else (10 if total_taken < 10 else 20)
            message += f"🎯 Next: {next_milestone} quizzes ({total_taken}/{next_milestone})\n"

        message += "\n"

        # Quiz Creation Achievements
        message += "🎨 **Quiz Creation:**\n"
        if total_created >= 10:
            message += "👑 Quiz Creator Pro (10+ created) ✅\n"
        elif total_created >= 5:
            message += "🎪 Quiz Maker (5+ created) ✅\n"
        elif total_created >= 1:
            message += "🎯 First Creator (1+ created) ✅\n"
        else:
            message += "🎯 Next: Create your first quiz\n"

        message += "\n"

        # Accuracy Achievements
        if total_taken > 0:
            accuracy = int(total_correct / total_taken * 100) if total_taken > 0 else 0
            message += "🎯 **Accuracy Badges:**\n"
            if accuracy >= 90:
                message += "🎖️ Sharpshooter (90%+ accuracy) ✅\n"
            elif accuracy >= 75:
                message += "🥇 Expert Accuracy (75%+) ✅\n"
            elif accuracy >= 60:
                message += "🥈 Good Accuracy (60%+) ✅\n"
            message += f"📊 Current: {accuracy}% ({total_correct}/{total_taken})\n\n"

        # Ranking Achievement
        message += "🏅 **Ranking:**\n"
        if user_rank:
            if user_rank <= 3:
                message += f"👑 Top 3 Player (#{user_rank}) ✅\n"
            elif user_rank <= 10:
                message += f"🥇 Top 10 Player (#{user_rank}) ✅\n"
            elif user_rank <= 50:
                message += f"🥈 Top 50 Player (#{user_rank}) ✅\n"
            else:
                message += f"📊 Ranked #{user_rank}\n"
        else:
            message += "📊 Not ranked yet\n"

        # Speed Achievement
        if first_correct > 0:
            message += f"\n⚡ **Speed Demon:** {first_correct} first correct answers!\n"

        await update.message.reply_text(
            message,
            reply_markup=create_history_keyboard(),
            parse_mode="Markdown",
        )

    except Exception as e:
        logger.error(f"Error getting achievements for user {user_id}: {e}")
        await update.message.reply_text(
            "❌ Unable to load achievements. Please try again.",
            reply_markup=create_history_keyboard(),
        )


async def handle_reset_wallet(update: Update, context: CallbackContext) -> None:
    """Development command to reset wallet state for testing"""
    user_id = update.effective_user.id

    try:
        # Send initial message
        await update.message.reply_text(
            "🔄 Resetting wallet state...\nThis will delete all wallet data from cache and database.",
            reply_markup=create_main_menu_keyboard(),
        )

        # Delete wallet-related keys from Redis
        redis_client = RedisClient()
        await redis_client.delete_user_data_key(str(user_id), "wallet_created")
        await redis_client.delete_user_data_key(str(user_id), "wallet")

        # Clear cache service data
        from services.cache_service import cache_service

        await cache_service.clear_user_cache(user_id)

        # Delete wallet data from database
        from services.database_service import db_service

        db_deleted = await db_service.delete_user_wallet_data(user_id)

        if db_deleted:
            await update.message.reply_text(
                "✅ Wallet state reset successfully!\n"
                "🗑️ Deleted from:\n"
                "• Redis cache\n"
                "• Database wallet records\n"
                "• User wallet status\n"
                "You can now test wallet creation again by clicking any menu button.",
                reply_markup=create_main_menu_keyboard(),
            )
        else:
            await update.message.reply_text(
                "⚠️ Partial wallet reset completed!\n"
                "✅ Redis cache cleared\n"
                "❌ Database cleanup failed\n"
                "You can still test wallet creation, but old database records may remain.",
                reply_markup=create_main_menu_keyboard(),
            )

    except Exception as e:
        logger.error(f"Error resetting wallet for user {user_id}: {e}")
        await update.message.reply_text(
            "❌ Error resetting wallet state. Please try again.",
            reply_markup=create_main_menu_keyboard(),
        )


async def handle_unknown_message(update: Update, context: CallbackContext) -> None:
    """Handle unknown text messages"""
    await update.message.reply_text(
        "I didn't understand that. Please use the buttons below to navigate.",
        reply_markup=create_main_menu_keyboard(),
    )


# Keep the original callback handlers for InlineKeyboardMarkup compatibility
async def handle_menu_callback(update: Update, context: CallbackContext) -> None:
    """
    Handles all menu-related callback queries from the inline keyboards.
    This is kept for compatibility with InlineKeyboardMarkup.
    """
    query = update.callback_query
    await query.answer()  # Acknowledge the callback

    user_id = update.effective_user.id
    callback_data = query.data

    logger.info(f"Menu callback from user {user_id}: {callback_data}")

    # Parse the callback data
    if callback_data.startswith("menu:"):
        await handle_main_menu_callback(update, context, callback_data)
    elif callback_data.startswith("game:"):
        await handle_game_callback(update, context, callback_data)
    elif callback_data.startswith("challenge:"):
        await handle_challenge_callback(update, context, callback_data)
    elif callback_data.startswith("app:"):
        await handle_app_callback(update, context, callback_data)
    elif callback_data.startswith("quiz:"):
        await handle_quiz_callback(update, context, callback_data)
    elif callback_data in ["cancel", "back"]:
        await handle_navigation_callback(update, context, callback_data)
    else:
        await query.edit_message_text("❌ Invalid menu selection. Please try again.")


async def handle_game_callback(
    update: Update, context: CallbackContext, callback_data: str
) -> None:
    """Handle game-related callback queries"""
    query = update.callback_query
    user_id = update.effective_user.id

    # Since we removed games from main menu, redirect to main menu
    if callback_data.startswith("game:"):
        await query.edit_message_text(
            "🎉 Welcome to SolviumAI!\nWhat would you like to do today?",
            reply_markup=create_inline_main_menu_keyboard(),
        )
    else:
        await query.edit_message_text("❌ Invalid selection. Please try again.")


async def handle_main_menu_callback(
    update: Update, context: CallbackContext, callback_data: str
) -> None:
    """
    Handles main menu button clicks for InlineKeyboardMarkup
    """
    query = update.callback_query
    user_id = update.effective_user.id
    redis_client = RedisClient()

    if callback_data == "menu:main":
        # Show main menu
        welcome_text = f"🎉 Welcome to SolviumAI!\nWhat would you like to do today?"
        await query.edit_message_text(
            welcome_text, reply_markup=create_inline_main_menu_keyboard()
        )
        await redis_client.set_user_data_key(user_id, "current_menu", "main")

    elif callback_data == "menu:wallet":
        # Show wallet options - convert to text message with reply keyboard
        await query.answer()
        await query.delete_message()
        await context.bot.send_message(
            chat_id=update.effective_chat.id,
            text="💰 **My Wallet**\nChoose an option to manage your wallet:",
            reply_markup=create_wallet_keyboard(),
            parse_mode="Markdown",
        )
        await redis_client.set_user_data_key(user_id, "current_menu", "wallet")

    elif callback_data == "menu:my_points":
        # Handle my points
        await handle_my_points_inline(query, context)

    elif callback_data == "menu:leaderboards":
        # Show leaderboards options - convert to text message with reply keyboard
        await query.answer()
        await query.delete_message()
        await context.bot.send_message(
            chat_id=update.effective_chat.id,
            text="🏆 View leaderboards:",
            reply_markup=create_leaderboards_keyboard(),
        )
        await redis_client.set_user_data_key(user_id, "current_menu", "leaderboards")

    elif callback_data == "menu:history":
        # Handle history
        await query.answer()
        await query.delete_message()
        await context.bot.send_message(
            chat_id=update.effective_chat.id,
            text="📜 Loading your gaming history...",
            reply_markup=create_main_menu_keyboard(),
        )
        # You can add the actual history handler here

    # Remove old menu options that no longer exist
    elif callback_data in [
        "menu:pick_game",
        "menu:challenge_friends",
        "menu:join_community",
        "menu:get_app",
    ]:
        # Redirect to main menu for removed options
        await query.edit_message_text(
            "🎉 Welcome to SolviumAI!\nWhat would you like to do today?",
            reply_markup=create_inline_main_menu_keyboard(),
        )
        await redis_client.set_user_data_key(user_id, "current_menu", "main")

    elif callback_data == "menu:my_points":
        # Show user's points
        await handle_my_points_inline(query, context)


async def handle_my_points_inline(query, context: CallbackContext) -> None:
    """Handle 'My Points' inline button press"""
    user_id = str(query.from_user.id)
    username = query.from_user.username or query.from_user.first_name or "User"

    try:
        from services.point_service import PointService

        # Get user's points
        points_data = await PointService.get_user_points(user_id)

        if not points_data:
            points_text = "🎯 **Your Points**\n\n"
            points_text += "You haven't earned any points yet!\n"
            points_text += "Start playing quizzes to earn points:\n"
            points_text += "• +5 points for each correct answer\n"
            points_text += (
                "• +3 bonus points for first correct answer in timed quizzes\n"
            )
            points_text += "• +2 points for each unique player who answers your quiz\n"
            points_text += "• +1 bonus point for each correct answer in your quiz"
        else:
            # Format points display
            points_text = f"🎯 **{username}'s Points**\n\n"
            points_text += f"💰 **Total Points:** {points_data['total_points']}\n"
            points_text += f"📊 **Breakdown:**\n"
            points_text += (
                f"   • Quiz Taker Points: {points_data['quiz_taker_points']}\n"
            )
            points_text += (
                f"   • Quiz Creator Points: {points_data['quiz_creator_points']}\n\n"
            )
            points_text += f"📈 **Statistics:**\n"
            points_text += (
                f"   • Correct Answers: {points_data['total_correct_answers']}\n"
            )
            points_text += (
                f"   • Quizzes Created: {points_data['total_quizzes_created']}\n"
            )
            points_text += f"   • Quizzes Taken: {points_data['total_quizzes_taken']}\n"
            points_text += f"   • First Correct Answers: {points_data['first_correct_answers']}\n\n"
            points_text += f"🕒 **Last Updated:** {points_data['last_updated'][:19] if points_data['last_updated'] else 'Never'}\n\n"
            points_text += "💡 **How to earn more points:**\n"
            points_text += "• Answer quiz questions correctly (+5 points each)\n"
            points_text += (
                "• Be first to answer correctly in timed quizzes (+3 bonus)\n"
            )
            points_text += "• Create quizzes that others play (+2 per unique player)\n"
            points_text += "• Get bonus points when players answer correctly (+1 each)"

        await query.edit_message_text(
            points_text,
            parse_mode="Markdown",
            reply_markup=create_inline_main_menu_keyboard(),
        )

    except Exception as e:
        logger.error(f"Error getting user points for {user_id}: {e}")
        await query.edit_message_text(
            "❌ **Error loading your points**\n\n"
            "There was an error retrieving your point information. Please try again later.",
            parse_mode="Markdown",
            reply_markup=create_inline_main_menu_keyboard(),
        )


async def handle_challenge_callback(
    update: Update, context: CallbackContext, callback_data: str
) -> None:
    """
    Handles challenge-related button clicks for InlineKeyboardMarkup
    """
    query = update.callback_query

    if callback_data == "challenge:group":
        await query.edit_message_text(
            "👥 Group challenges coming soon!\nThis feature will allow you to challenge entire groups to compete in quizzes.",
            reply_markup=create_inline_cancel_keyboard(),
        )

    elif callback_data == "challenge:friend":
        await query.edit_message_text(
            "👤 Friend challenges coming soon!\nThis feature will allow you to challenge individual friends to quiz battles.",
            reply_markup=create_inline_cancel_keyboard(),
        )

    elif callback_data == "challenge:my_challenges":
        await query.edit_message_text(
            "🏅 Your challenge history:\nNo active challenges found.",
            reply_markup=create_inline_cancel_keyboard(),
        )

    elif callback_data == "challenge:stats":
        await query.edit_message_text(
            "📊 Your challenge statistics:\n• Total Challenges: 0\n• Wins: 0\n• Losses: 0\n• Win Rate: 0%",
            reply_markup=create_inline_cancel_keyboard(),
        )


async def handle_app_callback(
    update: Update, context: CallbackContext, callback_data: str
) -> None:
    """
    Handles app-related button clicks for InlineKeyboardMarkup
    """
    query = update.callback_query

    if callback_data == "app:connect_wallet":
        # Trigger wallet connection
        await query.edit_message_text("💳 Connecting wallet...")
        from bot.handlers import link_wallet_handler

        await link_wallet_handler(update, context)

    elif callback_data == "app:rewards":
        await query.edit_message_text(
            "💰 Your rewards:\n• Available Balance: 0 SOLV\n• Pending Rewards: 0 SOLV\n• Total Earned: 0 SOLV",
            reply_markup=create_inline_cancel_keyboard(),
        )


async def handle_quiz_callback(
    update: Update, context: CallbackContext, callback_data: str
) -> None:
    """
    Handles quiz-related button clicks for InlineKeyboardMarkup
    """
    query = update.callback_query

    if callback_data == "quiz:quick_create":
        # Start quick quiz creation
        await query.edit_message_text("📝 Quick quiz creation...")
        # Import and trigger the existing quiz creation flow
        from bot.handlers import start_createquiz_group

        await start_createquiz_group(update, context)

    elif callback_data == "quiz:custom_create":
        await query.edit_message_text("⚙️ Custom quiz creation...")
        # Import and trigger the existing quiz creation flow
        from bot.handlers import start_createquiz_group

        await start_createquiz_group(update, context)

    elif callback_data == "quiz:templates":
        await query.edit_message_text(
            "📊 Quiz templates:\n• General Knowledge\n• Science & Technology\n• History\n• Sports\n• Entertainment",
            reply_markup=create_inline_cancel_keyboard(),
        )

    elif callback_data == "quiz:my_quizzes":
        await query.edit_message_text(
            "📈 Your quizzes:\nNo quizzes created yet. Create your first quiz!",
            reply_markup=create_inline_cancel_keyboard(),
        )


async def handle_navigation_callback(
    update: Update, context: CallbackContext, callback_data: str
) -> None:
    """
    Handles navigation buttons (back, cancel) for InlineKeyboardMarkup
    """
    query = update.callback_query
    user_id = update.effective_user.id
    redis_client = RedisClient()

    if callback_data == "cancel":
        # Go back to main menu
        await query.edit_message_text(
            "🎉 Welcome to SolviumAI!\nWhat would you like to do today?",
            reply_markup=create_inline_main_menu_keyboard(),
        )
        await redis_client.set_user_data_key(user_id, "current_menu", "main")

    elif callback_data == "back":
        # Get current menu state and go back one level
        current_menu = await redis_client.get_user_data_key(user_id, "current_menu")

        if current_menu == "games":
            await query.edit_message_text(
                "🎉 Welcome to SolviumAI!\nWhat would you like to do today?",
                reply_markup=create_inline_main_menu_keyboard(),
            )
            await redis_client.set_user_data_key(user_id, "current_menu", "main")
        else:
            # Default back to main menu
            await query.edit_message_text(
                "🎉 Welcome to SolviumAI!\nWhat would you like to do today?",
                reply_markup=create_inline_main_menu_keyboard(),
            )
            await redis_client.set_user_data_key(user_id, "current_menu", "main")


async def show_menu_in_group(update: Update, context: CallbackContext) -> None:
    """
    Shows the main menu in group chats with a note about DM functionality
    """
    user_name = update.effective_user.username or update.effective_user.first_name

    await update.message.reply_text(
        f"🎉 Hi {user_name}! I'm SolviumAI bot.\n"
        "For the best experience, please DM me to access all features!",
    )


async def handle_start_command(update: Update, context: CallbackContext) -> None:
    """
    Handle /start command with optional deep link parameters
    """
    user_id = update.effective_user.id
    user_name = update.effective_user.username or update.effective_user.first_name

    # Check if there are start parameters for deep linking
    if context.args:
        start_param = context.args[0]

        # Handle quiz deep linking
        if start_param.startswith("quiz_"):
            quiz_id = start_param[5:]  # Remove "quiz_" prefix
            await handle_quiz_deep_link(update, context, quiz_id)
            return

    # Check if user has a wallet - if not, create one first
    wallet_service = WalletService()
    has_wallet = await wallet_service.has_wallet_robust(user_id)

    if not has_wallet:
        # Create wallet for first-time user
        await handle_first_time_wallet_creation(update, context)
        return

    # Show normal main menu
    await show_main_menu(update, context)


async def handle_quiz_deep_link(
    update: Update, context: CallbackContext, quiz_id: str
) -> None:
    """
    Handle quiz deep link from group announcement
    Seamlessly starts the quiz without intermediate messages
    """
    user_id = update.effective_user.id
    user_name = update.effective_user.username or update.effective_user.first_name

    # Check if user has a wallet - if not, create one first
    wallet_service = WalletService()
    has_wallet = await wallet_service.has_wallet_robust(user_id)

    if not has_wallet:
        # Create wallet silently in background
        wallet_created = await handle_silent_wallet_creation(update, context)
        if not wallet_created:
            await update.message.reply_text(
                "❌ **Error setting up your account**\nPlease try again later or use the main menu.",
                parse_mode="Markdown",
                reply_markup=create_main_menu_keyboard(),
            )
            return

    # Start the specific quiz immediately without additional messages
    try:
        from services.quiz_service import (
            start_enhanced_quiz,
            get_quiz_details,
            active_quiz_sessions,
        )
        from store.database import SessionLocal
        from models.quiz import Quiz

        # Clear any existing active sessions for this user to allow fresh start
        user_id_str = str(user_id)
        removed_sessions = []
        for key in list(active_quiz_sessions.keys()):
            if key.startswith(f"{user_id_str}:"):
                removed_sessions.append(key)
                active_quiz_sessions.pop(key, None)

        if removed_sessions:
            logger.info(
                f"Cleared {len(removed_sessions)} existing sessions for user {user_id} in deep link"
            )

        # Get the quiz object from database
        session = SessionLocal()
        try:
            quiz = session.query(Quiz).filter(Quiz.id == quiz_id).first()
            if not quiz:
                await update.message.reply_text(
                    "❌ **Quiz not found**\nThis quiz may have been removed or expired.",
                    parse_mode="Markdown",
                    reply_markup=create_main_menu_keyboard(),
                )
                return

            # Start the enhanced quiz directly
            application = context.application
            await start_enhanced_quiz(
                application=application,
                user_id=user_id_str,
                quiz=quiz,
                shuffle_questions=True,
                shuffle_answers=True,
            )
        except Exception as e:
            logger.error(f"Error starting quiz {quiz_id}: {e}")
            await update.message.reply_text(
                "❌ **Error starting quiz**\nPlease try again later.",
                parse_mode="Markdown",
                reply_markup=create_main_menu_keyboard(),
            )
        finally:
            session.close()

    except ImportError as e:
        logger.error(f"Import error in deep link handler: {e}")
        # Fallback to existing play quiz functionality
        from services.quiz_service import play_quiz

        context.args = [quiz_id]
        await play_quiz(update, context)


# New wallet handlers
async def handle_my_wallet(update: Update, context: CallbackContext) -> None:
    """Handle 'My Wallet' button press - show wallet submenu"""
    await update.message.reply_text(
        "💰 **My Wallet**\nChoose an option to manage your wallet:",
        reply_markup=create_wallet_keyboard(),
    )


async def handle_view_balance(update: Update, context: CallbackContext) -> None:
    """Handle 'View Balance' button press"""
    user_id = update.effective_user.id
    wallet_service = WalletService()

    try:
        # Get user's wallet info
        wallet_data = await wallet_service.get_user_wallet(user_id)

        if wallet_data:
            # Get the actual NEAR balance
            near_balance = await wallet_service.get_wallet_balance(user_id)
            account_id = wallet_data.get("account_id", "N/A")
            network = wallet_data.get("network", "mainnet")

            balance_text = f"""💰 **Wallet Balance**

🏛️ **NEAR Balance:** {near_balance} NEAR
🌐 **Network:** {network.title()}

📍 **Account ID:**
`{account_id}`

� **Tip:** Your balance updates automatically every few minutes"""
        else:
            balance_text = "❌ Unable to retrieve wallet information. Please try again."

        await update.message.reply_text(
            balance_text, reply_markup=create_wallet_keyboard(), parse_mode="Markdown"
        )
    except Exception as e:
        logger.error(f"Error retrieving wallet balance for user {user_id}: {e}")
        await update.message.reply_text(
            "❌ Error retrieving wallet balance. Please try again later.",
            reply_markup=create_wallet_keyboard(),
        )


async def handle_export_keys(update: Update, context: CallbackContext) -> None:
    """Handle 'Export Keys' button press"""
    user_id = update.effective_user.id
    wallet_service = WalletService()

    try:
        # Security warning first
        security_warning = """🔐 **SECURITY WARNING**

⚠️ **CRITICAL:** Your private key gives complete access to your wallet!

🚨 **Security Rules:**
• Never share your private key with anyone
• Store it safely offline (write it down)
• Don't take screenshots or photos
• Don't send via messages or email

📱 **This key works with any NEAR wallet app**

Are you sure you want to export your private key?"""

        # Create confirmation keyboard
        confirm_keyboard = InlineKeyboardMarkup(
            [
                [
                    InlineKeyboardButton(
                        "✅ Yes, Export Keys", callback_data=f"export_confirm:{user_id}"
                    ),
                    InlineKeyboardButton("❌ Cancel", callback_data="export_cancel"),
                ]
            ]
        )

        await update.message.reply_text(
            security_warning, reply_markup=confirm_keyboard, parse_mode="Markdown"
        )
    except Exception as e:
        logger.error(f"Error in export keys handler for user {user_id}: {e}")
        await update.message.reply_text(
            "❌ Error accessing export function. Please try again.",
            reply_markup=create_wallet_keyboard(),
        )


async def handle_withdraw(update: Update, context: CallbackContext) -> None:
    """Handle 'Withdraw' button press"""
    await update.message.reply_text(
        "📤 **Withdraw Funds**\nChoose what you'd like to withdraw:",
        reply_markup=create_withdrawal_keyboard(),
    )


async def handle_receive(update: Update, context: CallbackContext) -> None:
    """Handle 'Receive' button press"""
    user_id = update.effective_user.id
    wallet_service = WalletService()

    try:
        wallet_data = await wallet_service.get_user_wallet(user_id)

        if wallet_data and wallet_data.get("account_id"):
            account_id = wallet_data["account_id"]
            network = wallet_data.get("network", "mainnet")

            receive_text = f"""📥 **Receive Funds**

Send NEAR or supported tokens to your account:

📍 **Your Account ID:**
`{account_id}`

🌐 **Network:** {network.title()}

💡 **What you can receive:**
• NEAR Protocol (NEAR)
• Fungible Tokens (FT) like USDC, wNEAR, etc.
• Any NEP-141 compatible token

💡 **How to deposit:**
1. Copy the Account ID above
2. Send NEAR or tokens from any wallet to this ID
3. Click "🔄 Check Balance" to see updates

⚠️ **Important:** Only send NEAR Protocol assets!
⚠️ **Network:** Make sure sender uses {network}"""

            # Create enhanced keyboard with token balance options
            receive_keyboard = ReplyKeyboardMarkup(
                [
                    [
                        KeyboardButton("🔄 Check NEAR Balance"),
                        KeyboardButton("🪙 Check Token Balance"),
                    ],
                    [
                        KeyboardButton("💰 Check All Balances"),
                        KeyboardButton("⬅️ Back to Wallet"),
                    ],
                ],
                resize_keyboard=True,
                one_time_keyboard=False,
                input_field_placeholder="📱 After deposit...",
            )

            await update.message.reply_text(
                receive_text, reply_markup=receive_keyboard, parse_mode="Markdown"
            )
        else:
            await update.message.reply_text(
                "❌ Unable to retrieve wallet address. Please try again.",
                reply_markup=create_wallet_keyboard(),
            )
    except Exception as e:
        logger.error(f"Error in receive handler for user {user_id}: {e}")
        await update.message.reply_text(
            "❌ Error retrieving wallet information. Please try again.",
            reply_markup=create_wallet_keyboard(),
        )


async def handle_check_near_balance_after_deposit(
    update: Update, context: CallbackContext
) -> None:
    """Handle 'Check NEAR Balance' button press after showing receive info"""
    user_id = update.effective_user.id
    wallet_service = WalletService()

    try:
        # Show loading message
        loading_msg = await update.message.reply_text(
            "🔄 **Checking NEAR Balance...**\nFetching latest NEAR balance from blockchain..."
        )

        # Force refresh NEAR balance from blockchain
        near_balance = await wallet_service.get_wallet_balance(
            user_id, force_refresh=True
        )
        wallet_data = await wallet_service.get_user_wallet(user_id)

        if wallet_data:
            account_id = wallet_data.get("account_id", "N/A")
            network = wallet_data.get("network", "mainnet")

            balance_text = f"""💰 **NEAR Balance Updated**

🏛️ **NEAR Balance:** {near_balance}
🌐 **Network:** {network.title()}
📍 **Account ID:** `{account_id}`

🔄 **Last Updated:** Just now

💡 **Note:** NEAR balance refreshed from blockchain"""

            # Edit the loading message with results
            await loading_msg.edit_text(balance_text, parse_mode="Markdown")

        else:
            await loading_msg.edit_text(
                "❌ Unable to retrieve wallet balance. Please try again."
            )

    except Exception as e:
        logger.error(
            f"Error checking NEAR balance after deposit for user {user_id}: {e}"
        )
        await update.message.reply_text(
            "❌ Error checking NEAR balance. Please try again later.",
            reply_markup=create_wallet_keyboard(),
        )


async def handle_check_token_balance_after_deposit(
    update: Update, context: CallbackContext
) -> None:
    """Handle 'Check Token Balance' button press after showing receive info"""
    user_id = update.effective_user.id
    wallet_service = WalletService()

    try:
        # Show loading message
        loading_msg = await update.message.reply_text(
            "🪙 **Checking Token Balances...**\nScanning for all tokens in your wallet..."
        )

        wallet_data = await wallet_service.get_user_wallet(user_id)

        if wallet_data:
            from services.token_service import TokenService
            from py_near.account import Account

            account_id = wallet_data.get("account_id")
            network = wallet_data.get("network", "mainnet")

            # Get token inventory with force refresh
            token_service = TokenService()
            tokens = await token_service.get_user_token_inventory(
                account_id, force_refresh=True
            )

            if tokens:
                token_text = f"""🪙 **Token Balances Updated**

📍 **Account:** `{account_id}`
🌐 **Network:** {network.title()}

� **Your Tokens:**
"""
                for token in tokens[:10]:  # Show first 10 tokens
                    balance = token.get("balance", "0")
                    symbol = token.get("symbol", "Unknown")
                    name = token.get("name", "Unknown Token")
                    token_text += f"• **{symbol}:** {balance} ({name})\n"

                if len(tokens) > 10:
                    token_text += f"\n... and {len(tokens) - 10} more tokens"

                token_text += f"\n\n🔄 **Last Updated:** Just now"
            else:
                token_text = f"""🪙 **Token Balances**

�📍 **Account:** `{account_id}`
🌐 **Network:** {network.title()}

� **No tokens found**
You don't have any fungible tokens yet.

�🔄 **Last Updated:** Just now"""

            # Edit the loading message with results
            await loading_msg.edit_text(token_text, parse_mode="Markdown")

        else:
            await loading_msg.edit_text(
                "❌ Unable to retrieve wallet information. Please try again."
            )

    except Exception as e:
        logger.error(
            f"Error checking token balance after deposit for user {user_id}: {e}"
        )
        await update.message.reply_text(
            "❌ Error checking token balances. Please try again later.",
            reply_markup=create_wallet_keyboard(),
        )


async def handle_check_all_balances_after_deposit(
    update: Update, context: CallbackContext
) -> None:
    """Handle 'Check All Balances' button press - comprehensive balance check"""
    user_id = update.effective_user.id
    wallet_service = WalletService()

    try:
        # Show loading message
        loading_msg = await update.message.reply_text(
            "💰 **Comprehensive Balance Check...**\nFetching NEAR and all tokens from blockchain..."
        )

        wallet_data = await wallet_service.get_user_wallet(user_id)

        if wallet_data:
            account_id = wallet_data.get("account_id")
            network = wallet_data.get("network", "mainnet")

            # Get NEAR balance with force refresh
            near_balance = await wallet_service.get_wallet_balance(
                user_id, force_refresh=True
            )

            # Get token inventory with force refresh
            from services.token_service import TokenService

            token_service = TokenService()
            tokens = await token_service.get_user_token_inventory(
                account_id, force_refresh=True
            )

            balance_text = f"""💰 **Complete Balance Report**

📍 **Account:** `{account_id}`
🌐 **Network:** {network.title()}

🏛️ **NEAR Balance:** {near_balance}

🪙 **Token Balances:**"""

            if tokens:
                for token in tokens[
                    :8
                ]:  # Show first 8 tokens to avoid message length limits
                    balance = token.get("balance", "0")
                    symbol = token.get("symbol", "Unknown")
                    balance_text += f"\n• **{symbol}:** {balance}"

                if len(tokens) > 8:
                    balance_text += f"\n• ... and {len(tokens) - 8} more tokens"
            else:
                balance_text += "\n• No fungible tokens found"

            balance_text += f"\n\n🔄 **Last Updated:** Just now\n💡 **All balances refreshed from blockchain**"

            # Edit the loading message with results
            await loading_msg.edit_text(balance_text, parse_mode="Markdown")

            # Send wallet menu back after showing balances
            await update.message.reply_text(
                "💰 **My Wallet**\nChoose an option to manage your wallet:",
                reply_markup=create_wallet_keyboard(),
            )

        else:
            await loading_msg.edit_text(
                "❌ Unable to retrieve wallet information. Please try again."
            )

    except Exception as e:
        logger.error(
            f"Error checking all balances after deposit for user {user_id}: {e}"
        )
        await update.message.reply_text(
            "❌ Error checking balances. Please try again later.",
            reply_markup=create_wallet_keyboard(),
        )


async def handle_transactions(update: Update, context: CallbackContext) -> None:
    """Handle 'Transactions' button press"""
    user_id = update.effective_user.id

    try:
        # This would integrate with your transaction history service
        transactions_text = """📊 **Transaction History**

🔄 **Recent Transactions:**

📤 2024-09-20 15:30 - Withdraw: 0.5 NEAR
📥 2024-09-19 10:15 - Quiz Reward: 0.1 NEAR
🎯 2024-09-18 14:22 - Points Earned: 150 Points
📤 2024-09-17 09:45 - Withdraw: 1.0 NEAR

💡 **Tip:** Click on any transaction for full details on NEAR Explorer"""

        await update.message.reply_text(
            transactions_text,
            reply_markup=create_wallet_keyboard(),
            parse_mode="Markdown",
        )
    except Exception as e:
        logger.error(f"Error in transactions handler for user {user_id}: {e}")
        await update.message.reply_text(
            "❌ Error retrieving transaction history. Please try again.",
            reply_markup=create_wallet_keyboard(),
        )


async def handle_history(update: Update, context: CallbackContext) -> None:
    """Handle 'History' button press - show game/quiz history"""
    user_id = update.effective_user.id

    try:
        # This would integrate with your quiz/game history service
        history_text = f"""📜 **Your Gaming History**

🎮 **Recent Activity:**

🏆 Quiz Champion - 2024-09-20 (Won 0.5 NEAR)
🎯 Science Quiz - 2024-09-19 (Score: 8/10, +150 points)
🧠 General Knowledge - 2024-09-18 (Score: 6/10, +100 points)
⚽ Sports Trivia - 2024-09-17 (Score: 9/10, +180 points)

📊 **Stats:**
• Total Quizzes Played: 45
• Average Score: 7.2/10
• Total Earnings: 2.3 NEAR
• Total Points: 4,250

🏅 **Achievements:**
• Quiz Master (10+ perfect scores)
• Streak Champion (7-day streak)
• Knowledge Seeker (25+ quizzes)"""

        await update.message.reply_text(
            history_text,
            reply_markup=create_main_menu_keyboard(),
            parse_mode="Markdown",
        )
    except Exception as e:
        logger.error(f"Error in history handler for user {user_id}: {e}")
        await update.message.reply_text(
            "❌ Error retrieving your history. Please try again.",
            reply_markup=create_main_menu_keyboard(),
        )


# Leaderboard handlers for submenu options
async def handle_global_leaderboard(update: Update, context: CallbackContext) -> None:
    """Handle 'Global Leaderboard' button press"""
    user_id = str(update.effective_user.id)

    try:
        # Show loading message
        loading_msg = await update.message.reply_text(
            "🏆 **Loading Global Leaderboard...**\nFetching latest rankings..."
        )

        from services.point_service import PointService

        # Get leaderboard data
        leaderboard_data = await PointService.get_leaderboard(limit=10, leaderboard_type="total")

        if leaderboard_data:
            leaderboard_text = "🏆 **Global Leaderboard**\n\n"

            # Show top players
            for entry in leaderboard_data:
                rank = entry['rank']
                username = entry['username']
                total_points = entry['total_points']

                # Emoji for top 3
                if rank == 1:
                    emoji = "🥇"
                elif rank == 2:
                    emoji = "🥈"
                elif rank == 3:
                    emoji = "🥉"
                else:
                    emoji = f"{rank}."

                leaderboard_text += f"{emoji} **#{rank}** - {username} ({total_points:,} points)\n"

            # Find user's rank
            user_points_data = await PointService.get_user_points(user_id)
            if user_points_data:
                user_points = user_points_data['total_points']
                # Calculate user's rank by counting users with higher points
                # This is a simplified approach - for better performance, you might want to add a rank field
                if user_points > 0:
                    user_rank_text = f"\n📍 **Your Points:** {user_points:,} points"
                else:
                    user_rank_text = f"\n📍 **Your Points:** 0 points - Start playing to join the leaderboard!"
            else:
                user_rank_text = f"\n📍 **Your Points:** 0 points - Start playing to join the leaderboard!"

            leaderboard_text += user_rank_text
            leaderboard_text += f"\n\n🔄 **Updated:** Just now"

        else:
            leaderboard_text = """🏆 **Global Leaderboard**

📊 No players have earned points yet.
Be the first to play a quiz and claim the top spot!

💡 **How to earn points:**
• Answer quiz questions correctly (+5 points)
• Be first to answer in timed quizzes (+3 bonus)
• Create quizzes that others play (+2 per player)"""

        # Edit the loading message with results
        await loading_msg.edit_text(
            leaderboard_text,
            parse_mode="Markdown"
        )

        # Send leaderboard keyboard
        await update.message.reply_text(
            "🏆 **Leaderboard Options:**",
            reply_markup=create_leaderboards_keyboard()
        )

    except Exception as e:
        logger.error(f"Error in global leaderboard handler: {e}")
        await update.message.reply_text(
            "❌ Error loading global leaderboard. Please try again.",
            reply_markup=create_leaderboards_keyboard(),
        )


async def handle_group_leaderboard(update: Update, context: CallbackContext) -> None:
    """Handle 'Group Leaderboard' button press"""
    try:
        from services.point_service import PointService

        # Get leaderboard data (using total leaderboard for now - can be enhanced for group-specific later)
        leaderboard_data = await PointService.get_leaderboard(limit=10, leaderboard_type="total")

        if leaderboard_data:
            leaderboard_text = "👥 **Group Leaderboard**\n\n"

            # Show top players (simplified for group - can be enhanced to filter by actual group)
            for entry in leaderboard_data[:5]:  # Show top 5 for group
                rank = entry['rank']
                username = entry['username']
                total_points = entry['total_points']

                if rank == 1:
                    emoji = "🥇"
                elif rank == 2:
                    emoji = "🥈"
                elif rank == 3:
                    emoji = "🥉"
                else:
                    emoji = f"{rank}."

                leaderboard_text += f"{emoji} **#{rank}** - {username} ({total_points:,} points)\n"

            leaderboard_text += "\n💡 **Note:** Currently showing global rankings. Group-specific rankings coming soon!"

        else:
            leaderboard_text = """👥 **Group Leaderboard**

📊 No group activity yet.
Invite friends to play quizzes together!

💡 **Group features coming soon:**
• Group-specific rankings
• Team challenges
• Group competitions"""

        await update.message.reply_text(
            leaderboard_text,
            reply_markup=create_leaderboards_keyboard(),
            parse_mode="Markdown",
        )

    except Exception as e:
        logger.error(f"Error in group leaderboard handler: {e}")
        await update.message.reply_text(
            "❌ Error loading group leaderboard. Please try again.",
            reply_markup=create_leaderboards_keyboard()
        )


async def handle_weekly_top(update: Update, context: CallbackContext) -> None:
    """Handle 'Weekly Top' button press"""
    try:
        from services.point_service import PointService

        # Get leaderboard data for quiz creators (weekly focus)
        leaderboard_data = await PointService.get_leaderboard(limit=10, leaderboard_type="creator")

        if leaderboard_data:
            leaderboard_text = "📊 **Weekly Top Performers** ⭐\n\n"
            leaderboard_text += "🎯 **Quiz Creators This Week:**\n"

            for entry in leaderboard_data[:5]:  # Show top 5 creators
                rank = entry['rank']
                username = entry['username']
                creator_points = entry['quiz_creator_points']
                quizzes_created = entry['total_quizzes_created']

                if rank <= 3:
                    if rank == 1:
                        emoji = "🥇"
                    elif rank == 2:
                        emoji = "🥈"
                    else:
                        emoji = "🥉"
                else:
                    emoji = f"{rank}."

                leaderboard_text += f"{emoji} **{username}** - {creator_points} creator points ({quizzes_created} quizzes)\n"

            leaderboard_text += "\n💡 **Note:** Showing top quiz creators by creator points earned"
            leaderboard_text += "\n⏰ **Updated:** Real-time data"

        else:
            leaderboard_text = """📊 **Weekly Top Performers**

🎯 No quiz creators this week yet.
Be the first to create a quiz and earn creator points!

💡 **Creator points:**
• +2 points for each unique player
• +1 point for each correct answer"""

        await update.message.reply_text(
            leaderboard_text,
            reply_markup=create_leaderboards_keyboard(),
            parse_mode="Markdown",
        )

    except Exception as e:
        logger.error(f"Error in weekly top handler: {e}")
        await update.message.reply_text(
            "❌ Error loading weekly top performers. Please try again.",
            reply_markup=create_leaderboards_keyboard()
        )


async def handle_all_time_best(update: Update, context: CallbackContext) -> None:
    """Handle 'All Time Best' button press"""
    try:
        from services.point_service import PointService

        # Get leaderboard data for quiz takers (all-time focus)
        leaderboard_data = await PointService.get_leaderboard(limit=10, leaderboard_type="taker")

        if leaderboard_data:
            leaderboard_text = "🎖️ **All Time Best Players** 🏆\n\n"
            leaderboard_text += "🧠 **Quiz Masters (By Quiz Performance):**\n"

            for entry in leaderboard_data[:5]:  # Show top 5 takers
                rank = entry['rank']
                username = entry['username']
                taker_points = entry['quiz_taker_points']
                correct_answers = entry['total_correct_answers']
                quizzes_taken = entry['total_quizzes_taken']

                if rank <= 3:
                    if rank == 1:
                        emoji = "🥇"
                    elif rank == 2:
                        emoji = "🥈"
                    else:
                        emoji = "🥉"
                else:
                    emoji = f"{rank}."

                accuracy = (correct_answers / max(quizzes_taken, 1) * 100) if quizzes_taken > 0 else 0
                leaderboard_text += f"{emoji} **{username}** - {taker_points} quiz points\n"
                leaderboard_text += f"   📊 {correct_answers} correct answers, {accuracy:.1f}% accuracy\n"

            leaderboard_text += "\n🏆 **Hall of Fame** - Greatest quiz performers of all time!"

        else:
            leaderboard_text = """🎖️ **All Time Best**

🏆 No quiz champions yet.
Be the first to earn your place in the Hall of Fame!

💡 **How to become a legend:**
• Answer quiz questions correctly
• Build up your accuracy percentage
• Compete in multiple quizzes"""

        await update.message.reply_text(
            leaderboard_text,
            reply_markup=create_leaderboards_keyboard(),
            parse_mode="Markdown",
        )

    except Exception as e:
        logger.error(f"Error in all time best handler: {e}")
        await update.message.reply_text(
            "❌ Error loading all-time best players. Please try again.",
            reply_markup=create_leaderboards_keyboard()
        )


# Callback handlers for wallet export functionality
async def handle_export_confirmation_callback(
    update: Update, context: CallbackContext
) -> None:
    """Handle export key confirmation callbacks"""
    query = update.callback_query
    user_id = update.effective_user.id
    callback_data = query.data

    await query.answer()

    if callback_data == "export_cancel":
        # User cancelled export
        await query.edit_message_text(
            "🔐 **Export Cancelled**\n\nYour private key remains secure. You can export it anytime from the wallet menu.",
            reply_markup=None,
        )
        # Send wallet menu
        await context.bot.send_message(
            chat_id=update.effective_chat.id,
            text="💰 **My Wallet**\nChoose an option to manage your wallet:",
            reply_markup=create_wallet_keyboard(),
        )

    elif callback_data.startswith("export_confirm:"):
        # User confirmed export - show the actual keys
        try:
            wallet_service = WalletService()
            wallet_data = await wallet_service.get_user_wallet(user_id)

            if wallet_data:
                account_id = wallet_data.get("account_id", "N/A")
                network = wallet_data.get("network", "mainnet")

                # Get encrypted private key data
                encrypted_private_key = wallet_data.get("encrypted_private_key")
                iv = wallet_data.get("iv")
                tag = wallet_data.get("tag")

                if encrypted_private_key and iv and tag:
                    # Import and use NEARWalletService to decrypt the private key
                    from services.near_wallet_service import NEARWalletService

                    near_service = NEARWalletService()

                    try:
                        # Decrypt the private key
                        private_key = near_service.decrypt_private_key(
                            encrypted_private_key, iv, tag
                        )

                        export_text = f"""🔑 **Private Key Exported**

⚠️ **KEEP THIS SECRET AND SECURE!**

📍 **Account ID:** `{account_id}`
🌐 **Network:** {network.title()}

🔐 **Private Key:**
```
{private_key}
```

💡 **Import Instructions:**
1. Open any NEAR wallet app
2. Choose "Import Account"
3. Enter your Account ID and Private Key
4. You'll have full access to your wallet

⚠️ **Security Reminder:**
• Save this key offline immediately
• Delete this message after saving
• Never share with anyone"""

                    except Exception as decrypt_error:
                        logger.error(
                            f"Error decrypting private key for user {user_id}: {decrypt_error}"
                        )
                        export_text = f"""❌ **Error Decrypting Private Key**

Unable to decrypt your private key at this time.

📍 **Account ID:** `{account_id}`
🌐 **Network:** {network.title()}

Please try again later or contact support if the issue persists."""
                else:
                    export_text = f"""❌ **Incomplete Wallet Data**

Your wallet data is missing encryption information.

📍 **Account ID:** `{account_id}`
🌐 **Network:** {network.title()}

Please contact support to resolve this issue."""

                await query.edit_message_text(
                    export_text, parse_mode="Markdown", reply_markup=None
                )

                # Send wallet menu back
                await context.bot.send_message(
                    chat_id=update.effective_chat.id,
                    text="💰 **My Wallet**\nChoose an option to manage your wallet:",
                    reply_markup=create_wallet_keyboard(),
                )
            else:
                await query.edit_message_text(
                    "❌ Unable to retrieve wallet keys. Please try again.",
                    reply_markup=None,
                )

        except Exception as e:
            logger.error(f"Error exporting keys for user {user_id}: {e}")
            await query.edit_message_text(
                "❌ Error exporting keys. Please try again later.", reply_markup=None
            )
