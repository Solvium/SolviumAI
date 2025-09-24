from telegram import (
    InlineKeyboardMarkup,
    InlineKeyboardButton,
    ReplyKeyboardMarkup,
    ReplyKeyboardRemove,
    KeyboardButton,
    WebAppInfo,
)
from typing import List, Optional


def get_menu_icon_placeholder() -> str:
    """
    Returns a consistent menu icon placeholder that will always show the menu icon
    at the end of the input field.

    IMPORTANT: The menu icon (📱) will only appear consistently when:
    1. one_time_keyboard=False (keeps keyboard visible)
    2. All messages include reply_markup parameter
    3. No messages are sent without reply_markup (which removes the keyboard)

    This ensures users always see the menu icon at the end of the input field.
    """
    return "📱 Choose an option..."


def create_main_menu_keyboard() -> ReplyKeyboardMarkup:
    """
    Creates the simplified main menu with only 4 essential options.
    The menu icon will always be visible at the end of the input field.

    CRITICAL SETTINGS for menu icon consistency:
    - resize_keyboard=True: Makes buttons smaller to fit better
    - one_time_keyboard=False: Keeps keyboard visible (CRITICAL - prevents icon from disappearing)
    - input_field_placeholder: Shows menu icon (📱) at end of input field

    The menu icon will disappear if any message is sent without reply_markup parameter.
    """
    return ReplyKeyboardMarkup(
        [
            [KeyboardButton("💰 My Wallet"), KeyboardButton("🎯 My Points")],
            [KeyboardButton("🏆 Leaderboards"), KeyboardButton("📜 History")],
        ],
        resize_keyboard=True,  # Makes buttons smaller to fit better
        one_time_keyboard=False,  # Keeps keyboard visible - CRITICAL for menu icon consistency
        input_field_placeholder=get_menu_icon_placeholder(),  # Menu icon placeholder
    )


def create_wallet_keyboard() -> ReplyKeyboardMarkup:
    """
    Creates a keyboard for wallet management options.
    Essential daily wallet functions in a clean 2x3 grid.
    """
    return ReplyKeyboardMarkup(
        [
            [KeyboardButton("💰 View Balance"), KeyboardButton("🔑 Export Keys")],
            [KeyboardButton("📤 Withdraw"), KeyboardButton("📥 Receive")],
            [KeyboardButton("📊 Transactions"), KeyboardButton("⬅️ Back to Main Menu")],
        ],
        resize_keyboard=True,
        one_time_keyboard=False,
        input_field_placeholder="📱 Wallet options...",
    )


def create_leaderboards_keyboard() -> ReplyKeyboardMarkup:
    """
    Creates a keyboard for leaderboard options
    """
    return ReplyKeyboardMarkup(
        [
            [
                KeyboardButton("🏆 Global Leaderboard"),
                KeyboardButton("👥 Group Leaderboard"),
            ],
            [KeyboardButton("📊 Weekly Top"), KeyboardButton("🎖️ All Time Best")],
            [KeyboardButton("⬅️ Back to Main Menu")],
        ],
        resize_keyboard=True,
        one_time_keyboard=False,
        input_field_placeholder="📱 View leaderboards...",
    )


def create_withdrawal_keyboard() -> ReplyKeyboardMarkup:
    """
    Creates a keyboard for withdrawal options
    """
    return ReplyKeyboardMarkup(
        [
            [KeyboardButton("💎 Withdraw NEAR"), KeyboardButton("🪙 Withdraw Token")],
            [
                KeyboardButton("🎯 Withdraw Points"),
                KeyboardButton("📊 Transaction History"),
            ],
            [KeyboardButton("⬅️ Back to Main Menu")],
        ],
        resize_keyboard=True,
        one_time_keyboard=False,
        input_field_placeholder="📱 Withdrawal options...",
    )


def create_cancel_keyboard() -> ReplyKeyboardMarkup:
    """
    Creates a simple cancel/back keyboard
    """
    return ReplyKeyboardMarkup(
        [[KeyboardButton("❌ Cancel"), KeyboardButton("⬅️ Back")]],
        resize_keyboard=True,
        one_time_keyboard=False,
        input_field_placeholder="📱 Navigation...",
    )


def remove_keyboard() -> ReplyKeyboardRemove:
    """
    Removes the custom keyboard and returns to normal keyboard for all users
    """
    return ReplyKeyboardRemove(selective=False)


# Keep the original InlineKeyboardMarkup functions for specific use cases
def create_inline_main_menu_keyboard() -> InlineKeyboardMarkup:
    """
    Creates the main simplified menu using InlineKeyboardMarkup for specific scenarios
    """
    return InlineKeyboardMarkup(
        [
            [
                InlineKeyboardButton("💰 My Wallet", callback_data="menu:wallet"),
                InlineKeyboardButton("� My Points", callback_data="menu:my_points"),
            ],
            [
                InlineKeyboardButton(
                    "🏆 Leaderboards", callback_data="menu:leaderboards"
                ),
                InlineKeyboardButton("� Withdraw", callback_data="menu:withdraw"),
            ],
        ]
    )


def create_inline_leaderboards_keyboard() -> InlineKeyboardMarkup:
    """
    Creates a keyboard for leaderboard options
    """
    return InlineKeyboardMarkup(
        [
            [
                InlineKeyboardButton(
                    "🏆 Global Leaderboard", callback_data="leaderboard:global"
                ),
                InlineKeyboardButton(
                    "👥 Group Leaderboard", callback_data="leaderboard:group"
                ),
            ],
            [
                InlineKeyboardButton(
                    "📊 Weekly Top", callback_data="leaderboard:weekly"
                ),
                InlineKeyboardButton(
                    "🎖️ All Time Best", callback_data="leaderboard:alltime"
                ),
            ],
            [InlineKeyboardButton("⬅️ Back to Main Menu", callback_data="menu:main")],
        ]
    )


def create_inline_rewards_keyboard() -> InlineKeyboardMarkup:
    """
    Creates a keyboard for rewards and wallet management
    """
    return InlineKeyboardMarkup(
        [
            [
                InlineKeyboardButton(
                    "💳 Connect Wallet", callback_data="rewards:connect_wallet"
                ),
                InlineKeyboardButton(
                    "💰 View Balance", callback_data="rewards:balance"
                ),
            ],
            [
                InlineKeyboardButton("🏆 Claim Rewards", callback_data="rewards:claim"),
                InlineKeyboardButton(
                    "📈 Transaction History", callback_data="rewards:history"
                ),
            ],
            [InlineKeyboardButton("⬅️ Back to Main Menu", callback_data="menu:main")],
        ]
    )


def create_inline_cancel_keyboard() -> InlineKeyboardMarkup:
    """
    Creates a simple cancel/back keyboard
    """
    return InlineKeyboardMarkup(
        [
            [
                InlineKeyboardButton("❌ Cancel", callback_data="cancel"),
                InlineKeyboardButton("⬅️ Back", callback_data="back"),
            ]
        ]
    )
