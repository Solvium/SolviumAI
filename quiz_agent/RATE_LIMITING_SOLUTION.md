# Telegram Rate Limiting Solution

## Problem Description

The bot was experiencing Telegram's flood control mechanism when multiple users interacted with quizzes simultaneously. This resulted in errors like:

```
Flood control exceeded. Retry in 10 seconds
HTTP/1.1 429 Too Many Requests
```

## Root Cause Analysis

1. **Direct API Calls**: Handlers were using `context.bot.send_message()` directly without rate limiting
2. **No Message Queuing**: Multiple concurrent requests tried to send messages simultaneously
3. **Cascading Failures**: Error handling tried to send error messages, which also failed due to rate limiting
4. **No Retry Logic**: Failed requests weren't retried with proper backoff

## Solution Implementation

### 1. Message Queue System

Created a global message queue (`MessageQueue` class) that:

- Queues all outgoing messages
- Processes them sequentially with rate limiting
- Implements per-chat rate limits (20 messages/second, 1000 messages/minute)
- Provides automatic retry logic with exponential backoff

### 2. Enhanced Helper Functions

#### `safe_send_message()`

- Replaces direct `context.bot.send_message()` calls
- Uses message queue for rate limiting
- Includes proper error handling and retry logic
- Sanitizes markdown to prevent parsing errors

#### `safe_answer_callback_query()`

- Safely answers callback queries with retry logic
- Prevents callback query failures from cascading

#### `with_telegram_retry()` decorator

- Provides automatic retry for Telegram API calls
- Handles `RetryAfter`, `TimedOut`, and `NetworkError` exceptions
- Implements exponential backoff

### 3. Updated Handlers

All handlers now use:

- `safe_send_message()` instead of `context.bot.send_message()`
- `safe_answer_callback_query()` for callback responses
- Proper error handling that doesn't send additional messages during rate limiting

### 4. Bot Initialization

The bot now:

- Starts the message queue on initialization
- Stops the queue gracefully on shutdown
- Integrates queue management with the bot lifecycle

## Key Features

### Rate Limiting

- **Per-second limit**: 20 messages per second per chat
- **Per-minute limit**: 1000 messages per minute per chat
- **Automatic spacing**: Messages are automatically spaced to respect limits

### Retry Logic

- **Max retries**: 3 attempts for failed requests
- **Exponential backoff**: Delay increases with each retry
- **Specific handling**: Different retry strategies for different error types

### Error Handling

- **Graceful degradation**: Bot continues working even during rate limiting
- **No cascading failures**: Error messages aren't sent during rate limiting
- **Proper logging**: All rate limiting events are logged for monitoring

### Message Queue Benefits

- **Sequential processing**: Messages are sent one at a time per chat
- **Automatic queuing**: High-traffic periods are handled gracefully
- **Memory efficient**: Queue doesn't grow indefinitely

## Implementation Details

### Files Modified

1. **`src/utils/telegram_helpers.py`**

   - Added `MessageQueue` class
   - Enhanced `safe_send_message()` function
   - Added `safe_answer_callback_query()` function
   - Improved retry decorator

2. **`src/bot/telegram_bot.py`**

   - Added message queue initialization
   - Integrated queue lifecycle with bot lifecycle

3. **`src/bot/handlers.py`**
   - Replaced all direct `context.bot.send_message()` calls
   - Updated callback query handling
   - Improved error handling

### Configuration

The rate limiting can be configured by modifying these values in `MessageQueue`:

```python
self.max_messages_per_second = 20  # Conservative limit
self.max_messages_per_minute = 1000  # Conservative limit
```

## Testing

Run the test script to verify the implementation:

```bash
python test_rate_limiting.py
```

## Monitoring

The solution includes comprehensive logging:

- Rate limit hits are logged with retry information
- Queue processing is monitored
- Error handling is logged for debugging

## Benefits

1. **Eliminates flood control errors**: Messages are properly rate limited
2. **Improves user experience**: No more failed interactions
3. **Handles high traffic**: Bot can handle many concurrent users
4. **Maintains reliability**: Graceful degradation during peak usage
5. **Easy monitoring**: Comprehensive logging for debugging

## Future Enhancements

1. **Dynamic rate limiting**: Adjust limits based on bot performance
2. **Priority queuing**: Prioritize important messages
3. **Distributed queuing**: Support for multiple bot instances
4. **Metrics collection**: Track rate limiting statistics

## Usage

The solution is transparent to existing code. Simply replace:

```python
# Old way (causes rate limiting)
await context.bot.send_message(chat_id, "Hello")

# New way (rate limited)
await safe_send_message(context.bot, chat_id, "Hello")
```

All existing functionality remains the same, but now with proper rate limiting and error handling.
