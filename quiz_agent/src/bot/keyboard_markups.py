from telegram import InlineKeyboardMarkup, InlineKeyboardButton, ReplyKeyboardMarkup, ReplyKeyboardRemove, KeyboardButton
from typing import List, Optional

def create_main_menu_keyboard() -> ReplyKeyboardMarkup:
    """
    Creates the main 2x2 grid menu that appears directly below the keyboard input.
    This mimics the interface shown in the reference image using ReplyKeyboardMarkup.
    """
    return ReplyKeyboardMarkup([
        [
            KeyboardButton("🎯 Create Quiz"),
            KeyboardButton("🎲 Play Quiz")
        ],
        [
            KeyboardButton("🏆 Leaderboards"),
            KeyboardButton("💰 My Rewards")
        ]
    ], 
    resize_keyboard=True,  # Makes buttons smaller to fit better
    one_time_keyboard=False,  # Keeps keyboard visible
    input_field_placeholder="Choose an option..."  # Placeholder in input field
    )

def create_game_selection_keyboard() -> ReplyKeyboardMarkup:
    """
    Creates a keyboard for game selection when user clicks "Pick a game!"
    """
    return ReplyKeyboardMarkup([
        [
            KeyboardButton("🎯 Create Quiz"),
            KeyboardButton("🎲 Play Quiz")
        ],
        [
            KeyboardButton("🏆 Leaderboards"),
            KeyboardButton("💰 My Rewards")
        ],
        [
            KeyboardButton("⬅️ Back to Main Menu")
        ]
    ],
    resize_keyboard=True,
    one_time_keyboard=False,
    input_field_placeholder="Select a game..."
    )

def create_quiz_creation_keyboard() -> ReplyKeyboardMarkup:
    """
    Creates a keyboard for quiz creation options
    """
    return ReplyKeyboardMarkup([
        [
            KeyboardButton("📝 Quick Quiz"),
            KeyboardButton("⚙️ Custom Quiz")
        ],
        [
            KeyboardButton("📊 Quiz Templates"),
            KeyboardButton("📈 My Quizzes")
        ],
        [
            KeyboardButton("⬅️ Back to Games")
        ]
    ],
    resize_keyboard=True,
    one_time_keyboard=False,
    input_field_placeholder="Quiz creation..."
    )

def create_quiz_templates_keyboard() -> ReplyKeyboardMarkup:
    """
    Creates a keyboard for quiz template selection
    """
    return ReplyKeyboardMarkup([
        [
            KeyboardButton("🧠 General Knowledge"),
            KeyboardButton("🔬 Science & Tech")
        ],
        [
            KeyboardButton("📚 History"),
            KeyboardButton("⚽ Sports")
        ],
        [
            KeyboardButton("🎬 Entertainment"),
            KeyboardButton("🌍 Geography")
        ],
        [
            KeyboardButton("⬅️ Back to Quiz Creation")
        ]
    ],
    resize_keyboard=True,
    one_time_keyboard=False,
    input_field_placeholder="Choose template..."
    )

def create_quiz_settings_keyboard() -> ReplyKeyboardMarkup:
    """
    Creates a keyboard for quiz settings
    """
    return ReplyKeyboardMarkup([
        [
            KeyboardButton("⏱️ Set Duration"),
            KeyboardButton("💰 Set Rewards")
        ],
        [
            KeyboardButton("👥 Public Quiz"),
            KeyboardButton("🔒 Private Quiz")
        ],
        [
            KeyboardButton("✅ Create Quiz"),
            KeyboardButton("❌ Cancel")
        ]
    ],
    resize_keyboard=True,
    one_time_keyboard=False,
    input_field_placeholder="Configure quiz..."
    )

def create_quiz_play_keyboard() -> ReplyKeyboardMarkup:
    """
    Creates a keyboard for quiz playing options
    """
    return ReplyKeyboardMarkup([
        [
            KeyboardButton("🎯 Active Quizzes"),
            KeyboardButton("🏆 My Results")
        ],
        [
            KeyboardButton("📊 Quiz History"),
            KeyboardButton("🎖️ Achievements")
        ],
        [
            KeyboardButton("⬅️ Back to Games")
        ]
    ],
    resize_keyboard=True,
    one_time_keyboard=False,
    input_field_placeholder="Play quizzes..."
    )

