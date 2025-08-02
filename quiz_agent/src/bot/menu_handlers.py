from telegram import Update, InlineKeyboardMarkup, ReplyKeyboardMarkup
from telegram.ext import CallbackContext
from .keyboard_markups import (
    create_main_menu_keyboard,
    create_game_selection_keyboard,
    create_challenge_keyboard,
    create_community_keyboard,
    create_app_keyboard,
    create_quiz_creation_keyboard,
    create_cancel_keyboard,
    remove_keyboard
)
from utils.redis_client import RedisClient
import logging

logger = logging.getLogger(__name__)

async def show_main_menu(update: Update, context: CallbackContext) -> None:
    """
    Shows the main menu with the 2x2 grid of buttons directly below the keyboard input.
    This is the primary interface users will see using ReplyKeyboardMarkup.
    """
    user_id = update.effective_user.id
    user_name = update.effective_user.first_name
    
    welcome_text = f"🎉 Welcome to SolviumAI, {user_name}!\n\nWhat would you like to do today?"
    
    # Store user state in Redis
    redis_client = RedisClient()
    await redis_client.set_user_data_key(user_id, "current_menu", "main")
    
    # Send message with reply keyboard that appears directly below the input field
    await update.message.reply_text(
        welcome_text,
        reply_markup=create_main_menu_keyboard()
    )

async def handle_text_message(update: Update, context: CallbackContext) -> None:
    """
    Handles text messages that correspond to ReplyKeyboardMarkup button presses.
    This replaces the callback query handling for ReplyKeyboardMarkup.
    """
    user_id = update.effective_user.id
    message_text = update.message.text
    
    logger.info(f"Text message from user {user_id}: {message_text}")
    
    # Parse the button text and route to appropriate handler
    if message_text == "🎮 Pick a game!":
        await handle_pick_game(update, context)
    elif message_text == "💪 Challenge friends":
        await handle_challenge_friends(update, context)
    elif message_text == "🤝 Join community":
        await handle_join_community(update, context)
    elif message_text == "📱 Get our cash winning app":
        await handle_get_app(update, context)
    elif message_text == "⬅️ Back to Main Menu":
        await show_main_menu(update, context)
    elif message_text == "⬅️ Back to Games":
        await handle_pick_game(update, context)
    # Game selection handlers
    elif message_text == "🎯 Create Quiz":
        await handle_create_quiz(update, context)
    elif message_text == "🎲 Play Quiz":
        await handle_play_quiz(update, context)
    elif message_text == "🏆 Leaderboards":
        await handle_leaderboards(update, context)
    elif message_text == "💰 Winners":
        await handle_winners(update, context)
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
    # Navigation handlers
    elif message_text == "❌ Cancel":
        await show_main_menu(update, context)
    elif message_text == "⬅️ Back":
        await handle_back_navigation(update, context)
    else:
        # Handle unknown text - could be a regular message
        await handle_unknown_message(update, context)

async def handle_pick_game(update: Update, context: CallbackContext) -> None:
    """Handle 'Pick a game!' button press"""
    user_id = update.effective_user.id
    redis_client = RedisClient()
    
    await update.message.reply_text(
        "🎮 Choose your game:",
        reply_markup=create_game_selection_keyboard()
    )
    await redis_client.set_user_data_key(user_id, "current_menu", "games")

async def handle_challenge_friends(update: Update, context: CallbackContext) -> None:
    """Handle 'Challenge friends' button press"""
    user_id = update.effective_user.id
    redis_client = RedisClient()
    
    await update.message.reply_text(
        "💪 Challenge your friends:",
        reply_markup=create_challenge_keyboard()
    )
    await redis_client.set_user_data_key(user_id, "current_menu", "challenge")

async def handle_join_community(update: Update, context: CallbackContext) -> None:
    """Handle 'Join community' button press"""
    user_id = update.effective_user.id
    redis_client = RedisClient()
    
    await update.message.reply_text(
        "🤝 Join our community:",
        reply_markup=create_community_keyboard()
    )
    await redis_client.set_user_data_key(user_id, "current_menu", "community")

async def handle_get_app(update: Update, context: CallbackContext) -> None:
    """Handle 'Get our cash winning app' button press"""
    user_id = update.effective_user.id
    redis_client = RedisClient()
    
    await update.message.reply_text(
        "📱 Get our cash winning app:",
        reply_markup=create_app_keyboard()
    )
    await redis_client.set_user_data_key(user_id, "current_menu", "app")

