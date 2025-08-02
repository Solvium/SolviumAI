from telegram import InlineKeyboardMarkup, InlineKeyboardButton
from typing import List, Optional

def create_main_menu_keyboard() -> InlineKeyboardMarkup:
    """
    Creates the main 2x2 grid menu that appears directly below the keyboard input.
    This mimics the interface shown in the reference image.
    """
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton(
                "🎮 Pick a game!", 
                callback_data="menu:pick_game"
            ),
            InlineKeyboardButton(
                "💪 Challenge friends", 
                callback_data="menu:challenge_friends"
            )
        ],
        [
            InlineKeyboardButton(
                "🤝 Join community", 
                callback_data="menu:join_community"
            ),
            InlineKeyboardButton(
                "📱 Get our cash winning app", 
                callback_data="menu:get_app"
            )
        ]
    ])

def create_game_selection_keyboard() -> InlineKeyboardMarkup:
    """
    Creates a keyboard for game selection when user clicks "Pick a game!"
    """
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton(
                "🎯 Create Quiz", 
                callback_data="game:create_quiz"
            ),
            InlineKeyboardButton(
                "🎲 Play Quiz", 
                callback_data="game:play_quiz"
            )
        ],
        [
            InlineKeyboardButton(
                "🏆 Leaderboards", 
                callback_data="game:leaderboards"
            ),
            InlineKeyboardButton(
                "💰 Winners", 
                callback_data="game:winners"
            )
        ],
        [
            InlineKeyboardButton(
                "⬅️ Back to Main Menu", 
                callback_data="menu:main"
            )
        ]
    ])

def create_challenge_keyboard() -> InlineKeyboardMarkup:
    """
    Creates a keyboard for challenge features
    """
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton(
                "👥 Challenge Group", 
                callback_data="challenge:group"
            ),
            InlineKeyboardButton(
                "👤 Challenge Friend", 
                callback_data="challenge:friend"
            )
        ],
        [
            InlineKeyboardButton(
                "🏅 My Challenges", 
                callback_data="challenge:my_challenges"
            ),
            InlineKeyboardButton(
                "📊 Challenge Stats", 
                callback_data="challenge:stats"
            )
        ],
        [
            InlineKeyboardButton(
                "⬅️ Back to Main Menu", 
                callback_data="menu:main"
            )
        ]
    ])

def create_community_keyboard() -> InlineKeyboardMarkup:
    """
    Creates a keyboard for community features
    """
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton(
                "📢 Join Announcements", 
                url="https://t.me/solvium_announcements"
            ),
            InlineKeyboardButton(
                "💬 Join Discussion", 
                url="https://t.me/solvium_community"
            )
        ],
        [
            InlineKeyboardButton(
                "🎮 Join Gaming", 
                url="https://t.me/solvium_gaming"
            ),
            InlineKeyboardButton(
                "📈 Join Trading", 
                url="https://t.me/solvium_trading"
            )
        ],
        [
            InlineKeyboardButton(
                "⬅️ Back to Main Menu", 
                callback_data="menu:main"
            )
        ]
    ])

def create_app_keyboard() -> InlineKeyboardMarkup:
    """
    Creates a keyboard for app download/access
    """
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton(
                "🌐 Open Web App", 
                web_app={"url": "https://solvium.ai"}
            ),
            InlineKeyboardButton(
                "📱 Download Mobile", 
                url="https://play.google.com/store/apps/solvium"
            )
        ],
        [
            InlineKeyboardButton(
                "💳 Connect Wallet", 
                callback_data="app:connect_wallet"
            ),
            InlineKeyboardButton(
                "💰 View Rewards", 
                callback_data="app:rewards"
            )
        ],
        [
            InlineKeyboardButton(
                "⬅️ Back to Main Menu", 
                callback_data="menu:main"
            )
        ]
    ])

def create_quiz_creation_keyboard() -> InlineKeyboardMarkup:
    """
    Creates a keyboard for quiz creation options
    """
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton(
                "📝 Quick Quiz", 
                callback_data="quiz:quick_create"
            ),
            InlineKeyboardButton(
                "⚙️ Custom Quiz", 
                callback_data="quiz:custom_create"
            )
        ],
        [
            InlineKeyboardButton(
                "📊 Quiz Templates", 
                callback_data="quiz:templates"
            ),
            InlineKeyboardButton(
                "📈 My Quizzes", 
                callback_data="quiz:my_quizzes"
            )
        ],
        [
            InlineKeyboardButton(
                "⬅️ Back to Games", 
                callback_data="menu:pick_game"
            )
        ]
    ])

def create_cancel_keyboard() -> InlineKeyboardMarkup:
    """
    Creates a simple cancel/back keyboard
    """
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton(
                "❌ Cancel", 
                callback_data="cancel"
            ),
            InlineKeyboardButton(
                "⬅️ Back", 
                callback_data="back"
            )
        ]
    ]) 