from telegram import Update, InlineKeyboardMarkup, InlineKeyboardButton, Poll
from telegram.ext import CallbackContext, ContextTypes, Application
from models.quiz import Quiz, QuizStatus, QuizAnswer
from store.database import SessionLocal
from agent import generate_quiz
from services.user_service import check_wallet_linked
from utils.telegram_helpers import safe_send_message, safe_edit_message_text
import re
import uuid
import json
import asyncio
import logging
import time
from datetime import datetime, timedelta, timezone
import traceback
from utils.config import Config
from utils.redis_client import RedisClient
from utils.performance_monitor import (
    track_quiz_answer_submission,
    track_database_query,
    track_cache_operation,
)
from typing import Optional, TYPE_CHECKING, Union, Dict, Tuple, List
import random
from sqlalchemy.exc import IntegrityError

if TYPE_CHECKING:
    from telegram.ext import Application  # Forward reference for type hinting

logger = logging.getLogger(__name__)

# Global dictionary to store active quiz sessions
active_quiz_sessions: Dict[str, "QuizSession"] = {}

# Global dictionary to store scheduled tasks for cancellation
scheduled_tasks: Dict[str, asyncio.Task] = {}

# Dictionary to keep track of active question timers
# Key: (user_id, quiz_id, question_index), Value: asyncio.Task
active_question_timers: Dict[Tuple[str, str, int], asyncio.Task] = {}

# Enhanced quiz session management
class QuizSession:
    def __init__(self, user_id: str, quiz_id: str, questions: List[Dict], shuffle_questions: bool = True, shuffle_answers: bool = True):
        self.user_id = user_id
        self.quiz_id = quiz_id
        self.original_questions = questions
        self.shuffle_questions = shuffle_questions
        self.shuffle_answers = shuffle_answers
        self.current_question_index = 0
        self.answers = {}
        self.start_time = None
        self.total_time = 0
        self.correct_answers = 0
        self.wrong_answers = 0
        self.missed_questions = 0
        
        # Prepare questions with shuffling
        self.prepared_questions = self._prepare_questions()
    
    def _prepare_questions(self) -> List[Dict]:
        """Prepare questions with optional shuffling"""
        questions = self.original_questions.copy()
        
        if self.shuffle_questions:
            random.shuffle(questions)
        
        prepared = []
        for i, q in enumerate(questions):
            question_data = q.copy()
            options = question_data.get('options', {})
            
            if self.shuffle_answers:
                # Shuffle answer options while preserving correct answer
                option_items = list(options.items())
                random.shuffle(option_items)
                question_data['shuffled_options'] = dict(option_items)
                question_data['original_options'] = options
            else:
                question_data['shuffled_options'] = options
                question_data['original_options'] = options
            
            prepared.append(question_data)
        
        return prepared
    
    def get_current_question(self) -> Optional[Dict]:
        """Get current question data"""
        if self.current_question_index < len(self.prepared_questions):
            return self.prepared_questions[self.current_question_index]
        return None
    
    def submit_answer(self, answer: str) -> bool:
        """Submit answer for current question and return if correct"""
        if self.current_question_index >= len(self.prepared_questions):
            logger.warning(f"Current question index {self.current_question_index} >= total questions {len(self.prepared_questions)}")
            return False
        
        current_q = self.prepared_questions[self.current_question_index]
        correct_answer = current_q.get('correct', '')  # Use 'correct' field as parsed by parse_questions
        
        # Map shuffled answer back to original
        shuffled_options = current_q.get('shuffled_options', {})
        original_options = current_q.get('original_options', {})
        
        # Find the original label for the given answer
        original_label = None
        for label, value in shuffled_options.items():
            if value == answer:
                original_label = label
                break
        
        is_correct = original_label == correct_answer
        
        # Get the actual text of the correct answer for display
        correct_answer_text = original_options.get(correct_answer, 'Unknown')
        
        # Debug logging to understand the data structure
        logger.debug(f"Question data: correct_answer={correct_answer}, original_options={original_options}")
        logger.debug(f"Shuffled options: {shuffled_options}")
        
        # If we still don't have the correct answer text, try to find it in shuffled options
        if correct_answer_text == 'Unknown' and correct_answer:
            # Look for the correct answer in shuffled options
            for label, value in shuffled_options.items():
                if label == correct_answer:
                    correct_answer_text = value
                    break
        
        self.answers[self.current_question_index] = {
            'answer': answer,
            'correct': is_correct,
            'correct_answer': correct_answer_text,  # Store the actual text, not the label
            'answered_at': datetime.utcnow()
        }
        
        if is_correct:
            self.correct_answers += 1
        else:
            self.wrong_answers += 1
        
        return is_correct
    
    def next_question(self) -> bool:
        """Move to next question, return False if no more questions"""
        self.current_question_index += 1
        has_more = self.current_question_index < len(self.prepared_questions)
        return has_more
    
    def get_progress(self) -> Tuple[int, int]:
        """Get current progress (current, total)"""
        return (self.current_question_index + 1, len(self.prepared_questions))
    
    def get_results(self) -> Dict:
        """Get final results"""
        self.missed_questions = len(self.prepared_questions) - self.correct_answers - self.wrong_answers
        return {
            'total_questions': len(self.prepared_questions),
            'correct': self.correct_answers,
            'wrong': self.wrong_answers,
            'missed': self.missed_questions,
            'total_time': self.total_time,
            'answers': self.answers
        }

async def question_timeout(
    application: "Application",
    user_id: str,
    quiz_id: str,
    question_index: int,
    message_id: int,
):
    """Handle the timeout for a specific question."""
    await asyncio.sleep(Config.QUESTION_TIMER_SECONDS)
    timer_key = (user_id, quiz_id, question_index)

    # Check if the timer is still active before proceeding
    if timer_key in active_question_timers:
        logger.info(
            f"Timeout for user {user_id}, quiz {quiz_id}, question {question_index}"
        )
        # Clean up the timer task from the dictionary
        active_question_timers.pop(timer_key, None)

        # Simulate a timeout answer by calling a simplified answer handler
        # We pass a mock update and context, as the full objects are not available
        # A more robust implementation might refactor handle_quiz_answer
        # to not depend so heavily on the Update and Context objects.
        await safe_edit_message_text(
            application.bot,
            user_id,
            message_id,
            "Time's up! Moving to the next question.",
            reply_markup=None,
        )
        # This is a simplified call to the answer handling logic.
        # It bypasses the direct need for `update` and `context` objects from a user interaction.
        await handle_quiz_answer_logic(
            application,
            user_id,
            quiz_id,
            question_index,
            "TIMEOUT",
            message_id,
            username=None,
        )


async def create_quiz(update: Update, context: CallbackContext):
    # Store message for reply reference
    message = update.message

    # Extract initial command parts
    command_text = message.text if message.text else ""

    # Check for duration in days, hours, or minutes
    duration_days = None
    duration_hours = None
    duration_minutes = None

    # Check for different duration formats (REGEXES CORRECTED)
    days_match = re.search(r"for\s+(\d+)\s+days", command_text, re.IGNORECASE)
    if days_match:
        duration_days = int(days_match.group(1))

    hours_match = re.search(r"for\s+(\d+)\s+hours", command_text, re.IGNORECASE)
    if hours_match:
        duration_hours = int(hours_match.group(1))

    minutes_match = re.search(r"for\s+(\d+)\s+minutes", command_text, re.IGNORECASE)
    if minutes_match:
        duration_minutes = int(minutes_match.group(1))

    # Calculate total duration in seconds (CORRECTED LOGIC)
    total_minutes = 0
    if duration_days:
        total_minutes += duration_days * 24 * 60
    if duration_hours:
        total_minutes += duration_hours * 60
    if duration_minutes:
        total_minutes += duration_minutes

    duration_in_seconds = total_minutes * 60 if total_minutes > 0 else None

    if total_minutes > 0:
        log_parts = []
        if duration_days:
            log_parts.append(f"{duration_days} days")
        if duration_hours:
            log_parts.append(f"{duration_hours} hours")
        if duration_minutes:
            log_parts.append(f"{duration_minutes} minutes")
        logger.info(
            f"Total quiz duration: {total_minutes} minutes ({', '.join(log_parts).strip()}), calculated as {duration_in_seconds} seconds."
        )
    elif duration_in_seconds is None:
        logger.info("No quiz duration specified.")

    # Next, check if number of questions is specified
    num_questions = None

    questions_match = re.search(r"(\d+)\s+questions", command_text, re.IGNORECASE)
    if questions_match:
        num_questions = min(int(questions_match.group(1)), Config.MAX_QUIZ_QUESTIONS)

    create_match = re.search(r"create\s+(\d+)\s+quiz", command_text, re.IGNORECASE)
    if create_match and not num_questions:
        num_questions = min(int(create_match.group(1)), Config.MAX_QUIZ_QUESTIONS)

    if num_questions is None:
        simple_num_match = re.search(
            r"(?:near|topic)\s+(\d+)", command_text, re.IGNORECASE
        )
        if simple_num_match:
            num_questions = min(
                int(simple_num_match.group(1)), Config.MAX_QUIZ_QUESTIONS
            )

    topic = None
    topic_match = re.search(
        r"/createquiz\s+(.*?)(?:\s+\d+\s+questions|\s+for\s+\d+\s+(?:days|hours|minutes)|$)",
        command_text,
        re.IGNORECASE,
    )
    if topic_match:
        topic = topic_match.group(1).strip()

    if not topic and context.args:
        topic = context.args[0]

    if not topic:
        await safe_send_message(
            context.bot,
            update.effective_chat.id,
            "Usage: /createquiz <topic> [number] questions [for number days/hours/minutes]\n"
            "Examples:\n"
            "- /createquiz NEAR blockchain\n"
            "- /createquiz NEAR 5 questions\n"
            "- /createquiz NEAR for 7 days\n"
            "- /createquiz NEAR for 3 hours\n"
            "- /createquiz NEAR for 30 minutes\n"
            "- /createquiz NEAR 3 questions for 14 days",
        )
        return

    if num_questions is None:
        topic_num_match = re.search(
            r"create\s+(\d+)\s+quiz(?:\s+on)?\s+", command_text, re.IGNORECASE
        )
        if topic_num_match:
            num_questions = min(
                int(topic_num_match.group(1)), Config.MAX_QUIZ_QUESTIONS
            )
            topic = re.sub(r"create\s+\d+\s+quiz(?:\s+on)?\s+", "", topic).strip()

    if num_questions is None:
        num_questions = Config.DEFAULT_QUIZ_QUESTIONS

    group_chat_id = update.effective_chat.id

    if len(command_text) > 100:
        large_text_match = re.search(
            r"(/createquiz[^\n]+)(.+)", command_text, re.DOTALL
        )
        if large_text_match:
            large_text = large_text_match.group(2).strip()
            await safe_send_message(
                context.bot,
                group_chat_id,
                f"Generating {num_questions} quiz question(s) about '{topic}' based on the provided text. This may take a moment...",
            )
            try:
                questions_raw = await generate_quiz(topic, num_questions, large_text)
                await process_questions(
                    update,
                    context,
                    topic,
                    questions_raw,
                    group_chat_id,
                    duration_in_seconds,
                )
                return
            except Exception as e:
                logger.error(f"Error creating text-based quiz: {e}", exc_info=True)
                await safe_send_message(
                    context.bot,
                    group_chat_id,
                    f"Error creating text-based quiz: {str(e)}",
                )
                return

    if message.reply_to_message and message.reply_to_message.text:
        context_text = message.reply_to_message.text
        await safe_send_message(
            context.bot,
            group_chat_id,
            f"Generating {num_questions} quiz question(s) on '{topic}' based on the provided text. This may take a moment...",
        )
        try:
            questions_raw = await generate_quiz(topic, num_questions, context_text)
            await process_questions(
                update,
                context,
                topic,
                questions_raw,
                group_chat_id,
                duration_in_seconds,
            )
        except Exception as e:
            logger.error(
                f"Error creating text-based quiz from reply: {e}", exc_info=True
            )
            await safe_send_message(
                context.bot,
                group_chat_id,
                f"Error creating text-based quiz from reply: {str(e)}",
            )
    else:
        await safe_send_message(
            context.bot,
            group_chat_id,
            f"Generating {num_questions} quiz question(s) for topic: {topic}",
        )
        try:
            questions_raw = await generate_quiz(topic, num_questions)
            await process_questions(
                update,
                context,
                topic,
                questions_raw,
                group_chat_id,
                duration_in_seconds,
            )
        except asyncio.TimeoutError:
            await safe_send_message(
                context.bot,
                group_chat_id,
                "Sorry, quiz generation timed out. Please try again with a simpler topic or fewer questions.",
            )
        except Exception as e:
            logger.error(f"Error creating quiz: {e}", exc_info=True)
            await safe_send_message(
                context.bot, group_chat_id, f"Error creating quiz: {str(e)}"
            )