async def handle_create_quiz(update: Update, context: CallbackContext) -> None:
    """Handle 'Create Quiz' button press"""
    await update.message.reply_text(
        "📝 Create a new quiz:",
        reply_markup=create_quiz_creation_keyboard()
    )

async def handle_play_quiz(update: Update, context: CallbackContext) -> None:
    """Handle 'Play Quiz' button press"""
    await update.message.reply_text("🎲 Loading available quizzes...")
    # Import and call the existing play_quiz function
    from services.quiz_service import play_quiz
    context.args = []  # Reset args for play_quiz
    await play_quiz(update, context)

async def handle_leaderboards(update: Update, context: CallbackContext) -> None:
    """Handle 'Leaderboards' button press"""
    await update.message.reply_text("🏆 Loading leaderboards...")
    # Import and call the existing leaderboards function
    from bot.handlers import show_all_active_leaderboards_command
    await show_all_active_leaderboards_command(update, context)

async def handle_winners(update: Update, context: CallbackContext) -> None:
    """Handle 'Winners' button press"""
    await update.message.reply_text("💰 Loading winners...")
    # Import and call the existing winners function
    from bot.handlers import winners_handler
    await winners_handler(update, context)

async def handle_challenge_group(update: Update, context: CallbackContext) -> None:
    """Handle 'Challenge Group' button press"""
    await update.message.reply_text(
        "👥 Group challenges coming soon!\n\nThis feature will allow you to challenge entire groups to compete in quizzes.",
        reply_markup=create_cancel_keyboard()
    )

async def handle_challenge_friend(update: Update, context: CallbackContext) -> None:
    """Handle 'Challenge Friend' button press"""
    await update.message.reply_text(
        "👤 Friend challenges coming soon!\n\nThis feature will allow you to challenge individual friends to quiz battles.",
        reply_markup=create_cancel_keyboard()
    )

async def handle_my_challenges(update: Update, context: CallbackContext) -> None:
    """Handle 'My Challenges' button press"""
    await update.message.reply_text(
        "🏅 Your challenge history:\n\nNo active challenges found.",
        reply_markup=create_cancel_keyboard()
    )

async def handle_challenge_stats(update: Update, context: CallbackContext) -> None:
    """Handle 'Challenge Stats' button press"""
    await update.message.reply_text(
        "📊 Your challenge statistics:\n\n• Total Challenges: 0\n• Wins: 0\n• Losses: 0\n• Win Rate: 0%",
        reply_markup=create_cancel_keyboard()
    )

async def handle_join_announcements(update: Update, context: CallbackContext) -> None:
    """Handle 'Join Announcements' button press"""
    await update.message.reply_text(
        "📢 Join our announcements channel:\nhttps://t.me/solvium_announcements",
        reply_markup=create_cancel_keyboard()
    )

async def handle_join_discussion(update: Update, context: CallbackContext) -> None:
    """Handle 'Join Discussion' button press"""
    await update.message.reply_text(
        "💬 Join our discussion group:\nhttps://t.me/solvium_community",
        reply_markup=create_cancel_keyboard()
    )

async def handle_join_gaming(update: Update, context: CallbackContext) -> None:
    """Handle 'Join Gaming' button press"""
    await update.message.reply_text(
        "🎮 Join our gaming group:\nhttps://t.me/solvium_gaming",
        reply_markup=create_cancel_keyboard()
    )

async def handle_join_trading(update: Update, context: CallbackContext) -> None:
    """Handle 'Join Trading' button press"""
    await update.message.reply_text(
        "📈 Join our trading group:\nhttps://t.me/solvium_trading",
        reply_markup=create_cancel_keyboard()
    )

async def handle_open_web_app(update: Update, context: CallbackContext) -> None:
    """Handle 'Open Web App' button press"""
    await update.message.reply_text(
        "🌐 Opening web app...\nhttps://solvium.ai",
        reply_markup=create_cancel_keyboard()
    )

async def handle_download_mobile(update: Update, context: CallbackContext) -> None:
    """Handle 'Download Mobile' button press"""
    await update.message.reply_text(
        "📱 Download our mobile app:\nhttps://play.google.com/store/apps/solvium",
        reply_markup=create_cancel_keyboard()
    )

