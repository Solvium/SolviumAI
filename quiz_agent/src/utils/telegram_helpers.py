"""Helper functions for handling Telegram API errors and retries."""

import asyncio
import functools
import logging
import re
from typing import Callable, Any, Optional
from telegram.error import TimedOut, NetworkError, RetryAfter, TelegramError, BadRequest

# Configure logging
logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s", level=logging.INFO
)
logger = logging.getLogger(__name__)


def with_telegram_retry(
    max_retries: int = 2,  # Reduced from 3 for faster failures
    retry_delay: float = 0.5,  # Reduced from 1.0 for faster retries
    exceptions_to_retry=(TimedOut, NetworkError, RetryAfter),
) -> Callable:
    """
    Decorator to retry Telegram API calls on specific exceptions.

    Args:
        max_retries: Maximum number of retry attempts
        retry_delay: Initial delay between retries (will increase exponentially)
        exceptions_to_retry: Tuple of exception classes to retry on

    Returns:
        Decorated function with retry logic
    """

    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        async def wrapper(*args, **kwargs) -> Any:
            retries = 0
            current_delay = retry_delay

            while True:
                try:
                    return await func(*args, **kwargs)
                except RetryAfter as e:
                    # Handle rate limiting specifically
                    if retries >= max_retries:
                        logger.warning(f"Retry limit reached for {func.__name__}")
                        # Propagate the exception if we've exhausted retries
                        raise

                    retry_seconds = e.retry_after
                    logger.info(f"Rate limit hit, retrying after {retry_seconds}s")
                    await asyncio.sleep(retry_seconds)
                    retries += 1

                except exceptions_to_retry as e:
                    if retries >= max_retries:
                        logger.warning(f"Retry limit reached for {func.__name__}")
                        # Propagate the exception if we've exhausted retries
                        raise

                    logger.info(
                        f"Retrying {func.__name__} due to {type(e).__name__}: {e}, "
                        f"attempt {retries + 1}/{max_retries} after {current_delay}s"
                    )
                    await asyncio.sleep(current_delay)
                    retries += 1
                    current_delay *= 2  # Exponential backoff

                except Exception as e:
                    # Don't retry other exceptions
                    logger.error(
                        f"Non-retryable error in {func.__name__}: {type(e).__name__}: {e}"
                    )
                    raise

        return wrapper

    return decorator


def sanitize_markdown(text: str) -> str:
    """
    Sanitize text to prevent markdown parsing errors.
    Escapes special markdown characters that aren't part of valid formatting.
    """
    # If the text doesn't contain any markdown indicators, return as is
    if not any(char in text for char in ["*", "_", "`", "["]):
        return text

    # Find valid markdown patterns
    patterns = {
        "bold": r"\*\*.*?\*\*",
        "italic": r"_.*?_",
        "code": r"`.*?`",
        "link": r"\[.*?\]\(.*?\)",
    }

    # Replace valid markdown patterns with placeholders
    replacements = []
    for i, (style, pattern) in enumerate(patterns.items()):
        matches = re.finditer(pattern, text)
        for match in matches:
            placeholder = f"__MARKDOWN_{i}_{len(replacements)}__"
            replacements.append((placeholder, match.group(0)))
            text = text[: match.start()] + placeholder + text[match.end() :]

    # Escape remaining special characters
    special_chars = [
        "*",
        "_",
        "`",
        "[",
        "]",
        "(",
        ")",
        "~",
        ">",
        "#",
        "+",
        "-",
        "=",
        "|",
        "{",
        "}",
        ".",
        "!",
    ]
    for char in special_chars:
        text = text.replace(char, "\\" + char)

    # Restore valid markdown
    for placeholder, original in replacements:
        text = text.replace(placeholder, original)

    return text


async def safe_send_message(bot, chat_id, text, timeout=10.0, **kwargs):
    """
    Safely send a message with proper error handling.

    Args:
        bot: The bot instance
        chat_id: Chat ID to send message to
        text: Text message to send
        **kwargs: Additional arguments to pass to send_message

    Returns:
        The Message object or None if failed
    """
    # If parse_mode is specified, sanitize the text accordingly
    parse_mode = kwargs.get("parse_mode", None)
    if parse_mode and parse_mode.lower() == "markdown":
        text = sanitize_markdown(text)

    try:
        # Add timeout to prevent hanging
        return await asyncio.wait_for(
            with_telegram_retry()(bot.send_message)(
                chat_id=chat_id, text=text, **kwargs
            ),
            timeout=timeout,
        )
    except BadRequest as e:
        if "can't parse entities" in str(e).lower():
            logger.warning(f"Entity parsing error, retrying without formatting: {e}")
            # Try sending without any parsing mode
            kwargs.pop("parse_mode", None)
            try:
                return await asyncio.wait_for(
                    with_telegram_retry()(bot.send_message)(
                        chat_id=chat_id, text=text, **kwargs
                    ),
                    timeout=timeout,
                )
            except BadRequest as e2:
                logger.error(f"Failed to send message even without formatting: {e2}")
                return None
        elif "chat not found" in str(e).lower() or "user not found" in str(e).lower():
            logger.warning(f"Cannot send message to {chat_id}: user/chat not found")
        else:
            logger.error(f"Bad request when sending message to {chat_id}: {e}")
        return None
    except TelegramError as e:
        logger.error(f"Error sending message to {chat_id}: {e}")
        return None


async def safe_edit_message_text(
    bot, chat_id, message_id, text, timeout=10.0, **kwargs
):
    """
    Safely edit a message with proper error handling.

    Args:
        bot: The bot instance
        chat_id: Chat ID of the message
        message_id: Message ID to edit
        text: New text for the message
        **kwargs: Additional arguments to pass to edit_message_text

    Returns:
        The edited Message object or None if failed
    """
    try:
        return await asyncio.wait_for(
            with_telegram_retry()(bot.edit_message_text)(
                chat_id=chat_id, message_id=message_id, text=text, **kwargs
            ),
            timeout=timeout,
        )
    except BadRequest as e:
        if "message is not modified" in str(e).lower():
            # This is fine, the message was already the way we wanted it
            return None
        logger.error(f"Bad request when editing message {message_id}: {e}")
        return None
    except TelegramError as e:
        logger.error(f"Error editing message {message_id}: {e}")
        return None