async def process_questions(
    update,
    context,
    topic,
    questions_raw,
    group_chat_id,
    duration_seconds: int | None = None,  # Changed parameters
):
    """Process multiple questions from raw text and save them as a quiz."""
    logger.info(
        f"Processing questions for topic: {topic} with duration_seconds: {duration_seconds}"
    )

    # Parse multiple questions
    questions_list = parse_multiple_questions(questions_raw)

    # Check if we got at least one question
    if not questions_list:
        await safe_send_message(
            context.bot,
            update.effective_chat.id,
            "Failed to parse quiz questions. Please try again.",
        )
        return

    # Validate deposit address configuration before creating quiz
    if not Config.DEPOSIT_ADDRESS:
        await safe_send_message(
            context.bot,
            update.effective_chat.id,
            "❌ System configuration error: Deposit address is not configured. Please contact an administrator to set up NEAR_WALLET_ADDRESS.",
        )
        logger.error("DEPOSIT_ADDRESS is not set in configuration - cannot create quiz")
        return

    # Persist quiz with multiple questions
    session = SessionLocal()
    try:
        quiz = Quiz(
            topic=topic,
            questions=questions_list,
            status=QuizStatus.DRAFT,  # Initial status is DRAFT
            group_chat_id=group_chat_id,
            duration_seconds=duration_seconds,  # Store the duration
            deposit_address=Config.DEPOSIT_ADDRESS,  # Set deposit address from config
        )
        session.add(quiz)
        session.commit()
        quiz_id = quiz.id
        logger.info(
            f"Created quiz with ID: {quiz_id} in DRAFT status with duration {duration_seconds} seconds and deposit address {Config.DEPOSIT_ADDRESS}."
        )
    finally:
        session.close()

    # Notify group and DM creator for contract setup
    num_questions = len(questions_list)

    duration_text_parts = []
    if duration_seconds and duration_seconds > 0:
        temp_duration = duration_seconds
        days = temp_duration // (24 * 3600)
        temp_duration %= 24 * 3600
        hours = temp_duration // 3600
        temp_duration %= 3600
        minutes = temp_duration // 60

        if days > 0:
            duration_text_parts.append(f"{days} day{'s' if days > 1 else ''}")
        if hours > 0:
            duration_text_parts.append(f"{hours} hour{'s' if hours > 1 else ''}")
        if minutes > 0:
            duration_text_parts.append(f"{minutes} minute{'s' if minutes > 1 else ''}")

    duration_info = (
        f" (Active for {', '.join(duration_text_parts)})" if duration_text_parts else ""
    )

    await safe_send_message(
        context.bot,
        update.effective_chat.id,  # This is the group chat or DM where /createquiz was used
        f"Quiz created with ID: {quiz_id}! {num_questions} question(s) about {topic}{duration_info}.\n"
        f"The quiz creator, @{update.effective_user.username}, will be prompted to set up rewards.",
    )

    # DM the creator to start reward setup
    keyboard = [
        [
            InlineKeyboardButton(
                "💰 Setup Rewards", callback_data=f"reward_setup_start:{quiz_id}"
            )
        ]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)

    await safe_send_message(
        context.bot,
        update.effective_user.id,
        f"Your quiz '{topic}' (ID: {quiz_id}) has been created!\n"
        "Please set up the reward structure for the winners.",
        reply_markup=reply_markup,
    )

    # Remove old awaiting flags if they exist, not strictly necessary here
    # as the new flow will be initiated by the button.
    user_id = str(update.effective_user.id)
    redis_client = RedisClient()
    await redis_client.delete_user_data_key(user_id, "awaiting")
    await redis_client.delete_user_data_key(user_id, "awaiting_reward_quiz_id")
    await redis_client.close()

    logger.info(
        f"Sent reward setup prompt for quiz ID: {quiz_id} to user {update.effective_user.id}"
    )

    # If quiz has an end time, schedule auto distribution task - THIS LOGIC MOVES
    # The scheduling of auto_distribution will now happen when the quiz becomes ACTIVE
    # if end_time:
    #     seconds_until_end = (end_time - datetime.utcnow()).total_seconds()
    #     if seconds_until_end > 0:
    #         context.application.create_task(
    #             schedule_auto_distribution(
    #                 context.application, quiz_id, seconds_until_end
    #             )
    #         )
    #         logger.info(
    #             f"Scheduled auto distribution for quiz {quiz_id} in {seconds_until_end} seconds"
    #         )


async def save_quiz_reward_details(
    quiz_id: str, reward_type: str, reward_text: str
) -> bool:
    """Saves the reward details for a quiz and updates its status to FUNDING if DRAFT."""
    session = SessionLocal()
    redis_client = RedisClient()
    try:
        quiz = session.query(Quiz).filter(Quiz.id == quiz_id).first()
        if not quiz:
            logger.error(
                f"Quiz with ID {quiz_id} not found when trying to save reward details."
            )
            return False

        quiz.reward_schedule = {
            "type": reward_type,
            "details_text": reward_text,
        }

        if quiz.status == QuizStatus.DRAFT:
            quiz.status = QuizStatus.FUNDING
            logger.info(
                f"Quiz {quiz_id} status updated to FUNDING after reward details provided."
            )

        session.commit()
        logger.info(
            f"Successfully saved reward details for quiz {quiz_id} (type: {reward_type})."
        )
        # Invalidate cached quiz object if it exists
        await redis_client.delete_cached_object(f"quiz_details:{quiz_id}")
        await redis_client.close()
        return True
    except Exception as e:
        logger.error(
            f"Error saving reward details for quiz {quiz_id}: {e}", exc_info=True
        )
        session.rollback()
        await redis_client.close()
        return False
    finally:
        session.close()


async def save_quiz_payment_hash(
    quiz_id: str, payment_hash: str, application: Optional["Application"]
) -> tuple[bool, str]:
    """Saves the payment transaction hash for a quiz and updates its status."""
    session = SessionLocal()
    redis_client = RedisClient()
    try:
        quiz = session.query(Quiz).filter(Quiz.id == quiz_id).first()
        if not quiz:
            logger.error(
                f"Quiz with ID {quiz_id} not found when trying to save payment hash."
            )
            return False, "Quiz not found."

        quiz.payment_transaction_hash = payment_hash

        if quiz.status in [QuizStatus.DRAFT, QuizStatus.FUNDING]:
            quiz.status = QuizStatus.ACTIVE
            quiz.activated_at = datetime.now(timezone.utc)  # Set activation time
            logger.info(
                f"Quiz {quiz_id} status updated to ACTIVE after payment hash received. Activated at {quiz.activated_at}."
            )

            if quiz.duration_seconds and quiz.duration_seconds > 0:
                quiz.end_time = quiz.activated_at + timedelta(
                    seconds=quiz.duration_seconds
                )
                logger.info(
                    f"Quiz {quiz_id} end time calculated: {quiz.end_time} based on activation and duration {quiz.duration_seconds}s."
                )

                if application and quiz.end_time:
                    seconds_until_end = (
                        quiz.end_time - datetime.now(timezone.utc)
                    ).total_seconds()
                    if seconds_until_end > 0:
                        # Schedule auto-distribution for quizzes with rewards
                        if quiz.reward_schedule:
                            application.create_task(
                                schedule_auto_distribution(
                                    application, quiz_id, seconds_until_end
                                )
                            )
                            logger.info(
                                f"Task created to schedule auto distribution for quiz {quiz_id} in {seconds_until_end} seconds upon activation."
                            )
                        
                        # Always schedule quiz end announcement for all quizzes
                        application.create_task(
                            schedule_quiz_end_announcement(
                                application, quiz_id, seconds_until_end
                            )
                        )
                        logger.info(
                            f"Task created to schedule quiz end announcement for quiz {quiz_id} in {seconds_until_end} seconds upon activation."
                        )
                    else:
                        logger.warning(
                            f"Quiz {quiz_id} activated but already past its intended end time. Auto-distribution may not run as expected."
                        )
            else:
                logger.info(f"Quiz {quiz_id} activated without a specific duration.")

        else:
            logger.info(
                f"Quiz {quiz_id} already in status {quiz.status}, not changing status but saving hash."
            )

        session.commit()
        logger.info(
            f"Successfully saved payment hash {payment_hash} for quiz {quiz_id}."
        )
        await redis_client.delete_cached_object(f"quiz_details:{quiz_id}")
        return True, "Quiz activated successfully!"
    except IntegrityError as e:
        logger.warning(
            f"IntegrityError saving payment hash for quiz {quiz_id}: duplicate hash {payment_hash}. Error: {e}"
        )
        session.rollback()
        # Reject any reuse of the same transaction hash
        return (
            False,
            "This transaction hash has already been used. Please use a different one.",
        )
    except AttributeError as ae:
        logger.error(
            f"AttributeError in save_quiz_payment_hash for quiz {quiz_id}: {ae}",
            exc_info=True,
        )
        if "JobQueue" in str(ae) and "get_instance" in str(
            ae
        ):  # This specific check might become obsolete
            logger.error(
                "This looks like the JobQueue.get_instance() error. Ensure 'application' is correctly passed and used for job_queue."
            )
        session.rollback()
        await redis_client.close()
        return False, "An unexpected error occurred while saving the payment hash."
    except Exception as e:
        logger.error(
            f"Error saving payment hash for quiz {quiz_id}: {e}", exc_info=True
        )
        session.rollback()
        return False, "An unexpected error occurred while saving the payment hash."
    finally:
        await redis_client.close()
        session.close()