def create_rewards_keyboard() -> ReplyKeyboardMarkup:
    """
    Creates a keyboard for rewards and wallet management
    """
    return ReplyKeyboardMarkup([
        [
            KeyboardButton("💳 Connect Wallet"),
            KeyboardButton("💰 View Balance")
        ],
        [
            KeyboardButton("🏆 Claim Rewards"),
            KeyboardButton("📈 Transaction History")
        ],
        [
            KeyboardButton("⬅️ Back to Main Menu")
        ]
    ],
    resize_keyboard=True,
    one_time_keyboard=False,
    input_field_placeholder="Manage rewards..."
    )

def create_leaderboards_keyboard() -> ReplyKeyboardMarkup:
    """
    Creates a keyboard for leaderboard options
    """
    return ReplyKeyboardMarkup([
        [
            KeyboardButton("🏆 Global Leaderboard"),
            KeyboardButton("👥 Group Leaderboard")
        ],
        [
            KeyboardButton("📊 Weekly Top"),
            KeyboardButton("🎖️ All Time Best")
        ],
        [
            KeyboardButton("⬅️ Back to Main Menu")
        ]
    ],
    resize_keyboard=True,
    one_time_keyboard=False,
    input_field_placeholder="View leaderboards..."
    )

def create_community_keyboard() -> ReplyKeyboardMarkup:
    """
    Creates a keyboard for community features
    """
    return ReplyKeyboardMarkup([
        [
            KeyboardButton("📢 Announcements"),
            KeyboardButton("💬 Discussion")
        ],
        [
            KeyboardButton("🎮 Gaming Group"),
            KeyboardButton("📈 Trading Group")
        ],
        [
            KeyboardButton("⬅️ Back to Main Menu")
        ]
    ],
    resize_keyboard=True,
    one_time_keyboard=False,
    input_field_placeholder="Join community..."
    )

def create_app_keyboard() -> ReplyKeyboardMarkup:
    """
    Creates a keyboard for app download/access
    """
    return ReplyKeyboardMarkup([
        [
            KeyboardButton("🌐 Open Web App"),
            KeyboardButton("📱 Download Mobile")
        ],
        [
            KeyboardButton("💳 Connect Wallet"),
            KeyboardButton("💰 View Rewards")
        ],
        [
            KeyboardButton("⬅️ Back to Main Menu")
        ]
    ],
    resize_keyboard=True,
    one_time_keyboard=False,
    input_field_placeholder="App options..."
    )

def create_cancel_keyboard() -> ReplyKeyboardMarkup:
    """
    Creates a simple cancel/back keyboard
    """
    return ReplyKeyboardMarkup([
        [
            KeyboardButton("❌ Cancel"),
            KeyboardButton("⬅️ Back")
        ]
    ],
    resize_keyboard=True,
    one_time_keyboard=False,
    input_field_placeholder="Navigation..."
    )

def remove_keyboard() -> ReplyKeyboardRemove:
    """
    Removes the custom keyboard and returns to normal keyboard
    """
    return ReplyKeyboardRemove(selective=True)

# Keep the original InlineKeyboardMarkup functions for specific use cases
def create_inline_main_menu_keyboard() -> InlineKeyboardMarkup:
    """
    Creates the main 2x2 grid menu using InlineKeyboardMarkup for specific scenarios
    """
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton(
                "🎯 Create Quiz", 
                callback_data="menu:create_quiz"
            ),
            InlineKeyboardButton(
                "🎲 Play Quiz", 
                callback_data="menu:play_quiz"
            )
        ],
        [
            InlineKeyboardButton(
                "🏆 Leaderboards", 
                callback_data="menu:leaderboards"
            ),
            InlineKeyboardButton(
                "💰 My Rewards", 
                callback_data="menu:rewards"
            )
        ]
    ])

def create_inline_game_selection_keyboard() -> InlineKeyboardMarkup:
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
                "💰 My Rewards", 
                callback_data="game:rewards"
            )
        ],
        [
            InlineKeyboardButton(
                "⬅️ Back to Main Menu", 
                callback_data="menu:main"
            )
        ]
    ])

def create_inline_challenge_keyboard() -> InlineKeyboardMarkup:
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

def create_inline_community_keyboard() -> InlineKeyboardMarkup:
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

def create_inline_app_keyboard() -> InlineKeyboardMarkup:
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

def create_inline_quiz_creation_keyboard() -> InlineKeyboardMarkup:
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

def create_inline_cancel_keyboard() -> InlineKeyboardMarkup:
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