from typing import Optional, Dict, List, Tuple
import logging
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import desc, func

from models.points import PointTransaction, PointTransactionType, UserPoints
from models.user import User
from models.quiz import Quiz, QuizAnswer
from store.database import SessionLocal
from utils.redis_client import RedisClient

logger = logging.getLogger(__name__)


class PointService:
    """Service to handle point calculations and transactions"""

    # Point values based on the requirements
    POINTS_CORRECT_ANSWER = 5
    POINTS_FIRST_CORRECT_ANSWER_BONUS = 3
    POINTS_CREATOR_UNIQUE_PLAYER = 2
    POINTS_CREATOR_CORRECT_ANSWER_BONUS = 1

    @staticmethod
    async def award_quiz_taker_points(
        user_id: str,
        quiz_id: str,
        is_correct: bool,
        is_first_correct: bool = False,
        is_timed_quiz: bool = False,
    ) -> Dict[str, int]:
        """
        Award points to quiz taker based on their performance

        Args:
            user_id: ID of the user who answered
            quiz_id: ID of the quiz
            is_correct: Whether the answer was correct
            is_first_correct: Whether this was the first correct answer (for timed quizzes)
            is_timed_quiz: Whether this is a timed quiz (affects first answer bonus)

        Returns:
            Dict with points awarded and transaction details
        """
        if not is_correct:
            return {"points_awarded": 0, "transactions": []}

        session = SessionLocal()
        try:
            points_awarded = 0
            transactions = []

            # Award base points for correct answer
            points_awarded += PointService.POINTS_CORRECT_ANSWER
            transaction = await PointService._create_transaction(
                session=session,
                user_id=user_id,
                quiz_id=quiz_id,
                transaction_type=PointTransactionType.QUIZ_CORRECT_ANSWER,
                points=PointService.POINTS_CORRECT_ANSWER,
                description=f"Correct answer in quiz",
            )
            transactions.append(transaction)

            # Award bonus points for first correct answer in timed quizzes
            if is_first_correct and is_timed_quiz:
                points_awarded += PointService.POINTS_FIRST_CORRECT_ANSWER_BONUS
                transaction = await PointService._create_transaction(
                    session=session,
                    user_id=user_id,
                    quiz_id=quiz_id,
                    transaction_type=PointTransactionType.QUIZ_FIRST_CORRECT_ANSWER,
                    points=PointService.POINTS_FIRST_CORRECT_ANSWER_BONUS,
                    description=f"First correct answer bonus in timed quiz",
                )
                transactions.append(transaction)

            # Update user points
            await PointService._update_user_points(
                session=session,
                user_id=user_id,
                points_to_add=points_awarded,
                correct_answers_to_add=1 if is_correct else 0,
            )

            session.commit()

            # Invalidate user points cache
            await RedisClient.delete_cached_object(f"user_points:{user_id}")

            logger.info(
                f"Awarded {points_awarded} points to user {user_id} for quiz {quiz_id}"
            )

            return {
                "points_awarded": points_awarded,
                "transactions": [t.id for t in transactions],
            }

        except Exception as e:
            session.rollback()
            logger.error(f"Error awarding quiz taker points: {e}")
            raise
        finally:
            session.close()

    @staticmethod
    async def award_quiz_creator_points(
        creator_user_id: str, quiz_id: str, answering_user_id: str, is_correct: bool
    ) -> Dict[str, int]:
        """
        Award points to quiz creator when someone answers their quiz

        Args:
            creator_user_id: ID of the quiz creator
            quiz_id: ID of the quiz
            answering_user_id: ID of the user who answered
            is_correct: Whether the answer was correct

        Returns:
            Dict with points awarded and transaction details
        """
        session = SessionLocal()
        try:
            points_awarded = 0
            transactions = []

            # Check if this is a unique player (first time this user answered this quiz)
            existing_answer = (
                session.query(QuizAnswer)
                .filter(
                    QuizAnswer.quiz_id == quiz_id,
                    QuizAnswer.user_id == answering_user_id,
                )
                .first()
            )

            is_unique_player = existing_answer is None

            # Award points for unique player
            if is_unique_player:
                points_awarded += PointService.POINTS_CREATOR_UNIQUE_PLAYER
                transaction = await PointService._create_transaction(
                    session=session,
                    user_id=creator_user_id,
                    quiz_id=quiz_id,
                    transaction_type=PointTransactionType.QUIZ_CREATOR_UNIQUE_PLAYER,
                    points=PointService.POINTS_CREATOR_UNIQUE_PLAYER,
                    description=f"Unique player answered your quiz",
                )
                transactions.append(transaction)

            # Award bonus points for correct answer
            if is_correct:
                points_awarded += PointService.POINTS_CREATOR_CORRECT_ANSWER_BONUS
                transaction = await PointService._create_transaction(
                    session=session,
                    user_id=creator_user_id,
                    quiz_id=quiz_id,
                    transaction_type=PointTransactionType.QUIZ_CREATOR_CORRECT_ANSWER,
                    points=PointService.POINTS_CREATOR_CORRECT_ANSWER_BONUS,
                    description=f"Player answered correctly in your quiz",
                )
                transactions.append(transaction)

            # Update creator's points
            if points_awarded > 0:
                await PointService._update_user_points(
                    session=session,
                    user_id=creator_user_id,
                    points_to_add=points_awarded,
                    creator_points_to_add=points_awarded,
                )

            session.commit()

            # Invalidate creator's points cache
            await RedisClient.delete_cached_object(f"user_points:{creator_user_id}")

            logger.info(
                f"Awarded {points_awarded} points to creator {creator_user_id} for quiz {quiz_id}"
            )

            return {
                "points_awarded": points_awarded,
                "transactions": [t.id for t in transactions],
            }

        except Exception as e:
            session.rollback()
            logger.error(f"Error awarding quiz creator points: {e}")
            raise
        finally:
            session.close()

    @staticmethod
    async def get_user_points(user_id: str) -> Optional[Dict]:
        """Get user's current point balance and statistics"""
        cache_key = f"user_points:{user_id}"

        # Try cache first
        cached_points = await RedisClient.get_cached_object(cache_key)
        if cached_points:
            return cached_points

        session = SessionLocal()
        try:
            user_points = (
                session.query(UserPoints).filter(UserPoints.user_id == user_id).first()
            )

            if not user_points:
                # Create default user points record
                user_points = UserPoints(user_id=user_id)
                session.add(user_points)
                session.commit()

            points_data = {
                "user_id": user_points.user_id,
                "total_points": user_points.total_points,
                "quiz_creator_points": user_points.quiz_creator_points,
                "quiz_taker_points": user_points.quiz_taker_points,
                "total_correct_answers": user_points.total_correct_answers,
                "total_quizzes_created": user_points.total_quizzes_created,
                "total_quizzes_taken": user_points.total_quizzes_taken,
                "first_correct_answers": user_points.first_correct_answers,
                "last_updated": (
                    user_points.last_updated.isoformat()
                    if user_points.last_updated
                    else None
                ),
            }

            # Cache for 5 minutes
            await RedisClient.set_cached_object(cache_key, points_data, ttl=300)

            return points_data

        except Exception as e:
            logger.error(f"Error getting user points for {user_id}: {e}")
            return None
        finally:
            session.close()

    @staticmethod
    async def get_leaderboard(
        limit: int = 50, leaderboard_type: str = "total"
    ) -> List[Dict]:
        """
        Get points leaderboard

        Args:
            limit: Number of users to return
            leaderboard_type: Type of leaderboard ("total", "creator", "taker")

        Returns:
            List of user leaderboard entries
        """
        cache_key = f"leaderboard:{leaderboard_type}:{limit}"

        # Try cache first
        cached_leaderboard = await RedisClient.get_cached_object(cache_key)
        if cached_leaderboard:
            return cached_leaderboard

        session = SessionLocal()
        try:
            # Determine sort column based on leaderboard type
            if leaderboard_type == "creator":
                sort_column = UserPoints.quiz_creator_points
            elif leaderboard_type == "taker":
                sort_column = UserPoints.quiz_taker_points
            else:  # total
                sort_column = UserPoints.total_points

            # Get leaderboard data
            leaderboard_query = (
                session.query(UserPoints, User.username, User.first_name)
                .join(User, UserPoints.user_id == User.id)
                .order_by(desc(sort_column), desc(UserPoints.last_updated))
                .limit(limit)
            )

            leaderboard = []
            for rank, (user_points, username, first_name) in enumerate(
                leaderboard_query, 1
            ):
                leaderboard.append(
                    {
                        "rank": rank,
                        "user_id": user_points.user_id,
                        "username": username or f"user_{user_points.user_id[:8]}",
                        "first_name": first_name,
                        "total_points": user_points.total_points,
                        "quiz_creator_points": user_points.quiz_creator_points,
                        "quiz_taker_points": user_points.quiz_taker_points,
                        "total_correct_answers": user_points.total_correct_answers,
                        "total_quizzes_created": user_points.total_quizzes_created,
                        "total_quizzes_taken": user_points.total_quizzes_taken,
                    }
                )

            # Cache for 2 minutes
            await RedisClient.set_cached_object(cache_key, leaderboard, ttl=120)

            return leaderboard

        except Exception as e:
            logger.error(f"Error getting leaderboard: {e}")
            return []
        finally:
            session.close()

    @staticmethod
    async def get_user_point_history(user_id: str, limit: int = 50) -> List[Dict]:
        """Get user's point transaction history"""
        session = SessionLocal()
        try:
            transactions = (
                session.query(PointTransaction)
                .filter(PointTransaction.user_id == user_id)
                .order_by(desc(PointTransaction.created_at))
                .limit(limit)
                .all()
            )

            history = []
            for transaction in transactions:
                history.append(
                    {
                        "id": transaction.id,
                        "transaction_type": transaction.transaction_type.value,
                        "points": transaction.points,
                        "description": transaction.description,
                        "quiz_id": transaction.quiz_id,
                        "created_at": transaction.created_at.isoformat(),
                        "metadata": transaction.metadata,
                    }
                )

            return history

        except Exception as e:
            logger.error(f"Error getting point history for {user_id}: {e}")
            return []
        finally:
            session.close()

    @staticmethod
    async def _create_transaction(
        session: Session,
        user_id: str,
        quiz_id: str,
        transaction_type: PointTransactionType,
        points: int,
        description: str,
        metadata: str = None,
    ) -> PointTransaction:
        """Create a point transaction record"""
        transaction = PointTransaction(
            user_id=user_id,
            quiz_id=quiz_id,
            transaction_type=transaction_type,
            points=points,
            description=description,
            metadata=metadata,
        )
        session.add(transaction)
        return transaction

    @staticmethod
    async def _update_user_points(
        session: Session,
        user_id: str,
        points_to_add: int = 0,
        correct_answers_to_add: int = 0,
        creator_points_to_add: int = 0,
        taker_points_to_add: int = 0,
        quizzes_created_to_add: int = 0,
        quizzes_taken_to_add: int = 0,
        first_correct_answers_to_add: int = 0,
    ):
        """Update user's point statistics"""
        user_points = (
            session.query(UserPoints).filter(UserPoints.user_id == user_id).first()
        )

        if not user_points:
            user_points = UserPoints(user_id=user_id)
            session.add(user_points)

        # Update all relevant fields
        user_points.total_points += points_to_add
        user_points.quiz_creator_points += creator_points_to_add
        user_points.quiz_taker_points += taker_points_to_add
        user_points.total_correct_answers += correct_answers_to_add
        user_points.total_quizzes_created += quizzes_created_to_add
        user_points.total_quizzes_taken += quizzes_taken_to_add
        user_points.first_correct_answers += first_correct_answers_to_add
        user_points.last_updated = datetime.utcnow()

    @staticmethod
    async def check_first_correct_answer(quiz_id: str, question_index: int) -> bool:
        """Check if this is the first correct answer for a specific question in a timed quiz"""
        session = SessionLocal()
        try:
            # Check if there are any previous correct answers for this question
            existing_correct = (
                session.query(QuizAnswer)
                .filter(
                    QuizAnswer.quiz_id == quiz_id,
                    QuizAnswer.question_index == question_index,
                    QuizAnswer.is_correct == "True",
                )
                .first()
            )

            return existing_correct is None

        except Exception as e:
            logger.error(f"Error checking first correct answer: {e}")
            return False
        finally:
            session.close()