async def handle_connect_wallet(update: Update, context: CallbackContext) -> None:
    """Handle 'Connect Wallet' button press"""
    await update.message.reply_text("💳 Connecting wallet...")
    from bot.handlers import link_wallet_handler
    await link_wallet_handler(update, context)

async def handle_view_rewards(update: Update, context: CallbackContext) -> None:
    """Handle 'View Rewards' button press"""
    await update.message.reply_text(
        "💰 Your rewards:\n\n• Available Balance: 0 SOLV\n• Pending Rewards: 0 SOLV\n• Total Earned: 0 SOLV",
        reply_markup=create_cancel_keyboard()
    )

async def handle_quick_quiz(update: Update, context: CallbackContext) -> None:
    """Handle 'Quick Quiz' button press"""
    await update.message.reply_text("📝 Quick quiz creation...")
    from bot.handlers import start_createquiz_group
    await start_createquiz_group(update, context)

async def handle_custom_quiz(update: Update, context: CallbackContext) -> None:
    """Handle 'Custom Quiz' button press"""
    await update.message.reply_text("⚙️ Custom quiz creation...")
    from bot.handlers import start_createquiz_group
    await start_createquiz_group(update, context)

async def handle_quiz_templates(update: Update, context: CallbackContext) -> None:
    """Handle 'Quiz Templates' button press"""
    await update.message.reply_text(
        "📊 Quiz templates:\n\n• General Knowledge\n• Science & Technology\n• History\n• Sports\n• Entertainment",
        reply_markup=create_cancel_keyboard()
    )

async def handle_my_quizzes(update: Update, context: CallbackContext) -> None:
    """Handle 'My Quizzes' button press"""
    await update.message.reply_text(
        "📈 Your quizzes:\n\nNo quizzes created yet. Create your first quiz!",
        reply_markup=create_cancel_keyboard()
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

async def handle_unknown_message(update: Update, context: CallbackContext) -> None:
    """Handle unknown text messages"""
    await update.message.reply_text(
        "I didn't understand that. Please use the buttons below to navigate.",
        reply_markup=create_main_menu_keyboard()
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

async def handle_main_menu_callback(update: Update, context: CallbackContext, callback_data: str) -> None:
    """
    Handles main menu button clicks for InlineKeyboardMarkup
    """
    query = update.callback_query
    user_id = update.effective_user.id
    redis_client = RedisClient()
    
    if callback_data == "menu:main":
        # Show main menu
        welcome_text = f"🎉 Welcome to SolviumAI!\n\nWhat would you like to do today?"
        await query.edit_message_text(
            welcome_text,
            reply_markup=create_inline_main_menu_keyboard()
        )
        await redis_client.set_user_data_key(user_id, "current_menu", "main")
        
    elif callback_data == "menu:pick_game":
        # Show game selection menu
        await query.edit_message_text(
            "🎮 Choose your game:",
            reply_markup=create_inline_game_selection_keyboard()
        )
        await redis_client.set_user_data_key(user_id, "current_menu", "games")
        
    elif callback_data == "menu:challenge_friends":
        # Show challenge menu
        await query.edit_message_text(
            "💪 Challenge your friends:",
            reply_markup=create_inline_challenge_keyboard()
        )
        await redis_client.set_user_data_key(user_id, "current_menu", "challenge")
        
    elif callback_data == "menu:join_community":
        # Show community menu
        await query.edit_message_text(
            "🤝 Join our community:",
            reply_markup=create_inline_community_keyboard()
        )
        await redis_client.set_user_data_key(user_id, "current_menu", "community")
        
    elif callback_data == "menu:get_app":
        # Show app menu
        await query.edit_message_text(
            "📱 Get our cash winning app:",
            reply_markup=create_inline_app_keyboard()
        )
        await redis_client.set_user_data_key(user_id, "current_menu", "app")

async def handle_game_callback(update: Update, context: CallbackContext, callback_data: str) -> None:
    """
    Handles game-related button clicks for InlineKeyboardMarkup
    """
    query = update.callback_query
    user_id = update.effective_user.id
    
    if callback_data == "game:create_quiz":
        # Show quiz creation options
        await query.edit_message_text(
            "📝 Create a new quiz:",
            reply_markup=create_inline_quiz_creation_keyboard()
        )
        
    elif callback_data == "game:play_quiz":
        # Trigger the existing play quiz functionality
        await query.edit_message_text("🎲 Loading available quizzes...")
        # Import and call the existing play_quiz function
        from services.quiz_service import play_quiz
        context.args = []  # Reset args for play_quiz
        await play_quiz(update, context)
        
    elif callback_data == "game:leaderboards":
        # Show leaderboards
        await query.edit_message_text("🏆 Loading leaderboards...")
        # Import and call the existing leaderboards function
        from bot.handlers import show_all_active_leaderboards_command
        await show_all_active_leaderboards_command(update, context)
        
    elif callback_data == "game:winners":
        # Show winners
        await query.edit_message_text("💰 Loading winners...")
        # Import and call the existing winners function
        from bot.handlers import winners_handler
        await winners_handler(update, context)

async def handle_challenge_callback(update: Update, context: CallbackContext, callback_data: str) -> None:
    """
    Handles challenge-related button clicks for InlineKeyboardMarkup
    """
    query = update.callback_query
    
    if callback_data == "challenge:group":
        await query.edit_message_text(
            "👥 Group challenges coming soon!\n\nThis feature will allow you to challenge entire groups to compete in quizzes.",
            reply_markup=create_inline_cancel_keyboard()
        )
        
    elif callback_data == "challenge:friend":
        await query.edit_message_text(
            "👤 Friend challenges coming soon!\n\nThis feature will allow you to challenge individual friends to quiz battles.",
            reply_markup=create_inline_cancel_keyboard()
        )
        
    elif callback_data == "challenge:my_challenges":
        await query.edit_message_text(
            "🏅 Your challenge history:\n\nNo active challenges found.",
            reply_markup=create_inline_cancel_keyboard()
        )
        
    elif callback_data == "challenge:stats":
        await query.edit_message_text(
            "📊 Your challenge statistics:\n\n• Total Challenges: 0\n• Wins: 0\n• Losses: 0\n• Win Rate: 0%",
            reply_markup=create_inline_cancel_keyboard()
        )

async def handle_app_callback(update: Update, context: CallbackContext, callback_data: str) -> None:
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
            "💰 Your rewards:\n\n• Available Balance: 0 SOLV\n• Pending Rewards: 0 SOLV\n• Total Earned: 0 SOLV",
            reply_markup=create_inline_cancel_keyboard()
        )

async def handle_quiz_callback(update: Update, context: CallbackContext, callback_data: str) -> None:
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
            "📊 Quiz templates:\n\n• General Knowledge\n• Science & Technology\n• History\n• Sports\n• Entertainment",
            reply_markup=create_inline_cancel_keyboard()
        )
        
    elif callback_data == "quiz:my_quizzes":
        await query.edit_message_text(
            "📈 Your quizzes:\n\nNo quizzes created yet. Create your first quiz!",
            reply_markup=create_inline_cancel_keyboard()
        )