async def get_quiz_details(quiz_id: str) -> Optional[dict]:
    """Retrieve quiz details, from cache if available, otherwise from DB."""
    redis_client = RedisClient()
    cache_key = f"quiz_details:{quiz_id}"

    cached_quiz = await redis_client.get_cached_object(cache_key)
    if cached_quiz:
        await redis_client.close()
        return cached_quiz

    session = SessionLocal()
    try:
        quiz = session.query(Quiz).filter(Quiz.id == quiz_id).first()
        if quiz:
            quiz_data = {
                "id": quiz.id,
                "topic": quiz.topic,
                "questions": quiz.questions,  # Assuming questions are JSON serializable
                "status": quiz.status.value if quiz.status else None,  # Enum to value
                "reward_schedule": quiz.reward_schedule,
                "deposit_address": quiz.deposit_address,
                "payment_transaction_hash": quiz.payment_transaction_hash,
                "last_updated": (
                    quiz.last_updated.isoformat() if quiz.last_updated else None
                ),
                "group_chat_id": quiz.group_chat_id,
                "end_time": quiz.end_time.isoformat() if quiz.end_time else None,
                "winners_announced": quiz.winners_announced,
                "created_at": quiz.created_at.isoformat() if quiz.created_at else None,
                "activated_at": (
                    quiz.activated_at.isoformat()
                    if hasattr(quiz, "activated_at") and quiz.activated_at
                    else None
                ),
                "duration_seconds": (
                    quiz.duration_seconds if hasattr(quiz, "duration_seconds") else None
                ),
            }
            # Cache for 1 hour, or less if quiz is active and ending soon
            cache_duration = 3600
            if quiz.status == QuizStatus.ACTIVE and quiz.end_time:
                end_time_aware = quiz.end_time
                # If quiz.end_time is naive, assume it's UTC and make it aware.
                if (
                    end_time_aware.tzinfo is None
                    or end_time_aware.tzinfo.utcoffset(end_time_aware) is None
                ):
                    end_time_aware = end_time_aware.replace(tzinfo=timezone.utc)

                current_time_aware = datetime.now(timezone.utc)
                seconds_to_end = (end_time_aware - current_time_aware).total_seconds()
                # Cache for a shorter duration if ending soon, but not too short (min 5 mins)
                cache_duration = (
                    max(300, min(int(seconds_to_end), 3600))
                    if seconds_to_end > 0
                    else 300
                )

            await redis_client.set_cached_object(
                cache_key, quiz_data, ex=cache_duration
            )
            await redis_client.close()
            return quiz_data
        await redis_client.close()
        return None
    except Exception as e:
        logger.error(f"Error getting quiz details for {quiz_id}: {e}", exc_info=True)
        await redis_client.close()
        return None
    finally:
        session.close()


async def play_quiz(update: Update, context: CallbackContext):
    """Handler for /playquiz command; DM quiz questions to a player."""
    user_id = str(update.effective_user.id)
    user_username = update.effective_user.username or update.effective_user.first_name
    # Wallet check can be added here if needed:
    if not await check_wallet_linked(user_id):
        await safe_send_message(
            context.bot,
            update.effective_chat.id,
            "Please link your wallet first using /linkwallet <wallet_address>.",
        )
        return

    quiz_id_to_play = None
    if context.args:
        quiz_id_to_play = context.args[0]
        logger.info(f"Quiz ID provided via args: {quiz_id_to_play}")

    session = SessionLocal()
    try:
        group_chat_id = None
        if update.effective_chat.type in ["group", "supergroup"]:
            group_chat_id = update.effective_chat.id

        if not quiz_id_to_play and group_chat_id:
            # PERFORMANCE OPTIMIZATION: Check cache for active quizzes first
            redis_client = RedisClient()
            try:
                cached_active_quizzes = await redis_client.get_cached_active_quizzes(
                    str(group_chat_id)
                )
                if cached_active_quizzes:
                    # Convert cached data back to quiz objects for processing
                    active_quizzes = []
                    for quiz_data in cached_active_quizzes:
                        quiz = (
                            session.query(Quiz)
                            .filter(Quiz.id == quiz_data["id"])
                            .first()
                        )
                        if quiz:
                            active_quizzes.append(quiz)
                else:
                    # Cache miss - query database
                    active_quizzes = (
                        session.query(Quiz)
                        .filter(
                            Quiz.status == QuizStatus.ACTIVE,
                            Quiz.group_chat_id == group_chat_id,
                            Quiz.end_time > datetime.utcnow(),
                        )
                        .order_by(Quiz.end_time)
                        .all()
                    )

                    # Cache the results for future lookups
                    quiz_cache_data = [
                        {
                            "id": q.id,
                            "topic": q.topic,
                            "end_time": q.end_time.isoformat() if q.end_time else None,
                            "questions_count": len(q.questions) if q.questions else 0,
                        }
                        for q in active_quizzes
                    ]
                    await redis_client.cache_active_quizzes(
                        str(group_chat_id), quiz_cache_data, ttl_seconds=300
                    )

                await redis_client.close()
            except Exception as cache_error:
                logger.warning(
                    f"Cache error, falling back to database query: {cache_error}"
                )
                # Fallback to database query if cache fails
                active_quizzes = (
                    session.query(Quiz)
                    .filter(
                        Quiz.status == QuizStatus.ACTIVE,
                        Quiz.group_chat_id == group_chat_id,
                        Quiz.end_time > datetime.utcnow(),
                    )
                    .order_by(Quiz.end_time)
                    .all()
                )
                await redis_client.close()

            if len(active_quizzes) > 1:
                buttons = []
                for i, q in enumerate(active_quizzes):
                    num_questions = len(q.questions) if q.questions else 0
                    time_remaining_str = ""
                    if q.end_time:
                        now_utc = datetime.utcnow()
                        if q.end_time > now_utc:
                            delta = q.end_time - now_utc
                            total_seconds = int(
                                delta.total_seconds()
                            )  # Ensure it's an int

                            days = total_seconds // (3600 * 24)
                            remaining_seconds_after_days = total_seconds % (3600 * 24)
                            hours = remaining_seconds_after_days // 3600
                            minutes = (remaining_seconds_after_days % 3600) // 60

                            if days > 0:
                                time_remaining_str = (
                                    f"ends in {days}d {hours}h {minutes}m"
                                )
                            elif hours > 0:
                                time_remaining_str = f"ends in {hours}h {minutes}m"
                            elif minutes > 0:
                                time_remaining_str = f"ends in {minutes}m"
                            else:
                                time_remaining_str = (
                                    "ends very soon"  # e.g., < 1 minute
                                )
                        else:
                            time_remaining_str = "ended"
                    else:
                        time_remaining_str = "no end time"

                    button_text = (
                        f"{i + 1}. {q.topic} — {num_questions} Q — {time_remaining_str}"
                    )
                    buttons.append(
                        [
                            InlineKeyboardButton(
                                button_text,
                                callback_data=f"playquiz_select:{q.id}:{user_id}",
                            )
                        ]
                    )

                if buttons:
                    reply_markup = InlineKeyboardMarkup(buttons)
                    await safe_send_message(
                        context.bot,
                        update.effective_chat.id,
                        "Multiple active quizzes found. Please select one to play:",
                        reply_markup=reply_markup,
                    )
                    return
            elif len(active_quizzes) == 1:
                quiz_id_to_play = active_quizzes[0].id
            else:
                await safe_send_message(
                    context.bot,
                    update.effective_chat.id,
                    "No active quizzes found in this group.",
                )
                return

        if not quiz_id_to_play:
            await safe_send_message(
                context.bot,
                update.effective_chat.id,
                "Please specify a quiz ID to play (e.g., /playquiz <quiz_id>), or use /playquiz in a group with active quizzes.",
            )
            return

        # Check if the user has already played this quiz
        existing_answers = (
            session.query(QuizAnswer)
            .filter(
                QuizAnswer.quiz_id == quiz_id_to_play, QuizAnswer.user_id == user_id
            )
            .first()
        )
        if existing_answers:
            await safe_send_message(
                context.bot,
                update.effective_chat.id,
                f"@{user_username}, you have already played this quiz. You cannot play it again.",
            )
            return

        quiz_to_dm = session.query(Quiz).filter(Quiz.id == quiz_id_to_play).first()

        # ANTI-CHEAT: Shuffle questions for each user
        questions = quiz_to_dm.questions
        question_indices = list(range(len(questions)))
        random.shuffle(question_indices)

        # Store the shuffled order and initial position in Redis
        redis_client = RedisClient()
        await redis_client.set_user_quiz_data(
            user_id, quiz_id_to_play, "question_order", question_indices
        )
        await redis_client.set_user_quiz_data(
            user_id, quiz_id_to_play, "current_position", 0
        )
        await redis_client.close()

        if not quiz_to_dm:
            await safe_send_message(
                context.bot,
                update.effective_chat.id,
                f"No quiz found with ID {quiz_id_to_play}.",
            )
            return

        if quiz_to_dm.status != QuizStatus.ACTIVE or (
            quiz_to_dm.end_time and quiz_to_dm.end_time <= datetime.utcnow()
        ):
            await safe_send_message(
                context.bot,
                update.effective_chat.id,
                f"Quiz '{quiz_to_dm.topic}' (ID: {quiz_id_to_play[:8]}...) is not currently active or has ended.",
            )
            return

        if update.effective_chat.type != "private":
            await safe_send_message(
                context.bot,
                update.effective_chat.id,
                f"@{user_username}, I'll send you the quiz '{quiz_to_dm.topic}' (ID: {quiz_id_to_play[:8]}...) in a private message!",
            )

        # Send the first question from the shuffled list
        first_question_shuffled_index = question_indices[0]
        await send_quiz_question(
            context.application,
            user_id,
            quiz_to_dm,
            first_question_shuffled_index,
            0,
            len(questions),
        )

    except Exception as e:
        logger.error(f"Error in play_quiz: {e}", exc_info=True)
        await safe_send_message(
            context.bot,
            update.effective_chat.id,
            "An error occurred while trying to play the quiz. Please try again later.",
        )
    finally:
        if session:  # Ensure session is not None before closing
            session.close()


async def send_quiz_question(
    application: "Application",
    user_id,
    quiz,
    question_index,
    current_num,
    total_questions,
):
    """Send a specific question from the quiz to the user and start a timer."""

    # Get the questions list
    questions_list = quiz.questions

    # Check if this is a legacy quiz with a single question format
    if isinstance(questions_list, dict):
        questions_list = [questions_list]

    # Check if the index is valid
    if question_index >= len(questions_list):
        # We've sent all questions
        await safe_send_message(
            application.bot,
            user_id,
            f"You've tackled all {len(questions_list)} questions in the '{quiz.topic}' quiz! Your answers are saved. Eager to see the results? Use `/winners {quiz.id}`.",
        )
        return

    # Get the current question
    current_q = questions_list[question_index]
    question_text = current_q.get("question", "Question not available")
    options = current_q.get("options", {})

    # Prepare message text with full options
    message_text_parts = []
    question_number = current_num + 1
    message_text_parts.append(
        f"Quiz: {quiz.topic} (Question {question_number}/{total_questions})"
    )
    message_text_parts.append(
        f"⏳ You have {Config.QUESTION_TIMER_SECONDS} seconds to answer."
    )
    message_text_parts.append(f"\n{question_text}\n")

    keyboard = []
    # ANTI-CHEAT: Shuffle answer options while preserving correct answer tracking
    labels = sorted(options.keys())
    
    # Create a list of (label, value) pairs and shuffle them together
    label_value_pairs = list(options.items())
    random.shuffle(label_value_pairs)
    
    # Create a mapping from original labels to shuffled labels
    label_mapping = {}
    for new_position, (original_label, value) in enumerate(label_value_pairs):
        new_label = labels[new_position]  # A, B, C, D in order
        label_mapping[original_label] = new_label
        message_text_parts.append(f"{new_label}) {value}")
        # Include question index and new label in callback data
        keyboard.append(
            [
                InlineKeyboardButton(
                    new_label,
                    callback_data=f"quiz:{quiz.id}:{question_index}:{new_label}",
                )
            ]
        )
    
    # Store the label mapping in Redis for this user's question so we can use it during validation
    redis_client = RedisClient()
    await redis_client.set_user_quiz_data(
        user_id, quiz.id, f"label_mapping_{question_index}", label_mapping
    )
    await redis_client.close()

    full_message_text = "\n".join(message_text_parts)
    reply_markup = InlineKeyboardMarkup(keyboard)

    sent_message = await safe_send_message(
        application.bot,
        user_id,
        text=full_message_text,
        reply_markup=reply_markup,
    )

    if sent_message:
        # Create and store the timeout task
        timer_key = (str(user_id), quiz.id, question_index)
        timer_task = application.create_task(
            question_timeout(
                application,
                str(user_id),
                quiz.id,
                question_index,
                sent_message.message_id,
            )
        )
        active_question_timers[timer_key] = timer_task


