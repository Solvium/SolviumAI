from telegram import (
    Update,
    InlineKeyboardMarkup,
    InlineKeyboardButton,
    ReplyKeyboardMarkup,
)
from telegram.ext import CallbackContext
from .keyboard_markups import (
    create_main_menu_keyboard,
    create_game_selection_keyboard,
    create_quiz_creation_keyboard,
    create_quiz_templates_keyboard,
    create_quiz_settings_keyboard,
    create_quiz_play_keyboard,
    create_rewards_keyboard,
    create_leaderboards_keyboard,
    create_community_keyboard,
    create_app_keyboard,
    create_cancel_keyboard,
    remove_keyboard,
    create_inline_cancel_keyboard,
    create_inline_main_menu_keyboard,
    create_inline_game_selection_keyboard,
    create_inline_challenge_keyboard,
    create_inline_community_keyboard,
    create_inline_app_keyboard,
    create_inline_quiz_creation_keyboard,
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


    # Check if user has a wallet - if not, create one first
    wallet_service = WalletService()
    has_wallet = await wallet_service.has_wallet_robust(user_id)

    if not has_wallet:
        # Create wallet for first-time user
        await handle_first_time_wallet_creation(update, context)
        return

    # Parse the button text and route to appropriate handler
    if message_text == "🎯 Create Quiz":
        await handle_create_quiz(update, context)
    elif message_text == "🎲 Play Quiz":
        await handle_play_quiz(update, context)
    elif message_text == "🏆 Leaderboards":
        await handle_leaderboards(update, context)
    elif message_text == "💰 My Rewards":
        await handle_rewards(update, context)
    elif message_text == "🎯 My Points":
        await handle_my_points(update, context)
    elif message_text == "⬅️ Back to Main Menu":
        await show_main_menu(update, context)
    elif message_text == "⬅️ Back to Games":
        await handle_back_to_games(update, context)
    elif message_text == "⬅️ Back to Quiz Creation":
        await handle_create_quiz(update, context)
    # Challenge handlers
    elif message_text == "👥 Challenge Group":
        await handle_challenge_group(update, context)
    elif message_text == "👤 Challenge Friend":
        await handle_challenge_friend(update, context)
    elif message_text == "🏅 My Challenges":
        await handle_my_challenges(update, context)
    elif message_text == "📊 Challenge Stats":
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


async def handle_rewards(update: Update, context: CallbackContext) -> None:
    """Handle 'My Rewards' button press"""
    user_id = update.effective_user.id
    redis_client = RedisClient()

    await update.message.reply_text(
        "💰 Manage your rewards:", reply_markup=create_rewards_keyboard()
    )
    await redis_client.set_user_data_key(user_id, "current_menu", "rewards")


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


async def handle_back_to_games(update: Update, context: CallbackContext) -> None:
    """Handle 'Back to Games' button press"""
    await update.message.reply_text(
        "🎮 Game options:", reply_markup=create_game_selection_keyboard()
    )


async def handle_create_quiz(update: Update, context: CallbackContext) -> None:
    """Handle 'Create Quiz' button press"""
    await update.message.reply_text(
        "📝 Create a new quiz:", reply_markup=create_quiz_creation_keyboard()
    )


async def handle_play_quiz(update: Update, context: CallbackContext) -> None:
    """Handle 'Play Quiz' button press"""
    user_id = update.effective_user.id
    redis_client = RedisClient()

    await update.message.reply_text(
        "🎲 Play quizzes:", reply_markup=create_quiz_play_keyboard()
    )
    await redis_client.set_user_data_key(user_id, "current_menu", "quiz_play")


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


async def handle_global_leaderboard(update: Update, context: CallbackContext) -> None:
    """Handle 'Global Leaderboard' button press"""
    await update.message.reply_text(
        "🏆 Global Leaderboard:\n🥇 @user1 - 15,420 SOLV\n🥈 @user2 - 12,850 SOLV\n🥉 @user3 - 11,200 SOLV\n4. @user4 - 9,800 SOLV\n5. @user5 - 8,950 SOLV",
        reply_markup=create_cancel_keyboard(),
    )


async def handle_group_leaderboard(update: Update, context: CallbackContext) -> None:
    """Handle 'Group Leaderboard' button press"""
    await update.message.reply_text(
        "👥 Group Leaderboard:\n🥇 @user1 - 2,450 SOLV\n🥈 @user2 - 1,890 SOLV\n🥉 @user3 - 1,650 SOLV\n4. @user4 - 1,200 SOLV\n5. @user5 - 980 SOLV",
        reply_markup=create_cancel_keyboard(),
    )


async def handle_weekly_top(update: Update, context: CallbackContext) -> None:
    """Handle 'Weekly Top' button press"""
    await update.message.reply_text(
        "📊 Weekly Top Performers:\n🥇 @user1 - 850 SOLV\n🥈 @user2 - 720 SOLV\n🥉 @user3 - 680 SOLV\n4. @user4 - 550 SOLV\n5. @user5 - 480 SOLV",
        reply_markup=create_cancel_keyboard(),
    )


async def handle_all_time_best(update: Update, context: CallbackContext) -> None:
    """Handle 'All Time Best' button press"""
    await update.message.reply_text(
        "🎖️ All Time Best:\n🥇 @user1 - 25,420 SOLV\n🥈 @user2 - 22,850 SOLV\n🥉 @user3 - 21,200 SOLV\n4. @user4 - 19,800 SOLV\n5. @user5 - 18,950 SOLV",
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

    if callback_data == "game:create_quiz":
        await handle_create_quiz(update, context)
    elif callback_data == "game:play_quiz":
        await handle_play_quiz(update, context)
    elif callback_data == "game:leaderboards":
        await handle_leaderboards(update, context)
    elif callback_data == "game:rewards":
        await handle_rewards(update, context)
    elif callback_data == "game:my_points":
        await handle_my_points_inline(query, context)
    else:
        await query.edit_message_text("❌ Invalid game selection. Please try again.")


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

    elif callback_data == "menu:pick_game":
        # Show game selection menu
        await query.edit_message_text(
            "🎮 Choose your game:", reply_markup=create_inline_game_selection_keyboard()
        )
        await redis_client.set_user_data_key(user_id, "current_menu", "games")

    elif callback_data == "menu:challenge_friends":
        # Show challenge menu
        await query.edit_message_text(
            "💪 Challenge your friends:",
            reply_markup=create_inline_challenge_keyboard(),
        )
        await redis_client.set_user_data_key(user_id, "current_menu", "challenge")

    elif callback_data == "menu:join_community":
        # Show community menu
        await query.edit_message_text(
            "🤝 Join our community:", reply_markup=create_inline_community_keyboard()
        )
        await redis_client.set_user_data_key(user_id, "current_menu", "community")

    elif callback_data == "menu:get_app":
        # Show app menu
        await query.edit_message_text(
            "📱 Get our cash winning app:", reply_markup=create_inline_app_keyboard()
        )
        await redis_client.set_user_data_key(user_id, "current_menu", "app")

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
        reply_markup=create_main_menu_keyboard(),
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