async def handle_navigation_callback(update: Update, context: CallbackContext, callback_data: str) -> None:
    """
    Handles navigation buttons (back, cancel) for InlineKeyboardMarkup
    """
    query = update.callback_query
    user_id = update.effective_user.id
    redis_client = RedisClient()
    
    if callback_data == "cancel":
        # Go back to main menu
        await query.edit_message_text(
            "🎉 Welcome to SolviumAI!\n\nWhat would you like to do today?",
            reply_markup=create_inline_main_menu_keyboard()
        )
        await redis_client.set_user_data_key(user_id, "current_menu", "main")
        
    elif callback_data == "back":
        # Get current menu state and go back one level
        current_menu = await redis_client.get_user_data_key(user_id, "current_menu")
        
        if current_menu == "games":
            await query.edit_message_text(
                "🎉 Welcome to SolviumAI!\n\nWhat would you like to do today?",
                reply_markup=create_inline_main_menu_keyboard()
            )
            await redis_client.set_user_data_key(user_id, "current_menu", "main")
        else:
            # Default back to main menu
            await query.edit_message_text(
                "🎉 Welcome to SolviumAI!\n\nWhat would you like to do today?",
                reply_markup=create_inline_main_menu_keyboard()
            )
            await redis_client.set_user_data_key(user_id, "current_menu", "main")

async def show_menu_in_group(update: Update, context: CallbackContext) -> None:
    """
    Shows the main menu in group chats with a note about DM functionality
    """
    user_name = update.effective_user.first_name
    
    await update.message.reply_text(
        f"🎉 Hi {user_name}! I'm SolviumAI bot.\n\n"
        "For the best experience, please DM me to access all features!",
        reply_markup=create_main_menu_keyboard()
    ) 