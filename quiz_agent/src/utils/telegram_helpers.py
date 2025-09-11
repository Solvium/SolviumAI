"""Helper functions for handling Telegram API errors and retries."""

import asyncio
import functools
import logging
import time
from typing import Callable, Any, Optional, Dict, List
from collections import defaultdict
from telegram.error import TimedOut, NetworkError, RetryAfter, TelegramError, BadRequest

# Configure logging
logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s", level=logging.INFO
)
logger = logging.getLogger(__name__)


# Global message queue for rate limiting
class MessageQueue:
    def __init__(self):
        self.queue = asyncio.Queue()
        self.rate_limits = defaultdict(lambda: {"last_sent": 0, "message_count": 0})
        self.max_messages_per_second = 20  # Conservative limit
        self.max_messages_per_minute = 1000  # Conservative limit
        self.running = False
        self.worker_task = None

    async def start(self):
        """Start the message queue worker"""
        if not self.running:
            self.running = True
            self.worker_task = asyncio.create_task(self._worker())
            logger.info("Message queue worker started")

    async def stop(self):
        """Stop the message queue worker"""
        if self.running:
            self.running = False
            if self.worker_task:
                self.worker_task.cancel()
                try:
                    await self.worker_task
                except asyncio.CancelledError:
                    pass
            logger.info("Message queue worker stopped")

    async def _worker(self):
        """Worker that processes queued messages with rate limiting"""
        while self.running:
            try:
                # Get message from queue with timeout
                try:
                    message_data = await asyncio.wait_for(self.queue.get(), timeout=1.0)
                except asyncio.TimeoutError:
                    continue

                bot, chat_id, text, kwargs = message_data

                # Check rate limits
                await self._check_rate_limits(chat_id)

                # Send message with retry logic
                try:
                    await self._send_with_retry(bot, chat_id, text, **kwargs)
                except Exception as e:
                    logger.error(f"Failed to send message to {chat_id}: {e}")

                # Mark task as done
                self.queue.task_done()

            except Exception as e:
                logger.error(f"Error in message queue worker: {e}")
                await asyncio.sleep(1)

    async def _check_rate_limits(self, chat_id: int):
        """Check and enforce rate limits for a specific chat"""
        now = time.time()
        chat_limits = self.rate_limits[chat_id]

        # Reset counters if needed
        if now - chat_limits["last_sent"] >= 60:  # Reset minute counter
            chat_limits["message_count"] = 0

        # Check per-second limit
        time_since_last = now - chat_limits["last_sent"]
        if time_since_last < 1.0 / self.max_messages_per_second:
            sleep_time = (1.0 / self.max_messages_per_second) - time_since_last
            await asyncio.sleep(sleep_time)

        # Check per-minute limit
        if chat_limits["message_count"] >= self.max_messages_per_minute:
            sleep_time = 60 - (now - chat_limits["last_sent"])
            if sleep_time > 0:
                await asyncio.sleep(sleep_time)
                chat_limits["message_count"] = 0

        # Update counters
        chat_limits["last_sent"] = time.time()
        chat_limits["message_count"] += 1

    async def _send_with_retry(self, bot, chat_id, text, **kwargs):
        """Send message with retry logic"""
        max_retries = 3
        retry_delay = 1.0

        for attempt in range(max_retries):
            try:
                return await bot.send_message(chat_id=chat_id, text=text, **kwargs)
            except RetryAfter as e:
                if attempt < max_retries - 1:
                    retry_seconds = e.retry_after
                    logger.info(
                        f"Rate limit hit for {chat_id}, retrying after {retry_seconds}s"
                    )
                    await asyncio.sleep(retry_seconds)
                else:
                    logger.error(f"Max retries reached for {chat_id}")
                    raise
            except (TimedOut, NetworkError) as e:
                if attempt < max_retries - 1:
                    logger.info(
                        f"Network error for {chat_id}, retrying after {retry_delay}s"
                    )
                    await asyncio.sleep(retry_delay)
                    retry_delay *= 2
                else:
                    logger.error(f"Max retries reached for {chat_id}")
                    raise
            except Exception as e:
                logger.error(f"Non-retryable error for {chat_id}: {e}")
                raise

    async def enqueue_message(self, bot, chat_id: int, text: str, **kwargs):
        """Add a message to the queue for rate-limited sending"""
        await self.queue.put((bot, chat_id, text, kwargs))


# Global message queue instance
message_queue = MessageQueue()