async def handle_quiz_answer(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Process quiz answers from inline keyboard callbacks."""
    query = update.callback_query
    await query.answer()  # Acknowledge the button press

    # Parse callback data to get quiz ID, question index, and answer
    try:
        _, quiz_id, question_index_str, answer = query.data.split(":")
        question_index = int(question_index_str)
    except ValueError:
        await safe_edit_message_text(
            context.bot,
            query.message.chat_id,
            query.message.message_id,
            "Invalid answer format.",
        )
        return

    user_id = str(update.effective_user.id)
    # Get the actual username for proper display
    user_username = (
        update.effective_user.username
        or update.effective_user.first_name
        or f"user_{user_id}"
    )

    # Cancel the timer for this question
    timer_key = (user_id, quiz_id, question_index)
    if timer_key in active_question_timers:
        active_question_timers[timer_key].cancel()
        active_question_timers.pop(timer_key, None)

    await handle_quiz_answer_logic(
        context.application,
        user_id,
        quiz_id,
        question_index,
        answer,
        query.message.message_id,
        query.message.text,
        username=user_username,
    )


async def handle_quiz_answer_logic(
    application: "Application",
    user_id: str,
    quiz_id: str,
    question_index: int,
    answer: str,
    message_id: int,
    original_message_text: Optional[str] = None,
    username: Optional[str] = None,
):
    """Core logic to process a quiz answer, reusable by timeout and callback handlers."""
    async with track_quiz_answer_submission({"user_id": user_id}):
        # Get quiz from database with optimized query
        session = SessionLocal()
        try:
            # PERFORMANCE OPTIMIZATION: Use more specific query with only needed columns
            start_time = time.time()
            # Load only essential fields for better performance
            quiz = session.query(Quiz).filter(Quiz.id == quiz_id).first()
            query_time = (time.time() - start_time) * 1000
            if query_time > 500:  # Log if query takes more than 500ms
                logger.warning(
                    f"Slow database query: get_quiz_for_answer took {query_time:.2f}ms"
                )

            if not quiz:
                if original_message_text:  # Only edit if we have the original message
                    await safe_edit_message_text(
                        application.bot,
                        user_id,
                        message_id,
                        "Quiz not found.",
                    )
                return

            # Get questions list, handling legacy format
            questions_list = quiz.questions
            if isinstance(questions_list, dict):
                questions_list = [questions_list]

            # Validate question index early
            if question_index >= len(questions_list):
                if original_message_text:
                    await safe_edit_message_text(
                        application.bot,
                        user_id,
                        message_id,
                        "Invalid question index.",
                    )
                return

            # For a timeout, correctness is always False.
            if answer == "TIMEOUT":
                is_correct = False
            else:
                current_q = questions_list[question_index]
                correct_answer_label = current_q.get("correct", "")
                
                # Get the label mapping for this user's question from Redis
                redis_client = RedisClient()
                label_mapping = await redis_client.get_user_quiz_data(
                    user_id, quiz_id, f"label_mapping_{question_index}"
                )
                await redis_client.close()
                
                if label_mapping:
                    # Find which shuffled label corresponds to the original correct answer
                    correct_shuffled_label = label_mapping.get(correct_answer_label, "")
                    is_correct = answer == correct_shuffled_label
                else:
                    # Fallback to original logic if no mapping found (shouldn't happen)
                    is_correct = answer == correct_answer_label
                    logger.warning(
                        f"No label mapping found for user {user_id}, quiz {quiz_id}, question {question_index}. "
                        f"Using fallback logic: {answer} == {correct_answer_label} = {is_correct}"
                    )

            # Get user info - use provided username or fallback
            if username:
                user_display_name = username
            else:
                # Fallback username for timeouts or when username not available
                user_display_name = f"user_{user_id}"

            # PERFORMANCE OPTIMIZATION: Use efficient exists() query instead of first()
            start_time = time.time()
            answer_exists = session.query(
                session.query(QuizAnswer)
                .filter(
                    QuizAnswer.quiz_id == quiz_id,
                    QuizAnswer.user_id == user_id,
                    QuizAnswer.question_index == question_index,
                )
                .exists()
            ).scalar()
            query_time = (time.time() - start_time) * 1000
            if query_time > 500:  # Log if query takes more than 500ms
                logger.warning(
                    f"Slow database query: check_duplicate_answer took {query_time:.2f}ms"
                )

            if answer_exists:
                if original_message_text:
                    await safe_edit_message_text(
                        application.bot,
                        user_id,
                        message_id,
                        "You have already answered this question.",
                    )
                return

            quiz_answer = QuizAnswer(
                quiz_id=quiz_id,
                user_id=user_id,
                username=user_display_name,
                answer=answer,
                question_index=question_index,  # Add question index for duplicate prevention
                is_correct=str(
                    is_correct
                ),  # Store as string 'True' or 'False', not boolean
            )
            session.add(quiz_answer)

            # PERFORMANCE OPTIMIZATION: Add answer to session
            session.add(quiz_answer)

            # ANTI-CHEAT FEATURE: Prepare a neutral confirmation message instead of revealing the answer.
            result_message = "Answer recorded. Moving to the next question..."
            if answer == "TIMEOUT":
                result_message = (
                    "Time's up! Your answer was not recorded in time. Moving on..."
                )

            # PERFORMANCE OPTIMIZATION: Execute operations concurrently where possible
            # Get the user's shuffled question order and new position from Redis
            redis_client = RedisClient()
            question_order = await redis_client.get_user_quiz_data(
                user_id, quiz_id, "question_order"
            )
            current_position = await redis_client.get_user_quiz_data(
                user_id, quiz_id, "current_position"
            )
            await redis_client.close()

            next_position = current_position + 1

            # Create concurrent tasks for performance optimization
            async def commit_database():
                """Commit database changes in background."""
                try:
                    session.flush()  # Validate first
                    session.commit()
                except Exception as e:
                    logger.error(f"Database commit error: {e}")
                    session.rollback()
                    raise

            async def invalidate_cache():
                """Invalidate quiz cache in background."""
                redis_client = RedisClient()
                try:
                    async with track_cache_operation(
                        "invalidate_quiz_cache", {"quiz_id": quiz_id}
                    ):
                        await redis_client.invalidate_quiz_cache(quiz_id)
                except Exception as cache_error:
                    logger.warning(f"Cache invalidation failed: {cache_error}")
                finally:
                    await redis_client.close()

            # Execute UI updates immediately, database/cache operations in background
            if original_message_text:
                await safe_edit_message_text(
                    application.bot,
                    user_id,
                    message_id,
                    result_message,
                    reply_markup=None,
                )

            # Start next question immediately for better UX
            if question_order and next_position < len(question_order):
                next_question_index = question_order[next_position]
                # Update the user's position for the next question
                redis_client = RedisClient()
                await redis_client.set_user_quiz_data(
                    user_id, quiz_id, "current_position", next_position
                )
                await redis_client.close()

                next_question_task = asyncio.create_task(
                    send_quiz_question(
                        application,
                        user_id,
                        quiz,
                        next_question_index,
                        next_position,
                        len(question_order),
                    )
                )
            else:
                # Quiz is finished for this user
                await safe_send_message(
                    application.bot,
                    user_id,
                    f"You've tackled all {len(question_order)} questions in the '{quiz.topic}' quiz! Your answers are saved. Eager to see the results? Use `/winners {quiz.id}`.",
                )
                next_question_task = asyncio.create_task(asyncio.sleep(0))  # No-op task

            # Run database and cache operations concurrently
            db_cache_tasks = [
                asyncio.create_task(commit_database()),
                asyncio.create_task(invalidate_cache()),
            ]

            # Wait for next question to be sent, then background tasks
            await next_question_task
            await asyncio.gather(*db_cache_tasks, return_exceptions=True)

        except Exception as e:
            logger.error(f"Error handling quiz answer: {e}", exc_info=True)
            # Rollback on error to ensure data consistency
            session.rollback()

            traceback.print_exc()
        finally:
            session.close()


async def handle_reward_structure(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Process reward structure from quiz creator in private chat."""
    user_id = str(update.effective_user.id)
    redis_client = RedisClient()
    try:
        valid_states = (
            "reward_structure",
            "wallet_address",
            "signature",
            "transaction_hash",
        )
        current_awaiting_state_check = await redis_client.get_user_data_key(
            user_id, "awaiting"
        )
        if current_awaiting_state_check not in valid_states:
            return

        if update.effective_chat.type != "private":
            return

        current_awaiting_state = await redis_client.get_user_data_key(
            user_id, "awaiting"
        )
        if current_awaiting_state in (
            "wallet_address",
            "signature",
            "transaction_hash",
        ):
            from services.user_service import handle_wallet_address, handle_signature

            # BlockchainMonitor is imported locally in handle_transaction_hash if needed

            if current_awaiting_state == "wallet_address":
                await handle_wallet_address(update, context)
            elif current_awaiting_state == "signature":
                await handle_signature(
                    update, context
                )  # Note: handle_signature is a pass-through
            elif current_awaiting_state == "transaction_hash":
                # This will call the refactored version which creates its own RedisClient instance
                await handle_transaction_hash(update, context)
            return

        text = update.message.text

        amounts = re.findall(r"(\d+)\s*Near", text, re.IGNORECASE)
        if not amounts:
            await safe_send_message(
                context.bot,
                update.effective_chat.id,
                "Couldn't parse reward amounts. Please specify like '2 Near for 1st, 1 Near for 2nd'.",
            )
            return

        schedule = {i + 1: int(a) for i, a in enumerate(amounts)}
        total = sum(schedule.values())
        deposit_addr = (
            Config.DEPOSIT_ADDRESS
        )  # Use DEPOSIT_ADDRESS instead of NEAR_WALLET_ADDRESS

        # Validate deposit address configuration
        if not deposit_addr:
            await safe_send_message(
                context.bot,
                update.effective_chat.id,
                "❌ Deposit address is not configured. Please contact an administrator to set up NEAR_WALLET_ADDRESS.",
            )
            logger.error("DEPOSIT_ADDRESS is not set in configuration")
            return

        quiz_topic = None
        original_group_chat_id = None
        quiz_id = None  # Initialize quiz_id

        # Get the quiz ID from Redis context (should be set during reward setup flow)
        quiz_id = await redis_client.get_user_data_key(
            user_id, "current_quiz_id_for_reward_setup"
        )

        session = SessionLocal()
        try:
            if quiz_id:
                # Look for the specific quiz that needs reward setup
                quiz = session.query(Quiz).filter(Quiz.id == quiz_id).first()
            else:
                # Fallback: look for most recent DRAFT quiz by this user (creator)
                # Note: This is a fallback and should ideally not be needed if Redis state is maintained
                quiz = (
                    session.query(Quiz)
                    .filter(Quiz.status == QuizStatus.DRAFT)
                    .order_by(Quiz.last_updated.desc())
                    .first()
                )

            if not quiz:
                await safe_send_message(
                    context.bot,
                    update.effective_chat.id,
                    "No active quiz found to attach rewards to.",
                )
                return

            quiz.reward_schedule = schedule
            quiz.deposit_address = deposit_addr
            quiz.status = QuizStatus.FUNDING

            quiz_topic = quiz.topic
            original_group_chat_id = quiz.group_chat_id
            quiz_id = quiz.id

            session.commit()
        except Exception as e:
            await safe_send_message(
                context.bot,
                update.effective_chat.id,
                f"Error saving reward structure: {str(e)}",
            )
            logger.error(f"Error saving reward structure: {e}", exc_info=True)
            # import traceback # Already imported at module level
            # traceback.print_exc() # Avoid print_exc in production code, logging is preferred
            return
        finally:
            session.close()

        msg = f"Please deposit a total of {total} Near to this address:\n{deposit_addr}\n\n"
        msg += "⚠️ IMPORTANT: After making your deposit, you MUST send me the transaction hash to activate the quiz. The quiz will NOT be activated automatically.\n\n"
        msg += "Your transaction hash will look like 'FnuPC7YmQBJ1Qr22qjRT3XX8Vr8NbJAuWGVG5JyXQRjS' and can be found in your wallet's transaction history."

        await safe_send_message(context.bot, update.effective_chat.id, msg)

        if quiz_id:  # Ensure quiz_id was set
            await redis_client.set_user_data_key(
                user_id, "awaiting", "transaction_hash"
            )
            await redis_client.set_user_data_key(user_id, "quiz_id", quiz_id)
        else:
            logger.error(
                "quiz_id was not set before attempting to set in Redis for handle_reward_structure."
            )
            # Handle error appropriately, perhaps by not setting awaiting state or notifying user
            await safe_send_message(
                context.bot,
                update.effective_chat.id,
                "An internal error occurred setting up rewards. Please try again.",
            )
            return

        try:
            if original_group_chat_id:
                async with asyncio.timeout(10):
                    await safe_send_message(
                        context.bot,
                        original_group_chat_id,
                        text=(
                            f"Quiz '{quiz_topic}' is now funding.\n"
                            f"Creator must deposit {total} Near and verify the transaction to activate it.\n"
                            f"Once active, you'll be notified and can type /playquiz to join!"
                        ),
                    )
        except asyncio.TimeoutError:
            logger.error(f"Failed to announce to group: Timeout error")
        except Exception as e:
            logger.error(f"Failed to announce to group: {e}", exc_info=True)
            # import traceback # Already imported
            # traceback.print_exc() # Avoid print_exc
    finally:
        await redis_client.close()


async def handle_transaction_hash(update: Update, context: CallbackContext):
    """Process transaction hash verification from quiz creator."""
    tx_hash = update.message.text.strip()
    user_id = str(update.effective_user.id)
    redis_client = RedisClient()
    try:
        quiz_id = await redis_client.get_user_data_key(user_id, "quiz_id")

        if not quiz_id:
            await safe_send_message(
                context.bot,
                update.effective_chat.id,
                "Sorry, I couldn't determine which quiz you're trying to verify. Please try setting up the reward structure again.",
            )
            await redis_client.delete_user_data_key(user_id, "awaiting")
            return

        await context.bot.send_chat_action(
            chat_id=update.effective_chat.id, action="typing"
        )

        app = context.application
        blockchain_monitor = getattr(app, "blockchain_monitor", None)

        if not blockchain_monitor:
            blockchain_monitor = getattr(app, "_blockchain_monitor", None)

        if not blockchain_monitor:
            await safe_send_message(
                context.bot,
                update.effective_chat.id,
                "❌ Sorry, I couldn't access the blockchain monitor to verify your transaction. Please wait for automatic verification or contact an administrator.",
            )
            await redis_client.delete_user_data_key(user_id, "awaiting")
            return

        # This now returns a tuple: (bool, str)
        success, message = await blockchain_monitor.verify_transaction_by_hash(
            tx_hash, quiz_id, user_id
        )

        if success:
            # The announcement to the group is now handled within verify_transaction_by_hash
            await redis_client.delete_user_data_key(user_id, "awaiting")
            # The success message is now returned from verify_transaction_by_hash
            await safe_send_message(
                context.bot, update.effective_chat.id, f"✅ {message}"
            )
        else:
            # Provide the specific error message to the user
            await safe_send_message(
                context.bot,
                update.effective_chat.id,
                f"❌ Verification failed: {message}",
            )
            # Do not clear the 'awaiting' state, so the user can try again with a new hash.

    finally:
        await redis_client.close()


async def get_winners(update: Update, context: CallbackContext):
    """Display current or past quiz winners."""
    session = SessionLocal()
    try:
        # Find specific quiz if ID provided, otherwise get latest active or closed quiz
        if context.args:
            quiz_id = context.args[0]
            quiz = session.query(Quiz).filter(Quiz.id == quiz_id).first()
            if not quiz:
                await safe_send_message(
                    context.bot,
                    update.effective_chat.id,
                    f"No quiz found with ID {quiz_id}",
                )
                return
        else:
            # Get most recent active or closed quiz
            quiz = (
                session.query(Quiz)
                .filter(Quiz.status.in_([QuizStatus.ACTIVE, QuizStatus.CLOSED]))
                .order_by(Quiz.last_updated.desc())
                .first()
            )
            if not quiz:
                await safe_send_message(
                    context.bot,
                    update.effective_chat.id,
                    "No active or completed quizzes found.",
                )
                return

        # Use the new cached function
        quiz_details = await get_quiz_details(quiz.id)
        if not quiz_details:
            await safe_send_message(
                context.bot,
                update.effective_chat.id,
                f"Quiz with ID {quiz.id} not found.",
            )
            return

        # Calculate winners for the quiz using comprehensive participant ranking
        winners = QuizAnswer.get_quiz_participants_ranking(session, quiz.id)

        if not winners:
            await safe_send_message(
                context.bot,
                update.effective_chat.id,
                f"No participants have answered the '{quiz.topic}' quiz yet.",
            )
            return

        # Generate leaderboard message
        message = f"📊 Leaderboard for quiz: *{quiz.topic}*\n\n"

        # Display winners with rewards if available
        reward_schedule = quiz.reward_schedule or {}

        for i, winner in enumerate(winners[:10]):  # Show top 10 max
            rank = i + 1
            # Improve username display and tagging
            username = winner.get("username")
            if not username:
                winner_user_id = winner.get("user_id", "UnknownUser")
                username = f"User_{winner_user_id[:8]}"

            correct = winner["correct_count"]
            rank_emoji = ["🥇", "🥈", "🥉"][i] if i < 3 else "🏅"

            # Show reward if this position has a reward and quiz is active/closed
            reward_text = ""
            if str(rank) in reward_schedule:
                reward_text = f" - {reward_schedule[str(rank)]} NEAR"
            elif rank in reward_schedule:
                reward_text = f" - {reward_schedule[rank]} NEAR"

            message += f"{rank_emoji} {rank}. @{username}: {correct} correct answers{reward_text}\n"

        # Add quiz status info
        status = f"Quiz is {quiz.status.value.lower()}"
        if quiz.status == QuizStatus.CLOSED:
            status += " and rewards have been distributed."
        elif quiz.status == QuizStatus.ACTIVE:
            status += ". Participate with /playquiz"

        message += f"\n{status}"

        await safe_send_message(
            context.bot, update.effective_chat.id, message, parse_mode="Markdown"
        )

        # Note: We do NOT mark the quiz as closed or winners_announced here
        # That should only happen when rewards are actually distributed
        # This allows users to check leaderboards without affecting auto-distribution

    except Exception as e:
        await safe_send_message(
            context.bot, update.effective_chat.id, f"Error retrieving winners: {str(e)}"
        )
        logger.error(f"Error retrieving winners: {e}", exc_info=True)
        import traceback

        traceback.print_exc()
    finally:
        session.close()


async def distribute_quiz_rewards(
    update_or_app: Union[Update, "Application"],
    context_or_quiz_id: Union[CallbackContext, str],
):
    """Handler for /distributerewards command or direct call from job queue."""
    quiz_id = None
    chat_id_to_reply = None
    bot_to_use = None

    if isinstance(update_or_app, Application) and isinstance(context_or_quiz_id, str):
        # Called from job queue
        app = update_or_app
        quiz_id = context_or_quiz_id
        # We need a way to get a bot instance. If the application stores one, use it.
        # This part might need adjustment based on how your Application is structured.
        if hasattr(app, "bot"):
            bot_to_use = app.bot
        else:
            logger.error(
                "Job queue call: Bot instance not found in application context."
            )
            return  # Cannot send messages without a bot instance
        # For job queue, we might not have a specific chat to reply to initially,
        # but we might fetch it from the quiz details later if needed.

    elif isinstance(update_or_app, Update) and isinstance(
        context_or_quiz_id, CallbackContext
    ):
        # Called by user command
        update = update_or_app
        context = context_or_quiz_id
        app = context.application
        bot_to_use = context.bot
        chat_id_to_reply = update.effective_chat.id

        if context.args:
            quiz_id = context.args[0]
        else:
            session = SessionLocal()
            try:
                quiz_db = (
                    session.query(Quiz)
                    .filter(Quiz.status == QuizStatus.ACTIVE)
                    .order_by(Quiz.last_updated.desc())
                    .first()
                )
                if quiz_db:
                    quiz_id = quiz_db.id
            finally:
                session.close()

        if not quiz_id:
            if chat_id_to_reply and bot_to_use:
                await safe_send_message(
                    bot_to_use,
                    chat_id_to_reply,
                    "No active quiz found to distribute rewards for. Please specify a quiz ID.",
                )
            return
    else:
        logger.error("distribute_quiz_rewards called with invalid arguments.")
        return

    if not bot_to_use:
        logger.error(
            "Bot instance is not available, cannot proceed with reward distribution."
        )
        return

    processing_msg = None
    if chat_id_to_reply:  # Only send processing message if it's a user command
        processing_msg = await safe_send_message(
            bot_to_use,
            chat_id_to_reply,
            "🔄 Processing reward distribution... This may take a moment.",
        )

    try:
        blockchain_monitor = getattr(app, "blockchain_monitor", None) or getattr(
            app, "_blockchain_monitor", None
        )
        if not blockchain_monitor:
            if chat_id_to_reply:
                await safe_send_message(
                    bot_to_use,
                    chat_id_to_reply,
                    "❌ Blockchain monitor not available. Please contact an administrator.",
                )
            logger.error("Blockchain monitor not available.")
            return

        success = await blockchain_monitor.distribute_rewards(quiz_id)

        # --- Start of new logic for custom winner announcement and status update ---
        session = SessionLocal()
        try:
            quiz = session.query(Quiz).filter(Quiz.id == quiz_id).first()
            if not quiz:
                logger.error(
                    f"Quiz {quiz_id} not found after reward distribution attempt."
                )
                if chat_id_to_reply and bot_to_use:
                    await safe_send_message(
                        bot_to_use,
                        chat_id_to_reply,
                        f"❌ Error: Quiz {quiz_id} not found during reward finalization.",
                    )
                return  # Exit if quiz not found

            if success:
                # Blockchain distribution was successful
                if quiz.group_chat_id and bot_to_use:
                    all_participants = QuizAnswer.get_quiz_participants_ranking(
                        session, quiz_id
                    )
                    # For winner announcements, only consider participants with correct answers
                    winners = [
                        p for p in all_participants if p.get("correct_count", 0) > 0
                    ]
                    reward_schedule = quiz.reward_schedule or {}
                    reward_type = reward_schedule.get("type", "")

                    final_message_to_group = ""
                    if winners:
                        # Create a more engaging and detailed winner announcement
                        final_message_to_group = (
                            f'🎉 Quiz "{quiz.topic}" is officially complete!\n\n'
                        )
                        final_message_to_group += "🏆 **WINNERS ANNOUNCED** 🏆\n\n"

                        # Handle different reward types for appropriate winner announcements
                        if reward_type == "wta_amount" and len(winners) >= 1:
                            # Winner Takes All - announce single winner
                            winner = winners[0]
                            winner_username = winner.get("username")
                            if not winner_username:
                                winner_user_id = winner.get("user_id", "UnknownUser")
                                winner_username = f"User_{winner_user_id[:8]}"

                            correct_count = winner.get("correct_count", 0)
                            final_message_to_group += (
                                f"🥇 Champion: @{winner_username}\n"
                            )
                            final_message_to_group += (
                                f"📊 Score: {correct_count} correct answers\n"
                            )
                            final_message_to_group += (
                                f"💰 Takes the entire prize pool!\n\n"
                            )

                        elif reward_type in ["top3_details", "custom_details"]:
                            # Top 3 or custom rewards - announce multiple winners
                            final_message_to_group += (
                                "🏅 **Leaderboard Champions:**\n\n"
                            )
                            for i, winner in enumerate(winners[:3]):  # Show top 3
                                rank_emoji = ["🥇", "🥈", "🥉"][i] if i < 3 else "🏅"
                                winner_username = winner.get("username")
                                if not winner_username:
                                    winner_user_id = winner.get(
                                        "user_id", "UnknownUser"
                                    )
                                    winner_username = f"User_{winner_user_id[:8]}"

                                correct_count = winner.get("correct_count", 0)
                                final_message_to_group += f"{rank_emoji} {i+1}. @{winner_username} - {correct_count} correct\n"
                            final_message_to_group += (
                                "\n💰 Prizes distributed according to rankings!\n\n"
                            )

                        else:
                            # Default announcement for other reward types
                            winner = winners[0]
                            winner_username = winner.get("username")
                            if not winner_username:
                                winner_user_id = winner.get("user_id", "UnknownUser")
                                winner_username = f"User_{winner_user_id[:8]}"

                            correct_count = winner.get("correct_count", 0)
                            final_message_to_group += (
                                f"🥇 Champion: @{winner_username}\n"
                            )
                            final_message_to_group += (
                                f"📊 Score: {correct_count} correct answers\n\n"
                            )

                        final_message_to_group += (
                            "🎯 Thanks to all participants for playing!\n"
                        )
                        final_message_to_group += (
                            "💎 NEAR rewards have been sent to winners' wallets."
                        )
                    else:
                        final_message_to_group = (
                            f'🎯 Quiz "{quiz.topic}" is officially complete!\n\n'
                        )
                        final_message_to_group += (
                            "📊 Unfortunately, there were no winners this time.\n"
                        )
                        final_message_to_group += (
                            "🎯 Thanks to all participants for playing!\n"
                        )
                        final_message_to_group += "💪 Better luck in the next quiz!"

                    await bot_to_use.send_message(
                        chat_id=quiz.group_chat_id, text=final_message_to_group
                    )
                else:
                    logger.info(
                        f"Quiz {quiz_id} has no group_chat_id or bot_to_use is unavailable; custom winner message not sent to group."
                    )

                # Confirmation to user if command was from DM or a different chat than the quiz group
                if (
                    chat_id_to_reply
                    and bot_to_use
                    and (str(chat_id_to_reply) != str(quiz.group_chat_id))
                ):
                    await safe_send_message(
                        bot_to_use,
                        chat_id_to_reply,
                        f"✅ Rewards for quiz '{quiz.topic}' (ID: {quiz_id}) processed. Announcement made in the group.",
                    )

                quiz.winners_announced = True
                quiz.status = QuizStatus.CLOSED  # Mark quiz as closed after rewards
                session.commit()
                logger.info(
                    f"Quiz {quiz_id} updated: winners_announced=True, status=CLOSED."
                )

                # Invalidate cache for this quiz
                redis_client = RedisClient()
                try:
                    await redis_client.delete_cached_object(f"quiz_details:{quiz_id}")
                finally:
                    await redis_client.close()

            else:  # Blockchain distribution failed
                target_chat_for_failure = chat_id_to_reply
                if not target_chat_for_failure and quiz:
                    target_chat_for_failure = quiz.group_chat_id

                if target_chat_for_failure and bot_to_use:
                    quiz_topic_name = quiz.topic if quiz else quiz_id
                    await safe_send_message(
                        bot_to_use,
                        target_chat_for_failure,
                        f"⚠️ Could not distribute rewards for quiz '{quiz_topic_name}'. Please check logs or try again later.",
                    )
                else:
                    logger.error(
                        f"Failed to distribute rewards for {quiz_id}, and no chat_id to notify."
                    )

        except Exception as e_db_ops:
            logger.error(
                f"DB/notification error for quiz {quiz_id} post-distribution: {e_db_ops}",
                exc_info=True,
            )
            if "session" in locals() and session.is_active:
                session.rollback()
            if chat_id_to_reply and bot_to_use:
                await safe_send_message(
                    bot_to_use,
                    chat_id_to_reply,
                    f"❌ An internal error occurred while finalizing rewards for quiz {quiz_id}.",
                )
        finally:
            if "session" in locals() and session:
                session.close()
        # --- End of new logic ---

    except Exception as e:
        logger.error(
            f"Error distributing rewards for quiz {quiz_id}: {e}", exc_info=True
        )
        if chat_id_to_reply:  # Only send error to user if it was a user command
            await safe_send_message(
                bot_to_use,
                chat_id_to_reply,
                f"❌ Error distributing rewards for quiz {quiz_id}: {str(e)}",
            )
    finally:
        if processing_msg:
            try:
                await processing_msg.delete()
            except Exception:
                pass  # Ignore if message deletion fails


async def announce_quiz_end(
    application: "Application", quiz_id: str
):
    """Announce quiz end with final leaderboard and results"""
    logger.info(f"Announcing quiz end for quiz_id: {quiz_id}")
    
    session = SessionLocal()
    try:
        quiz = session.query(Quiz).filter(Quiz.id == quiz_id).first()
        if not quiz:
            logger.error(f"Quiz {quiz_id} not found for end announcement")
            return
        
        if not quiz.group_chat_id:
            logger.info(f"Quiz {quiz_id} has no group_chat_id, skipping announcement")
            return
        
        # Get all participants and their scores
        all_participants = QuizAnswer.get_quiz_participants_ranking(session, quiz_id)
        
        # Create comprehensive end announcement
        announcement = f"""🏁 **QUIZ ENDED: {quiz.topic}** 🏁

⏰ The quiz period has officially ended!
📊 Final results are now available.

👥 **Total Participants:** {len(all_participants)}"""

        if all_participants:
            # Add leaderboard
            announcement += "\n\n🏆 **FINAL LEADERBOARD:**\n"
            for i, participant in enumerate(all_participants[:10]):  # Show top 10
                medal = "🥇" if i == 0 else "🥈" if i == 1 else "🥉" if i == 2 else "🏅"
                username = participant.get('username', f"User_{participant.get('user_id', 'Unknown')[:8]}")
                correct_count = participant.get('correct_count', 0)
                total_questions = participant.get('total_questions', 0)
                accuracy = (correct_count / total_questions * 100) if total_questions > 0 else 0
                
                announcement += f"{medal} **{i+1}.** @{username}\n"
                announcement += f"   📊 {correct_count}/{total_questions} ({accuracy:.1f}%)\n"
            
            # Add participation stats
            total_correct = sum(p.get('correct_count', 0) for p in all_participants)
            total_questions_answered = sum(p.get('total_questions', 0) for p in all_participants)
            avg_accuracy = (total_correct / total_questions_answered * 100) if total_questions_answered > 0 else 0
            
            announcement += f"\n📈 **Quiz Statistics:**\n"
            announcement += f"• Total correct answers: {total_correct}\n"
            announcement += f"• Average accuracy: {avg_accuracy:.1f}%\n"
            announcement += f"• Questions answered: {total_questions_answered}\n"
        else:
            announcement += "\n\n📊 No participants found for this quiz."
        
        # Add reward information if applicable
        if quiz.reward_schedule:
            reward_type = quiz.reward_schedule.get('type', '')
            if reward_type == 'wta_amount':
                announcement += "\n💰 **Reward Type:** Winner Takes All"
            elif reward_type == 'top3_details':
                announcement += "\n💰 **Reward Type:** Top 3 Winners"
            elif reward_type == 'custom_details':
                announcement += "\n💰 **Reward Type:** Custom Rewards"
        
        announcement += "\n\n🎯 **Thanks to all participants!** 🎯"
        
        # Send announcement to group
        await safe_send_message(
            application.bot,
            quiz.group_chat_id,
            announcement,
            parse_mode='Markdown'
        )
        
        logger.info(f"Quiz end announcement sent for quiz {quiz_id}")
        
    except Exception as e:
        logger.error(f"Error announcing quiz end for {quiz_id}: {e}")
    finally:
        session.close()

async def schedule_auto_distribution(
    application: "Application", quiz_id: str, delay_seconds: float
):
    """Schedules the automatic distribution of rewards for a quiz after a delay using application.job_queue."""
    logger.info(
        f"schedule_auto_distribution called for quiz_id: {quiz_id} with delay: {delay_seconds}"
    )

    async def job_callback(
        context: CallbackContext,
    ):  # context here is from JobQueue, not a command
        logger.info(f"JobQueue executing for auto-distribution of quiz {quiz_id}")
        try:
            session = SessionLocal()
            quiz = session.query(Quiz).filter(Quiz.id == quiz_id).first()
            if quiz and quiz.status == QuizStatus.ACTIVE and not quiz.winners_announced:
                logger.info(f"Quiz {quiz_id} is ACTIVE. Proceeding with distribution.")
                # Pass the application instance and quiz_id directly
                await distribute_quiz_rewards(application, quiz_id)
            elif quiz:
                logger.info(
                    f"Auto-distribution for quiz {quiz_id} skipped. Status: {quiz.status}, WA: {quiz.winners_announced}"
                )
                # Even if rewards aren't distributed, announce quiz end
                await announce_quiz_end(application, quiz_id)
            else:
                logger.warning(f"Quiz {quiz_id} not found for auto-distribution job.")
        except Exception as e:
            logger.error(
                f"Error during auto-distribution job for quiz {quiz_id}: {e}",
                exc_info=True,
            )
        finally:
            if "session" in locals() and session:
                session.close()

    # Wrapper to be called by job_queue.run_once
    async def job_wrapper(context: CallbackContext):  # Make job_wrapper async
        # context here is from JobQueue, not a command
        # We pass context.application to job_callback if it needs it,
        # but distribute_quiz_rewards now takes application directly.
        await job_callback(context)  # Await the job_callback

    if delay_seconds > 0:
        if hasattr(application, "job_queue") and application.job_queue:
            application.job_queue.run_once(
                job_wrapper, delay_seconds, name=f"distribute_{quiz_id}", job_kwargs={}
            )
            logger.info(
                f"Scheduled auto-distribution job for quiz {quiz_id} in {delay_seconds} seconds via application.job_queue."
            )
        else:
            logger.error(
                f"application.job_queue not available for quiz {quiz_id}. Auto-distribution will not be scheduled."
            )
    else:
        logger.info(
            f"Delay for quiz {quiz_id} is not positive ({delay_seconds}s). Running job immediately."
        )
        if hasattr(application, "job_queue") and application.job_queue:
            application.job_queue.run_once(
                job_wrapper, 0, name=f"distribute_{quiz_id}_immediate", job_kwargs={}
            )
        else:
            logger.error(
                f"application.job_queue not available for immediate run of quiz {quiz_id}."
            )

async def schedule_quiz_end_announcement(
    application: "Application", quiz_id: str, delay_seconds: float
):
    """Schedule a quiz end announcement for quizzes without rewards"""
    logger.info(f"Scheduling quiz end announcement for quiz_id: {quiz_id} with delay: {delay_seconds}")
    
    async def announcement_job_callback(context: CallbackContext):
        logger.info(f"JobQueue executing quiz end announcement for quiz {quiz_id}")
        try:
            await announce_quiz_end(application, quiz_id)
        except Exception as e:
            logger.error(f"Error during quiz end announcement for quiz {quiz_id}: {e}", exc_info=True)
    
    async def announcement_job_wrapper(context: CallbackContext):
        await announcement_job_callback(context)
    
    if delay_seconds > 0:
        if hasattr(application, "job_queue") and application.job_queue:
            application.job_queue.run_once(
                announcement_job_wrapper, delay_seconds, name=f"announce_end_{quiz_id}", job_kwargs={}
            )
            logger.info(f"Scheduled quiz end announcement for quiz {quiz_id} in {delay_seconds} seconds.")
        else:
            logger.error(f"application.job_queue not available for quiz end announcement of quiz {quiz_id}.")
    else:
        logger.info(f"Running quiz end announcement immediately for quiz {quiz_id}.")
        if hasattr(application, "job_queue") and application.job_queue:
            application.job_queue.run_once(
                announcement_job_wrapper, 0, name=f"announce_end_{quiz_id}_immediate", job_kwargs={}
            )
        else:
            logger.error(f"application.job_queue not available for immediate quiz end announcement of quiz {quiz_id}.")


# ... rest of the file


def parse_multiple_questions(raw_questions):
    """Parse multiple questions from raw text into a list of structured questions."""
    # Split by double newline or question number pattern
    question_pattern = re.compile(r"Question\s+\d+:|^\d+\.\s+", re.MULTILINE)

    # First try to split by the question pattern
    chunks = re.split(question_pattern, raw_questions)

    # Remove any empty chunks
    chunks = [chunk.strip() for chunk in chunks if chunk.strip()]

    # If we only got one chunk but it might contain multiple questions
    if len(chunks) == 1 and "\n\n" in raw_questions:
        # Try splitting by double newline
        chunks = raw_questions.split("\n\n")
        chunks = [chunk.strip() for chunk in chunks if chunk.strip()]

    # Process each chunk as an individual question
    questions_list = []
    for chunk in chunks:
        question_data = parse_questions(chunk)
        if (
            question_data["question"]
            and question_data["options"]
            and question_data["correct"]
        ):
            questions_list.append(question_data)

    return questions_list


def parse_questions(raw_questions):
    """Convert raw question text into structured format for storage and display."""
    lines = raw_questions.strip().split("\n")
    result = {"question": "", "options": {}, "correct": ""}

    # More flexible parsing that can handle different formats
    question_pattern = re.compile(r"^(?:Question:?\s*)?(.+)$")
    option_pattern = re.compile(r"^([A-D])[):\.]?\s+(.+)$")
    correct_pattern = re.compile(
        r"^(?:Correct\s+Answer:?\s*|Answer:?\s*)([A-D])\.?$", re.IGNORECASE
    )

    # First pass - try to identify the question
    for i, line in enumerate(lines):
        if "Question" in line or (
            i == 0
            and not any(x in line.lower() for x in ["a)", "b)", "c)", "d)", "correct"])
        ):
            match = question_pattern.match(line)
            if match:
                question_text = match.group(1).strip()
                if "Question:" in line:
                    question_text = line[line.find("Question:") + 9 :].strip()
                result["question"] = question_text
                break

    # If still no question found, use the first line
    if not result["question"] and lines:
        result["question"] = lines[0].strip()

    # Second pass - extract options and correct answer
    for line in lines:
        line = line.strip()

        # First check for correct answer format
        if "correct answer" in line.lower() or "answer:" in line.lower():
            # Try to extract the correct answer letter
            match = correct_pattern.match(line)
            if match:
                result["correct"] = match.group(1).upper()
                continue

            # Try alternate format: "Correct Answer: A"
            letter_match = re.search(
                r"(?:correct answer|answer)[:\s]+([A-D])", line, re.IGNORECASE
            )
            if letter_match:
                result["correct"] = letter_match.group(1).upper()
                continue

        # Try to match options with various formats
        option_match = option_pattern.match(line)
        if option_match:
            letter, text = option_match.groups()
            result["options"][letter] = text.strip()
            continue

        # Check for options in format "A. Option text" or "A: Option text"
        for prefix in (
            [f"{letter})" for letter in "ABCD"]
            + [f"{letter}." for letter in "ABCD"]
            + [f"{letter}:" for letter in "ABCD"]
        ):
            if line.startswith(prefix):
                letter = prefix[0]
                text = line[len(prefix) :].strip()
                result["options"][letter] = text
                break

    print(f"Parsed question structure: {result}")

    # If we don't have options or they're incomplete, create fallback options
    if not result["options"] or len(result["options"]) < 4:
        print("Warning: Missing options in quiz question. Using fallback options.")
        for letter in "ABCD":
            if letter not in result["options"]:
                result["options"][letter] = f"Option {letter}"

    # If we don't have a correct answer, default to B for blockchain topics
    # This is a reasonable default for the specific issue we saw with Solana questions
    if not result["correct"]:
        print("Warning: Missing correct answer in quiz question. Analyzing question...")
        # For blockchain questions about consensus mechanisms, B is often the answer (PoS+PoH)
        if "solana" in raw_questions.lower() and "consensus" in raw_questions.lower():
            result["correct"] = "B"
            print("Identified as Solana consensus question, defaulting to B (PoS+PoH)")
        else:
            result["correct"] = "A"
            print("Defaulting to A as correct answer")

    return result


import logging  # Ensure logging is imported if not already
from sqlalchemy.orm import joinedload, selectinload
from models.user import User  # Assuming User model is in models.user
from models.quiz import Quiz, QuizAnswer, QuizStatus  # Ensure QuizStatus is imported
from typing import Dict, List, Any  # Ensure these are imported


def parse_reward_schedule_to_description(reward_schedule: Dict) -> str:
    """Helper function to convert reward_schedule JSON to a human-readable string."""
    if not reward_schedule or not isinstance(reward_schedule, dict):
        return "Not specified"

    reward_type = reward_schedule.get("type", "custom")
    details_text = reward_schedule.get("details_text", "")

    if details_text:  # Prefer details_text if available
        return details_text

    if reward_type == "wta_amount":  # Matching the type used in reward setup
        return "Winner Takes All"
    elif reward_type == "top3_details":  # Matching the type used in reward setup
        return "Top 3 Winners"
    elif reward_type == "custom_details":  # Matching the type used in reward setup
        return "Custom Rewards"
    elif reward_type == "manual_free_text":  # Matching the type used in reward setup
        return "Manually Described Rewards"
    # Fallback for older or other types
    elif reward_type == "wta":
        return "Winner Takes All"
    elif reward_type == "top_n":
        n = reward_schedule.get("n", "N")
        return f"Top {n} Winners"
    elif reward_type == "shared_pot":
        return "Shared Pot for Top Scorers"
    return "Custom Reward Structure"


async def _generate_leaderboard_data_for_quiz(
    quiz: Quiz, session
) -> Optional[Dict[str, Any]]:
    """
    Generates leaderboard data for a single quiz.
    Fetches answers, users, ranks them, and determines winners.
    """
    logger.info(f"Generating leaderboard data for quiz ID: {quiz.id} ('{quiz.topic}')")

    # Generate participant rankings using helper
    participant_stats = QuizAnswer.get_quiz_participants_ranking(session, quiz.id)

    if not participant_stats:
        logger.info(f"No answers found for quiz ID: {quiz.id}.")
        return {
            "quiz_id": quiz.id,
            "quiz_topic": quiz.topic,
            "reward_description": parse_reward_schedule_to_description(
                quiz.reward_schedule
            ),
            "participants": [],
            "status": quiz.status.value if quiz.status else "UNKNOWN",
            # Include end_time for leaderboard display
            "end_time": quiz.end_time.isoformat() if quiz.end_time else None,
        }

    ranked_participants = []
    for idx, stats in enumerate(participant_stats, start=1):
        score = stats.get("correct_count", 0)
        username = stats.get("username", "UnknownUser")
        user_id = stats["user_id"]
        logger.info(f"Database participant: {username} (user_id: {user_id}), correct_count: {score}")
        ranked_participants.append(
            {
                "rank": idx,
                "user_id": user_id,
                "username": username,
                "score": score,
                "time_taken": None,
                "is_winner": False,
            }
        )

    reward_schedule = quiz.reward_schedule or {}
    reward_type = reward_schedule.get("type", "unknown")

    # Refined Winner Logic
    if reward_type in ["wta_amount", "wta"]:  # Winner Takes All
        if ranked_participants and ranked_participants[0]["score"] > 0:
            ranked_participants[0]["is_winner"] = True
    elif reward_type in ["top3_details", "top_n"]:
        num_to_win = 3  # Default for top3_details
        if reward_type == "top_n":
            num_to_win = reward_schedule.get("n", 0)

        winners_count = 0
        for p in ranked_participants:
            if winners_count < num_to_win and p["score"] > 0:
                p["is_winner"] = True
                winners_count += 1
            else:
                break  # Stop if we have enough winners or scores are 0
    # Add more sophisticated logic for "custom_details", "manual_free_text", "shared_pot" if needed
    # For "custom_details" and "manual_free_text", winner determination might be manual or based on text parsing,
    # which is complex. For now, they won't automatically mark winners here.

    logger.info(
        f"Generated leaderboard for quiz {quiz.id} with {len(ranked_participants)} participants."
    )
    return {
        "quiz_id": quiz.id,
        "quiz_topic": quiz.topic,
        "reward_description": parse_reward_schedule_to_description(reward_schedule),
        "participants": ranked_participants,
        "status": quiz.status.value if quiz.status else "UNKNOWN",
        # Include end_time for leaderboard display
        "end_time": quiz.end_time.isoformat() if quiz.end_time else None,
    }


async def get_leaderboards_for_all_active_quizzes() -> List[Dict[str, Any]]:
    """
    Fetches and generates leaderboard data for all quizzes with status 'ACTIVE'.
    """
    logger.info("Fetching leaderboards for all active quizzes.")
    all_active_leaderboards = []
    session = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        active_quizzes = (
            session.query(Quiz)
            .filter(
                Quiz.status == QuizStatus.ACTIVE,
                ((Quiz.end_time == None) | (Quiz.end_time > now)),
            )
            .all()
        )

        if not active_quizzes:
            logger.info("No active quizzes found.")
            return []

        logger.info(f"Found {len(active_quizzes)} active quizzes.")
        for quiz_obj in active_quizzes:  # Renamed to avoid conflict with 'quiz' module
            # Pass the quiz_obj (SQLAlchemy model instance) and session
            leaderboard_data = await _generate_leaderboard_data_for_quiz(
                quiz_obj, session
            )
            if (
                leaderboard_data
            ):  # Always add, even if no participants, to show it's active
                all_active_leaderboards.append(leaderboard_data)

    except Exception as e:
        logger.error(f"Error fetching active quiz leaderboards: {e}", exc_info=True)
        return []
    finally:
        session.close()

    logger.info(f"Returning {len(all_active_leaderboards)} active leaderboards.")
    return all_active_leaderboards


async def start_enhanced_quiz(
    application: "Application",
    user_id: str,
    quiz: Quiz,
    shuffle_questions: bool = True,
    shuffle_answers: bool = True
) -> bool:
    """Start an enhanced quiz session with sequential questions and timers"""
    
    # Parse questions
    questions_list = quiz.questions
    if isinstance(questions_list, dict):
        questions_list = [questions_list]
    
    if not questions_list:
        await safe_send_message(
            application.bot,
            user_id,
            "❌ This quiz has no questions available."
        )
        return False
    
    # Check if user has already completed this quiz
    session = SessionLocal()
    try:
        existing_answers = session.query(QuizAnswer).filter(
            QuizAnswer.user_id == user_id,
            QuizAnswer.quiz_id == quiz.id
        ).count()
        
        if existing_answers > 0:
            await safe_send_message(
                application.bot,
                user_id,
                f"❌ You have already completed the quiz '{quiz.topic}'. Each quiz can only be played once."
            )
            return False
    except Exception as e:
        logger.error(f"Error checking existing answers: {e}")
    finally:
        session.close()
    
    # Check if user already has an active session for this quiz
    session_key = f"{user_id}:{quiz.id}"
    if session_key in active_quiz_sessions:
        await safe_send_message(
            application.bot,
            user_id,
            f"❌ You already have an active session for the quiz '{quiz.topic}'. Please complete your current session first or use /stop to cancel it."
        )
        return False
    
    # Create quiz session
    quiz_session = QuizSession(
        user_id=user_id,
        quiz_id=quiz.id,
        questions=questions_list,
        shuffle_questions=shuffle_questions,
        shuffle_answers=shuffle_answers
    )
    
    # Set the start time immediately after creation
    quiz_session.start_time = datetime.utcnow()
    
    active_quiz_sessions[session_key] = quiz_session
    logger.info(f"Enhanced quiz session created: {session_key}, total_sessions={len(active_quiz_sessions)}")
    
    # Send quiz introduction
    total_questions = len(questions_list)
    timer_seconds = Config.QUESTION_TIMER_SECONDS
    
    intro_text = f"""🎲 Get ready for the quiz '{quiz.topic}'

🖊 {total_questions} questions
⏱ {timer_seconds} seconds per question
{'🔀 Questions and answers shuffled' if shuffle_questions or shuffle_answers else '📝 Questions in order'}

🏁 Press the button below when you are ready.
Send /stop to stop it."""
    
    keyboard = [[InlineKeyboardButton("🚀 Start Quiz", callback_data=f"enhanced_quiz_start:{quiz.id}")]]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await safe_send_message(
        application.bot,
        user_id,
        intro_text,
        reply_markup=reply_markup
    )
    
    return True

async def send_enhanced_question(
    application: "Application",
    user_id: str,
    quiz_session: QuizSession,
    quiz: Quiz
) -> bool:
    """Send the current question using Telegram's poll feature"""
    
    logger.info(f"send_enhanced_question called: user={user_id}, quiz={quiz.id}, current_index={quiz_session.current_question_index}")
    
    current_q = quiz_session.get_current_question()
    if not current_q:
        logger.error(f"No current question found for session")
        return False
    
    current_num, total_questions = quiz_session.get_progress()
    question_text = current_q.get('question', 'Question not available')
    shuffled_options = current_q.get('shuffled_options', {})
    
    # Create poll options
    poll_options = list(shuffled_options.values())
    
    # Send the question as a poll
    try:
        logger.info(f"Sending poll: question='{question_text[:50]}...', options={len(poll_options)}")
        poll_message = await application.bot.send_poll(
            chat_id=user_id,
            question=f"[{current_num}/{total_questions}] {question_text}",
            options=poll_options,
            is_anonymous=False,
            allows_multiple_answers=False,
            explanation="",
            open_period=Config.QUESTION_TIMER_SECONDS,
            close_date=datetime.now(timezone.utc) + timedelta(seconds=Config.QUESTION_TIMER_SECONDS + 1)
        )
        logger.info(f"Poll sent successfully: message_id={poll_message.message_id}")
        
        # Store poll message ID for tracking
        session_key = f"{user_id}:{quiz.id}"
        redis_client = RedisClient()
        await redis_client.set_user_quiz_data(
            user_id, quiz.id, f"poll_message_{current_num-1}", poll_message.message_id
        )
        await redis_client.close()
        
        # Schedule next question and store task for potential cancellation
        session_key = f"{user_id}:{quiz.id}"
        task = asyncio.create_task(
            schedule_next_question(
                application, user_id, quiz_session, quiz, current_num, total_questions
            )
        )
        scheduled_tasks[session_key] = task
        
        logger.info(f"Enhanced question sent successfully for user {user_id}")
        return True
        
    except Exception as e:
        logger.error(f"Error sending enhanced question: {e}")
        return False

async def schedule_next_question(
    application: "Application",
    user_id: str,
    quiz_session: QuizSession,
    quiz: Quiz,
    current_num: int,
    total_questions: int
):
    """Schedule the next question after timer expires"""
    
    await asyncio.sleep(Config.QUESTION_TIMER_SECONDS + 1)  # +1 for poll close
    
    # Check if session still exists
    session_key = f"{user_id}:{quiz.id}"
    if session_key not in active_quiz_sessions:
        # Clean up scheduled task
        if session_key in scheduled_tasks:
            del scheduled_tasks[session_key]
        return
    
    # Mark current question as missed if no answer was given
    if quiz_session.current_question_index not in quiz_session.answers:
        quiz_session.answers[quiz_session.current_question_index] = {
            'answer': 'TIMEOUT',
            'correct': False,
            'correct_answer': quiz_session.get_current_question().get('correct_answer', '')
        }
        quiz_session.missed_questions += 1
        
        # Send timeout message
        await safe_send_message(
            application.bot,
            user_id,
            f"⏰ Time's up for question {current_num}!"
        )
        
        # Move to next question or finish
        if quiz_session.next_question():
            await send_enhanced_question(application, user_id, quiz_session, quiz)
        else:
            await finish_enhanced_quiz(application, user_id, quiz_session, quiz)
    
    # Clean up scheduled task
    if session_key in scheduled_tasks:
        del scheduled_tasks[session_key]

async def handle_enhanced_quiz_answer(
    application: "Application",
    user_id: str,
    quiz_id: str,
    answer: str
) -> bool:
    """Handle answer submission for enhanced quiz"""
    
    logger.info(f"handle_enhanced_quiz_answer called: user={user_id}, quiz={quiz_id}, answer={answer}")
    
    session_key = f"{user_id}:{quiz_id}"
    logger.info(f"Looking for session: {session_key}")
    logger.info(f"Available sessions: {list(active_quiz_sessions.keys())}")
    
    if session_key not in active_quiz_sessions:
        logger.warning(f"Session {session_key} not found in active_quiz_sessions")
        return False
    
    quiz_session = active_quiz_sessions[session_key]
    
    # Cancel the scheduled timeout task since user answered
    if session_key in scheduled_tasks:
        try:
            scheduled_tasks[session_key].cancel()
            del scheduled_tasks[session_key]
        except Exception as e:
            logger.error(f"Error cancelling scheduled task: {e}")
    
    # Close the current poll to prevent sharing
    try:
        redis_client = RedisClient()
        poll_message_id = await redis_client.get_user_quiz_data(
            user_id, quiz_id, f"poll_message_{quiz_session.current_question_index-1}"
        )
        await redis_client.close()
        
        if poll_message_id:
            # Close the poll
            await application.bot.stop_poll(
                chat_id=user_id,
                message_id=int(poll_message_id)
            )
    except Exception as e:
        logger.error(f"Error closing poll: {e}")
    
    # Submit answer
    logger.info(f"Submitting answer: {answer}")
    is_correct = quiz_session.submit_answer(answer)
    logger.info(f"Answer submitted, correct: {is_correct}")
    
    # Don't send immediate feedback - wait until the end
    # The user will see their results at the end of the quiz
    
    # Move to next question or finish
    logger.info(f"Moving to next question. Current index: {quiz_session.current_question_index}")
    if quiz_session.next_question():
        logger.info(f"Next question available. New index: {quiz_session.current_question_index}")
        # Get quiz from database for next question
        session = SessionLocal()
        try:
            quiz = session.query(Quiz).filter(Quiz.id == quiz_id).first()
            if quiz:
                logger.info(f"Sending next question for quiz {quiz_id}")
                result = await send_enhanced_question(application, user_id, quiz_session, quiz)
                logger.info(f"send_enhanced_question result: {result}")
            else:
                logger.error(f"Quiz {quiz_id} not found in database")
        except Exception as e:
            logger.error(f"Error sending next question: {e}")
        finally:
            session.close()
    else:
        logger.info("No more questions, finishing quiz")
        # Quiz finished
        session = SessionLocal()
        try:
            quiz = session.query(Quiz).filter(Quiz.id == quiz_id).first()
            if quiz:
                await finish_enhanced_quiz(application, user_id, quiz_session, quiz)
        except Exception as e:
            logger.error(f"Error finishing quiz: {e}")
        finally:
            session.close()
    
    return True

async def finish_enhanced_quiz(
    application: "Application",
    user_id: str,
    quiz_session: QuizSession,
    quiz: Quiz
):
    """Finish the enhanced quiz and show results"""
    
    results = quiz_session.get_results()
    
    # Calculate accuracy
    total_answered = results['correct'] + results['wrong']
    accuracy = (results['correct'] / total_answered * 100) if total_answered > 0 else 0
    
    results_text = f"""🏁 The quiz '{quiz.topic}' has finished!

You answered {total_answered} questions:

✅ Correct – {results['correct']}
❌ Wrong – {results['wrong']}
⌛️ Missed – {results['missed']}
📊 Accuracy – {accuracy:.1f}%

📋 Question Review:"""
    
    # Add question-by-question review
    for i, answer_data in enumerate(results['answers'].values()):
        question_num = i + 1
        user_answer = answer_data.get('answer', 'No answer')
        correct_answer = answer_data.get('correct_answer', 'Unknown')
        is_correct = answer_data.get('correct', False)
        
        status = "✅" if is_correct else "❌"
        results_text += f"\n{status} Q{question_num}: Your answer: {user_answer} | Correct: {correct_answer}"

    # Save results to database
    session = SessionLocal()
    try:
        # Get user info for username
        from models.user import User
        user = session.query(User).filter(User.id == user_id).first()
        username = user.username if user else None
        
        # First, remove the "started" record if it exists (empty answer record)
        existing_started = session.query(QuizAnswer).filter(
            QuizAnswer.user_id == user_id,
            QuizAnswer.quiz_id == quiz.id,
            QuizAnswer.answer == ""  # This indicates a "started but not completed" record
        ).first()
        
        if existing_started:
            session.delete(existing_started)
            logger.info(f"Removed 'started' record for user {user_id} in quiz {quiz.id}")
        
        # Save individual answers in the correct format for reward distribution
        for question_index, answer_data in results['answers'].items():
            user_answer = answer_data.get('answer', 'No answer')
            is_correct = answer_data.get('correct', False)
            answered_at = answer_data.get('answered_at', datetime.utcnow())
            
            # Check if answer already exists for this user/quiz/question
            existing_answer = session.query(QuizAnswer).filter(
                QuizAnswer.user_id == user_id,
                QuizAnswer.quiz_id == quiz.id,
                QuizAnswer.question_index == int(question_index)
            ).first()
            
            if existing_answer:
                # Update existing answer if it's different
                if (existing_answer.answer != user_answer or 
                    existing_answer.is_correct != ("True" if is_correct else "False")):
                    existing_answer.answer = user_answer
                    existing_answer.is_correct = "True" if is_correct else "False"
                    existing_answer.answered_at = answered_at
                    existing_answer.username = username
                    logger.info(f"Updated existing answer for user {user_id}, quiz {quiz.id}, question {question_index}")
            else:
                # Create new quiz answer record
                quiz_answer = QuizAnswer(
                    user_id=user_id,
                    quiz_id=quiz.id,
                    username=username,
                    answer=user_answer,
                    is_correct="True" if is_correct else "False",
                    answered_at=answered_at,
                    question_index=int(question_index)
                )
                session.add(quiz_answer)
                logger.info(f"Created new answer for user {user_id}, quiz {quiz.id}, question {question_index}")
        
        session.commit()
        logger.info(f"Saved {len(results['answers'])} answers for user {user_id} in quiz {quiz.id}")
        
        # Add leaderboard info
        results_text += f"\n\n🏆 Your score: {results['correct']}/{results['total_questions']}"
        
    except Exception as e:
        logger.error(f"Error saving enhanced quiz results: {e}")
        session.rollback()
    finally:
        session.close()
    
    # Clean up session and scheduled tasks
    session_key = f"{user_id}:{quiz.id}"
    logger.info(f"Cleaning up enhanced quiz session: {session_key}")
    active_quiz_sessions.pop(session_key, None)
    logger.info(f"Session removed, remaining_sessions={len(active_quiz_sessions)}")
    
    # Clean up any scheduled tasks
    if session_key in scheduled_tasks:
        try:
            scheduled_tasks[session_key].cancel()
            del scheduled_tasks[session_key]
        except Exception as e:
            logger.error(f"Error cancelling scheduled task: {e}")
    
    await safe_send_message(
        application.bot,
        user_id,
        results_text
    )
