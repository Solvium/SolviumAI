#!/usr/bin/env python3
"""
Test script to verify poll deletion implementation
This script tests the key components of the poll deletion feature
"""

import asyncio
import logging
from unittest.mock import Mock, AsyncMock, patch

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def test_poll_deletion_logic():
    """Test the poll deletion logic without actually calling Telegram API"""
    
    # Mock the application and bot
    mock_bot = Mock()
    mock_bot.delete_message = AsyncMock()
    mock_bot.send_message = AsyncMock()
    
    mock_application = Mock()
    mock_application.bot = mock_bot
    
    # Mock Redis client
    mock_redis = Mock()
    mock_redis.get_user_quiz_data = AsyncMock(return_value="12345")
    mock_redis.close = AsyncMock()
    
    # Mock the RedisClient class
    with patch('src.services.quiz_service.RedisClient') as mock_redis_class:
        mock_redis_class.return_value = mock_redis
        
        # Import the function to test
        from src.services.quiz_service import handle_enhanced_quiz_answer
        
        # Mock the quiz session
        mock_session = Mock()
        mock_session.current_question_index = 2  # Question 2 (index 1)
        mock_session.submit_answer = Mock(return_value=True)
        mock_session.next_question = Mock(return_value=False)
        
        # Mock active_quiz_sessions
        with patch('src.services.quiz_service.active_quiz_sessions', {
            'user123:quiz456': mock_session
        }):
            # Mock scheduled_tasks
            with patch('src.services.quiz_service.scheduled_tasks', {}):
                # Mock database session
                with patch('src.services.quiz_service.SessionLocal') as mock_session_local:
                    mock_db_session = Mock()
                    mock_quiz = Mock()
                    mock_quiz.id = 'quiz456'
                    mock_db_session.query.return_value.filter.return_value.first.return_value = mock_quiz
                    mock_session_local.return_value = mock_db_session
                    
                    # Test the function
                    result = await handle_enhanced_quiz_answer(
                        mock_application, 'user123', 'quiz456', 'A'
                    )
                    
                    # Verify the results
                    assert result == True
                    assert mock_bot.delete_message.called
                    assert mock_bot.send_message.called
                    
                    # Check that delete_message was called with correct parameters
                    delete_call = mock_bot.delete_message.call_args
                    assert delete_call[1]['chat_id'] == 'user123'
                    assert delete_call[1]['message_id'] == 12345
                    
                    # Check that confirmation message was sent
                    send_call = mock_bot.send_message.call_args
                    assert send_call[1]['chat_id'] == 'user123'
                    assert send_call[1]['text'] == '✅ Answer recorded!'
                    
                    logger.info("✅ Poll deletion test passed!")
                    
                    return True

async def test_error_handling():
    """Test error handling when poll deletion fails"""
    
    mock_bot = Mock()
    mock_bot.delete_message = AsyncMock(side_effect=Exception("Message not found"))
    mock_bot.stop_poll = AsyncMock()
    
    mock_application = Mock()
    mock_application.bot = mock_bot
    
    # Mock Redis client
    mock_redis = Mock()
    mock_redis.get_user_quiz_data = AsyncMock(return_value="12345")
    mock_redis.close = AsyncMock()
    
    with patch('src.services.quiz_service.RedisClient') as mock_redis_class:
        mock_redis_class.return_value = mock_redis
        
        from src.services.quiz_service import handle_enhanced_quiz_answer
        
        mock_session = Mock()
        mock_session.current_question_index = 2
        mock_session.submit_answer = Mock(return_value=True)
        mock_session.next_question = Mock(return_value=False)
        
        with patch('src.services.quiz_service.active_quiz_sessions', {
            'user123:quiz456': mock_session
        }):
            with patch('src.services.quiz_service.scheduled_tasks', {}):
                with patch('src.services.quiz_service.SessionLocal') as mock_session_local:
                    mock_db_session = Mock()
                    mock_quiz = Mock()
                    mock_quiz.id = 'quiz456'
                    mock_db_session.query.return_value.filter.return_value.first.return_value = mock_quiz
                    mock_session_local.return_value = mock_db_session
                    
                    # Test that the function handles errors gracefully
                    result = await handle_enhanced_quiz_answer(
                        mock_application, 'user123', 'quiz456', 'A'
                    )
                    
                    assert result == True
                    logger.info("✅ Error handling test passed!")
                    
                    return True

async def main():
    """Run all tests"""
    logger.info("🧪 Starting poll deletion tests...")
    
    try:
        await test_poll_deletion_logic()
        await test_error_handling()
        logger.info("🎉 All tests passed!")
    except Exception as e:
        logger.error(f"❌ Test failed: {e}")
        raise

if __name__ == "__main__":
    asyncio.run(main())
