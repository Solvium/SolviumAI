"""
Message Cleanup Service for Anti-Spam Features

This service handles automatic deletion of quiz announcements and leaderboard messages
to prevent spam in group chats.
"""

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from store.database import SessionLocal
from models.quiz import Quiz, QuizStatus
from telegram.error import BadRequest

logger = logging.getLogger(__name__)


class MessageCleanupService:
    """Service for cleaning up quiz-related messages to prevent spam"""

    def __init__(self, bot=None):
        self.bot = bot
        self.cleanup_interval = 30  # Run cleanup every 30 seconds
        self.leaderboard_ttl = 300  # Delete leaderboards after 5 minutes

    async def start_cleanup_loop(self, application):
        """Start the background cleanup loop"""
        self.bot = application.bot
        logger.info("Starting message cleanup service")

        while True:
            try:
                await self.run_cleanup_cycle()
                await asyncio.sleep(self.cleanup_interval)
            except Exception as e:
                logger.error(f"Error in cleanup loop: {e}", exc_info=True)
                await asyncio.sleep(60)  # Wait longer on error

    async def run_cleanup_cycle(self):
        """Run one cleanup cycle"""
        try:
            await self.cleanup_announcements()
            await self.cleanup_leaderboards()
        except Exception as e:
            logger.error(f"Error in cleanup cycle: {e}", exc_info=True)

    async def cleanup_announcements(self):
        """Delete announcement messages for closed quizzes - but wait at least 25 minutes after quiz end"""
        session = SessionLocal()
        try:
            # Find closed quizzes with undeleted announcements
            # Only delete if quiz ended at least 25 minutes ago to allow our 20-minute cleanup to work
            cutoff_time = datetime.now(timezone.utc) - timedelta(minutes=25)

            closed_quizzes = (
                session.query(Quiz)
                .filter(
                    Quiz.status == QuizStatus.CLOSED,
                    Quiz.announcement_message_id.isnot(None),
                    Quiz.announcement_deleted_at.is_(None),
                    Quiz.end_time
                    < cutoff_time,  # Only delete if quiz ended more than 25 minutes ago
                )
                .all()
            )

            # Only log if there are announcements to clean up
            if len(closed_quizzes) > 0:
                logger.info(
                    f"Found {len(closed_quizzes)} quiz announcements eligible for cleanup (older than 25 minutes)"
                )
                for quiz in closed_quizzes:
                    await self.delete_announcement_message(quiz, session)
            # No logging when there's nothing to clean up (reduces spam)

        except Exception as e:
            logger.error(f"Error cleaning up announcements: {e}", exc_info=True)
        finally:
            session.close()

    async def cleanup_leaderboards(self):
        """Delete leaderboard messages older than 5 minutes"""
        session = SessionLocal()
        try:
            # Find leaderboards older than 5 minutes
            cutoff_time = datetime.now(timezone.utc) - timedelta(
                seconds=self.leaderboard_ttl
            )

            old_leaderboards = (
                session.query(Quiz)
                .filter(
                    Quiz.leaderboard_message_id.isnot(None),
                    Quiz.leaderboard_deleted_at.is_(None),
                    Quiz.leaderboard_created_at < cutoff_time,
                )
                .all()
            )

            for quiz in old_leaderboards:
                await self.delete_leaderboard_message(quiz, session)

        except Exception as e:
            logger.error(f"Error cleaning up leaderboards: {e}", exc_info=True)
        finally:
            session.close()

    async def delete_announcement_message(self, quiz: Quiz, session):
        """Delete a quiz announcement message"""
        if not self.bot or not quiz.announcement_message_id:
            return

        try:
            # Determine chat ID (group or DM)
            chat_id = quiz.group_chat_id
            if quiz.group_chat_id > 0:  # DM quiz
                chat_id = quiz.creator_user_id

            await self.bot.delete_message(
                chat_id=chat_id, message_id=quiz.announcement_message_id
            )

            # Mark as deleted
            quiz.announcement_deleted_at = datetime.now(timezone.utc)
            session.commit()

            logger.info(
                f"Deleted announcement message {quiz.announcement_message_id} for quiz {quiz.id}"
            )

        except BadRequest as e:
            if "message to delete not found" in str(e).lower():
                logger.info(
                    f"Announcement message {quiz.announcement_message_id} already deleted"
                )
                quiz.announcement_deleted_at = datetime.now(timezone.utc)
                session.commit()
            else:
                logger.error(f"Error deleting announcement message: {e}")
        except Exception as e:
            logger.error(f"Unexpected error deleting announcement message: {e}")

    async def delete_leaderboard_message(self, quiz: Quiz, session):
        """Delete a leaderboard message"""
        if not self.bot or not quiz.leaderboard_message_id:
            return

        try:
            # Leaderboards are always in the group chat
            chat_id = quiz.group_chat_id

            await self.bot.delete_message(
                chat_id=chat_id, message_id=quiz.leaderboard_message_id
            )

            # Mark as deleted
            quiz.leaderboard_deleted_at = datetime.now(timezone.utc)
            session.commit()

            logger.info(
                f"Deleted leaderboard message {quiz.leaderboard_message_id} for quiz {quiz.id}"
            )

        except BadRequest as e:
            if "message to delete not found" in str(e).lower():
                logger.info(
                    f"Leaderboard message {quiz.leaderboard_message_id} already deleted"
                )
                quiz.leaderboard_deleted_at = datetime.now(timezone.utc)
                session.commit()
            else:
                logger.error(f"Error deleting leaderboard message: {e}")
        except Exception as e:
            logger.error(f"Unexpected error deleting leaderboard message: {e}")

    async def schedule_leaderboard_deletion(self, quiz: Quiz, session):
        """Schedule a leaderboard for deletion after 5 minutes"""
        quiz.leaderboard_created_at = datetime.now(timezone.utc)
        session.commit()
        logger.info(
            f"Scheduled leaderboard deletion for quiz {quiz.id} in {self.leaderboard_ttl} seconds"
        )

    async def refresh_leaderboard_message(
        self, quiz: Quiz, session, new_content: str, new_keyboard=None
    ):
        """Refresh an existing leaderboard message instead of creating a new one"""
        if not self.bot or not quiz.leaderboard_message_id:
            return False

        try:
            chat_id = quiz.group_chat_id

            # Edit the existing message
            await self.bot.edit_message_text(
                chat_id=chat_id,
                message_id=quiz.leaderboard_message_id,
                text=new_content,
                reply_markup=new_keyboard,
                parse_mode="MarkdownV2",
            )

            logger.info(
                f"Refreshed leaderboard message {quiz.leaderboard_message_id} for quiz {quiz.id}"
            )
            return True

        except BadRequest as e:
            if "message is not modified" in str(e).lower():
                logger.info(
                    f"Leaderboard message {quiz.leaderboard_message_id} unchanged"
                )
                return True
            elif "message to edit not found" in str(e).lower():
                logger.info(
                    f"Leaderboard message {quiz.leaderboard_message_id} not found, will create new one"
                )
                # Clear the message ID so a new one can be created
                quiz.leaderboard_message_id = None
                quiz.leaderboard_deleted_at = datetime.now(timezone.utc)
                session.commit()
                return False
            else:
                logger.error(f"Error refreshing leaderboard message: {e}")
                return False
        except Exception as e:
            logger.error(f"Unexpected error refreshing leaderboard message: {e}")
            return False


# Global instance
cleanup_service = MessageCleanupService()


async def start_message_cleanup_service(application):
    """Start the message cleanup service as a background task"""
    # Create a background task instead of awaiting the infinite loop
    asyncio.create_task(cleanup_service.start_cleanup_loop(application))
    logger.info("Message cleanup service started as background task")


async def get_cleanup_service():
    """Get the global cleanup service instance"""
    return cleanup_service
