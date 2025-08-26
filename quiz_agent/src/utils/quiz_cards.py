"""
Quiz Card Formatting Utilities
Rich formatting for quiz announcements and displays
"""

from typing import List, Optional, Dict, Any
from telegram import InlineKeyboardButton, InlineKeyboardMarkup


def create_quiz_announcement_card(
    topic: str,
    num_questions: int,
    duration_minutes: int,
    reward_amount: float,
    reward_structure: str,
    quiz_id: str,
    is_free: bool = False,
    bot_username: str = None,
) -> tuple[str, InlineKeyboardMarkup]:
    """
    Create a rich announcement card for a new quiz

    Returns:
        tuple: (formatted_message, inline_keyboard)
    """

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

    # Create the card border and content
    # Sanitize all content to avoid Markdown parsing issues
    safe_topic = sanitize_markdown(topic)
    safe_reward_structure = reward_structure
    if "Top 3 winners" in reward_structure:
        safe_reward_structure = "Top 3 Winners"
    elif "Winner-takes-all" in reward_structure:
        safe_reward_structure = "Winner Takes All"

    # Sanitize the reward structure
    safe_reward_structure = sanitize_markdown(safe_reward_structure)

    # Sanitize quiz_id for callback data
    safe_quiz_id = sanitize_markdown(quiz_id)

    # Sanitize bot_username if provided
    safe_bot_username = sanitize_markdown(bot_username) if bot_username else None

    card = f"""
┌─────────────────────────────────────────────────┐
│  🎯 **{safe_topic.upper()} QUIZ** 🎯                    │
│                                                 │
│  📝 **{num_questions} Questions** • ⏱ **{duration_minutes} minutes**  │
│  💰 **{reward_amount} NEAR** Prize Pool              │
│  🏆 **{safe_reward_structure}**                           │
│                                                 │
│  🎮 **Ready to test your knowledge?**           │
└─────────────────────────────────────────────────┘
"""

    # Create interactive buttons
    buttons = []

    if bot_username:
        # Use deep linking for seamless DM redirection
        play_button = InlineKeyboardButton(
            "🎮 Play Quiz",
            url=f"https://t.me/{bot_username}?start=quiz_{quiz_id}",
        )
    else:
        # Fallback to callback data if no bot username provided
        play_button = InlineKeyboardButton(
            "🎮 Play Quiz", callback_data=f"play_quiz:{quiz_id}"
        )

    leaderboard_button = InlineKeyboardButton(
        "📊 Leaderboard", callback_data=f"leaderboard:{quiz_id}"
    )

    buttons.append([play_button, leaderboard_button])
    keyboard = InlineKeyboardMarkup(buttons)

    return card.strip(), keyboard


def create_question_display_card(
    question_text: str,
    options: List[str],
    question_num: int,
    total_questions: int,
    time_remaining: int,
    current_score: int,
    quiz_id: str,
) -> tuple[str, InlineKeyboardMarkup]:
    """
    Create an interactive question display card

    Returns:
        tuple: (formatted_message, inline_keyboard)
    """

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

    # Sanitize question text and options
    safe_question_text = sanitize_markdown(question_text)
    safe_options = [sanitize_markdown(option) for option in options]

    # Create question card
    card = f"""
🎯 **Question {question_num} of {total_questions}**
⏱ **{time_remaining}s remaining** • 🏆 **{current_score} points**

**{safe_question_text}**

"""

    # Add options with letter indicators
    option_letters = ["A", "B", "C", "D"]
    for i, option in enumerate(safe_options):
        card += f"{option_letters[i]}) {option}\n"

    card += "\n══════════════════════════════════════════"

    # Create answer buttons
    answer_buttons = []
    for i, letter in enumerate(option_letters):
        answer_buttons.append(
            InlineKeyboardButton(
                f"{letter}", callback_data=f"answer:{quiz_id}:{question_num}:{i}"
            )
        )

    # Create action buttons
    action_buttons = [
        InlineKeyboardButton("💡 Hint", callback_data=f"hint:{quiz_id}:{question_num}"),
        InlineKeyboardButton("⏭ Skip", callback_data=f"skip:{quiz_id}:{question_num}"),
    ]

    buttons = [answer_buttons, action_buttons]
    keyboard = InlineKeyboardMarkup(buttons)

    return card.strip(), keyboard


def create_leaderboard_card(
    quiz_id: str,
    leaderboard_data: List[Dict[str, Any]],
    time_remaining: int,
    total_participants: int,
) -> tuple[str, InlineKeyboardMarkup]:
    """
    Create an enhanced leaderboard display

    Returns:
        tuple: (formatted_message, inline_keyboard)
    """

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

    # Create leaderboard header
    card = f"""
🏆 **LEADERBOARD** 🏆
══════════════════════════════════════════

"""

    # Add rankings
    rank_emojis = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"]

    for i, player in enumerate(leaderboard_data[:10]):  # Top 10
        rank_emoji = rank_emojis[i] if i < len(rank_emojis) else f"{i+1}️⃣"
        username = player.get("username", "Anonymous")
        score = player.get("score", 0)
        correct_answers = player.get("correct_answers", 0)
        total_questions = player.get("total_questions", 0)

        card += f"{rank_emoji} **@{username}** - {score} pts ({correct_answers}/{total_questions})\n"

    # Add footer
    card += f"""
══════════════════════════════════════════
⏱ **{time_remaining}s remaining** • 👥 **{total_participants} players active**
"""

    # Create action buttons
    buttons = [
        [
            InlineKeyboardButton(
                "🔄 Refresh", callback_data=f"refresh_leaderboard:{quiz_id}"
            ),
            InlineKeyboardButton("🎮 Join Quiz", callback_data=f"play_quiz:{quiz_id}"),
        ]
    ]

    keyboard = InlineKeyboardMarkup(buttons)

    return card.strip(), keyboard


def create_progress_card(
    current_question: int,
    total_questions: int,
    time_remaining: int,
    current_score: int,
    rank: int,
    total_participants: int,
) -> str:
    """
    Create a progress tracking card

    Returns:
        str: formatted progress message
    """

    # Calculate progress percentage
    progress_percentage = (current_question / total_questions) * 100

    # Create progress bar
    progress_bar_length = 20
    filled_length = int((progress_percentage / 100) * progress_bar_length)
    progress_bar = "█" * filled_length + "░" * (progress_bar_length - filled_length)

    card = f"""
📊 **YOUR PROGRESS**
══════════════════════════════════════════

🎯 Question: {current_question}/{total_questions}
⏱ Time: {time_remaining}s remaining
🏆 Score: {current_score} points
📈 Rank: #{rank} of {total_participants}

{progress_bar} {progress_percentage:.0f}%
"""

    return card.strip()


def create_achievement_card(
    achievement_type: str, achievement_name: str, description: str, points_earned: int
) -> str:
    """
    Create an achievement celebration card

    Returns:
        str: formatted achievement message
    """

    achievement_emojis = {
        "streak": "🔥",
        "speed": "⚡",
        "accuracy": "🎯",
        "first": "🥇",
        "perfect": "💎",
    }

    emoji = achievement_emojis.get(achievement_type, "🏆")

    card = f"""
{emoji} **ACHIEVEMENT UNLOCKED!** {emoji}
══════════════════════════════════════════

🏆 **{achievement_name}**
📝 {description}
💰 +{points_earned} bonus points!

🎉 Congratulations!
"""

    return card.strip()
