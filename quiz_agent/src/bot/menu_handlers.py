from telegram import Update, InlineKeyboardMarkup
from telegram.ext import CallbackContext
from .keyboard_markups import (
    create_main_menu_keyboard,
    create_game_selection_keyboard,
    create_challenge_keyboard,
    create_community_keyboard,
    create_app_keyboard,
    create_quiz_creation_keyboard,
    create_cancel_keyboard
)
from utils.redis_client import RedisClient
import logging

logger = logging.getLogger(__name__)

async def show_main_menu(update: Update, context: CallbackContext) -> None:
    """
    Shows the main menu with the 2x2 grid of buttons directly below the keyboard input.
    This is the primary interface users will see.
    """
    user_id = update.effective_user.id
    user_name = update.effective_user.first_name
    
    welcome_text = f"🎉 Welcome to SolviumAI, {user_name}!\n\nWhat would you like to do today?"
    
    # Store user state in Redis
    redis_client = RedisClient()
    await redis_client.set_user_data_key(user_id, "current_menu", "main")
    
    # Send message with inline keyboard that appears directly below the input field
    await update.message.reply_text(
        welcome_text,
        reply_markup=create_main_menu_keyboard()
    )

async def handle_menu_callback(update: Update, context: CallbackContext) -> None:
    """
    Handles all menu-related callback queries from the inline keyboards.
    This is the main router for menu navigation.
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
    Handles main menu button clicks
    """
    query = update.callback_query
    user_id = update.effective_user.id
    redis_client = RedisClient()
    
    if callback_data == "menu:main":
        # Show main menu
        welcome_text = f"🎉 Welcome to SolviumAI!\n\nWhat would you like to do today?"
        await query.edit_message_text(
            welcome_text,
            reply_markup=create_main_menu_keyboard()
        )
        await redis_client.set_user_data_key(user_id, "current_menu", "main")
        
    elif callback_data == "menu:pick_game":
        # Show game selection menu
        await query.edit_message_text(
            "🎮 Choose your game:",
            reply_markup=create_game_selection_keyboard()
        )
        await redis_client.set_user_data_key(user_id, "current_menu", "games")
        
    elif callback_data == "menu:challenge_friends":
        # Show challenge menu
        await query.edit_message_text(
            "💪 Challenge your friends:",
            reply_markup=create_challenge_keyboard()
        )
        await redis_client.set_user_data_key(user_id, "current_menu", "challenge")
        
    elif callback_data == "menu:join_community":
        # Show community menu
        await query.edit_message_text(
            "🤝 Join our community:",
            reply_markup=create_community_keyboard()
        )
        await redis_client.set_user_data_key(user_id, "current_menu", "community")
        
    elif callback_data == "menu:get_app":
        # Show app menu
        await query.edit_message_text(
            "📱 Get our cash winning app:",
            reply_markup=create_app_keyboard()
        )
        await redis_client.set_user_data_key(user_id, "current_menu", "app")

async def handle_game_callback(update: Update, context: CallbackContext, callback_data: str) -> None:
    """
    Handles game-related button clicks
    """
    query = update.callback_query
    user_id = update.effective_user.id
    
    if callback_data == "game:create_quiz":
        # Show quiz creation options
        await query.edit_message_text(
            "📝 Create a new quiz:",
            reply_markup=create_quiz_creation_keyboard()
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
    Handles challenge-related button clicks
    """
    query = update.callback_query
    
    if callback_data == "challenge:group":
        await query.edit_message_text(
            "👥 Group challenges coming soon!\n\nThis feature will allow you to challenge entire groups to compete in quizzes.",
            reply_markup=create_cancel_keyboard()
        )
        
    elif callback_data == "challenge:friend":
        await query.edit_message_text(
            "👤 Friend challenges coming soon!\n\nThis feature will allow you to challenge individual friends to quiz battles.",
            reply_markup=create_cancel_keyboard()
        )
        
    elif callback_data == "challenge:my_challenges":
        await query.edit_message_text(
            "🏅 Your challenge history:\n\nNo active challenges found.",
            reply_markup=create_cancel_keyboard()
        )
        
    elif callback_data == "challenge:stats":
        await query.edit_message_text(
            "📊 Your challenge statistics:\n\n• Total Challenges: 0\n• Wins: 0\n• Losses: 0\n• Win Rate: 0%",
            reply_markup=create_cancel_keyboard()
        )

async def handle_app_callback(update: Update, context: CallbackContext, callback_data: str) -> None:
    """
    Handles app-related button clicks
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
            reply_markup=create_cancel_keyboard()
        )

async def handle_quiz_callback(update: Update, context: CallbackContext, callback_data: str) -> None:
    """
    Handles quiz-related button clicks
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
            reply_markup=create_cancel_keyboard()
        )
        
    elif callback_data == "quiz:my_quizzes":
        await query.edit_message_text(
            "📈 Your quizzes:\n\nNo quizzes created yet. Create your first quiz!",
            reply_markup=create_cancel_keyboard()
        )

async def handle_navigation_callback(update: Update, context: CallbackContext, callback_data: str) -> None:
    """
    Handles navigation buttons (back, cancel)
    """
    query = update.callback_query
    user_id = update.effective_user.id
    redis_client = RedisClient()
    
    if callback_data == "cancel":
        # Go back to main menu
        await query.edit_message_text(
            "🎉 Welcome to SolviumAI!\n\nWhat would you like to do today?",
            reply_markup=create_main_menu_keyboard()
        )
        await redis_client.set_user_data_key(user_id, "current_menu", "main")
        
    elif callback_data == "back":
        # Get current menu state and go back one level
        current_menu = await redis_client.get_user_data_key(user_id, "current_menu")
        
        if current_menu == "games":
            await query.edit_message_text(
                "🎉 Welcome to SolviumAI!\n\nWhat would you like to do today?",
                reply_markup=create_main_menu_keyboard()
            )
            await redis_client.set_user_data_key(user_id, "current_menu", "main")
        else:
            # Default back to main menu
            await query.edit_message_text(
                "🎉 Welcome to SolviumAI!\n\nWhat would you like to do today?",
                reply_markup=create_main_menu_keyboard()
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