def with_telegram_retry(
    max_retries: int = 3,
    retry_delay: float = 1.0,
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
    Only escapes characters that aren't part of valid markdown patterns.
    """
    if not text:
        return ""

    # Don't escape characters that are part of valid markdown patterns
    # Only escape standalone characters that could cause parsing errors
    result = str(text)

    # Escape characters that are not part of valid markdown patterns
    # or that could cause parsing issues when used incorrectly
    chars_to_escape = [
        "(",
        ")",
        "[",
        "]",
        "`",
        "~",
        ">",
        "#",
        "+",
        "=",
        "|",
        "{",
        "}",
        # Removed "." - dots are valid in numbers and text
    ]

    for char in chars_to_escape:
        result = result.replace(char, "\\" + char)

    # Don't escape *, _, !, - as they are used for markdown formatting
    # Only escape them if they're not part of valid patterns

    return result


async def safe_send_message(bot, chat_id, text, timeout=10.0, use_queue=True, **kwargs):
    """
    Safely send a message with proper error handling and optional queuing.

    Args:
        bot: The bot instance
        chat_id: Chat ID to send message to
        text: Text message to send
        timeout: Timeout for the operation
        use_queue: Whether to use the message queue for rate limiting
        **kwargs: Additional arguments to pass to send_message

    Returns:
        The Message object or None if failed
    """
    # If parse_mode is specified, sanitize the text accordingly
    parse_mode = kwargs.get("parse_mode", None)
    if parse_mode and parse_mode.lower() == "markdown":
        text = sanitize_markdown(text)

    # Use message queue for rate limiting if enabled
    if use_queue and message_queue.running:
        try:
            await message_queue.enqueue_message(bot, chat_id, text, **kwargs)
            return None  # Queue handles the actual sending
        except Exception as e:
            logger.error(f"Failed to enqueue message for {chat_id}: {e}")
            # Fall back to direct sending

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


async def safe_send_photo(
    bot, chat_id, photo_path, caption=None, timeout=30.0, use_queue=True, **kwargs
):
    """
    Safely send a photo with proper error handling and optional queuing.

    Args:
        bot: The bot instance
        chat_id: Chat ID to send photo to
        photo_path: Path to the photo file
        caption: Optional caption for the photo
        timeout: Timeout for the operation
        use_queue: Whether to use the message queue for rate limiting
        **kwargs: Additional arguments to pass to send_photo

    Returns:
        The Message object or None if failed
    """
    # If parse_mode is specified and caption is provided, sanitize the caption
    parse_mode = kwargs.get("parse_mode", None)
    if parse_mode and parse_mode.lower() == "markdown" and caption:
        caption = sanitize_markdown(caption)

    # Use message queue for rate limiting if enabled
    if use_queue and message_queue.running:
        try:
            # Note: Queue might not support photos, so we'll send directly
            pass
        except Exception as e:
            logger.error(f"Failed to enqueue photo for {chat_id}: {e}")
            # Fall back to direct sending

    try:
        # Check if file exists before trying to open it
        import os
        if not os.path.exists(photo_path):
            logger.error(f"Photo file not found: {photo_path}")
            logger.error(f"Current working directory: {os.getcwd()}")
            logger.error(f"File exists check: {os.path.exists(photo_path)}")
            logger.error(
                f"Directory contents: {os.listdir(os.path.dirname(photo_path)) if os.path.exists(os.path.dirname(photo_path)) else 'Directory not found'}"
            )
            return None

        # Open the photo file
        with open(photo_path, "rb") as photo_file:
            # Add timeout to prevent hanging
            return await asyncio.wait_for(
                with_telegram_retry()(bot.send_photo)(
                    chat_id=chat_id, photo=photo_file, caption=caption, **kwargs
                ),
                timeout=timeout,
            )
    except FileNotFoundError:
        logger.error(f"Photo file not found: {photo_path}")
        # Log additional debugging information
        import os

        logger.error(f"Current working directory: {os.getcwd()}")
        logger.error(f"File exists check: {os.path.exists(photo_path)}")
        logger.error(
            f"Directory contents: {os.listdir(os.path.dirname(photo_path)) if os.path.exists(os.path.dirname(photo_path)) else 'Directory not found'}"
        )
        return None
    except asyncio.TimeoutError:
        logger.error(f"Timeout sending photo to {chat_id} after {timeout} seconds")
        return None
    except BadRequest as e:
        if "can't parse entities" in str(e).lower() and caption:
            logger.warning(f"Entity parsing error, retrying without formatting: {e}")
            # Try sending without any parsing mode
            kwargs.pop("parse_mode", None)
            try:
                with open(photo_path, "rb") as photo_file:
                    return await asyncio.wait_for(
                        with_telegram_retry()(bot.send_photo)(
                            chat_id=chat_id, photo=photo_file, caption=caption, **kwargs
                        ),
                        timeout=timeout,
                    )
            except BadRequest as e2:
                logger.error(f"Failed to send photo even without formatting: {e2}")
                return None
        elif "chat not found" in str(e).lower() or "user not found" in str(e).lower():
            logger.warning(f"Cannot send photo to {chat_id}: user/chat not found")
        else:
            logger.error(f"Bad request when sending photo to {chat_id}: {e}")
        return None
    except TelegramError as e:
        logger.error(f"Error sending photo to {chat_id}: {e}")
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


async def safe_answer_callback_query(bot, callback_query_id, text=None, **kwargs):
    """
    Safely answer a callback query with proper error handling.

    Args:
        bot: The bot instance
        callback_query_id: The callback query ID to answer
        text: Text to show to the user
        **kwargs: Additional arguments to pass to answer_callback_query

    Returns:
        True if successful, False otherwise
    """
    try:
        await with_telegram_retry()(bot.answer_callback_query)(
            callback_query_id=callback_query_id, text=text, **kwargs
        )
        return True
    except Exception as e:
        logger.error(f"Error answering callback query {callback_query_id}: {e}")
        return False
