from sqlalchemy import (
    Column,
    String,
    Enum,
    JSON,
    DateTime,
    BigInteger,
    Boolean,
    ForeignKey,
    Index,
)
from sqlalchemy.orm import relationship
import enum
import uuid
import datetime
from .user import Base, User


class QuizStatus(enum.Enum):
    DRAFT = "DRAFT"
    FUNDING = "FUNDING"
    ACTIVE = "ACTIVE"
    CLOSED = "CLOSED"


class Quiz(Base):
    __tablename__ = "quizzes"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    topic = Column(String, nullable=False)
    questions = Column(JSON, default=[])
    status = Column(
        Enum(QuizStatus), default=QuizStatus.DRAFT, index=True
    )  # Added index
    # Reward details and on-chain address
    reward_schedule = Column(JSON, default={})
    deposit_address = Column(String, nullable=True)
    payment_transaction_hash = Column(
        String,
        nullable=True,
        unique=True,
        index=True,  # Added index and unique constraint
    )  # For user's funding transaction
    # New columns
    last_updated = Column(
        DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow
    )
    group_chat_id = Column(
        BigInteger, nullable=True, index=True  # Added index
    )  # Changed from Integer to BigInteger
    # Quiz end time
    end_time = Column(DateTime, nullable=True)
    # Track if winners have been announced
    winners_announced = Column(Boolean, default=False)  # Changed from String to Boolean
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    activated_at = Column(
        DateTime, nullable=True
    )  # Timestamp for when quiz becomes active
    duration_seconds = Column(BigInteger, nullable=True)  # Store the intended duration

    # Message tracking for anti-spam features
    announcement_message_id = Column(
        BigInteger, nullable=True
    )  # Track announcement message ID
    leaderboard_message_id = Column(
        BigInteger, nullable=True
    )  # Track leaderboard message ID
    announcement_deleted_at = Column(
        DateTime, nullable=True
    )  # When announcement was deleted
    leaderboard_deleted_at = Column(
        DateTime, nullable=True
    )  # When leaderboard was deleted
    leaderboard_created_at = Column(
        DateTime, nullable=True
    )  # When leaderboard was created

    # Token payment fields
    payment_method = Column(String, default="NEAR")  # "NEAR" or "TOKEN"
    token_contract_address = Column(String, nullable=True)  # e.g., "usdt.near"
    token_payment_amount = Column(String, nullable=True)  # Amount paid in tokens

    answers = relationship("QuizAnswer", back_populates="quiz")  # Add relationship


class QuizAnswer(Base):
    """Model to track user answers to quizzes"""

    __tablename__ = "quiz_answers"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    quiz_id = Column(
        String, ForeignKey("quizzes.id"), nullable=False, index=True
    )  # Add ForeignKey
    user_id = Column(
        String, ForeignKey("users.id"), nullable=False, index=True
    )  # Add ForeignKey
    username = Column(String, nullable=True)  # For displaying winners
    answer = Column(String, nullable=False)  # User's selected answer (e.g., "A", "B")
    is_correct = Column(
        String,
        nullable=False,
        default="False",
        index=True,  # Explicitly default to "False" as string
    )
    answered_at = Column(
        DateTime, default=datetime.datetime.utcnow, index=True
    )  # Add index for time-based queries
    question_index = Column(
        BigInteger, nullable=True, index=True
    )  # Track which question this answers

    # Add composite indexes for common query patterns
    __table_args__ = (
        # Optimize leaderboard queries
        Index("idx_quiz_correct_time", "quiz_id", "is_correct", "answered_at"),
        # Optimize user participation checks
        Index("idx_user_quiz_lookup", "user_id", "quiz_id"),
        # Optimize question-specific queries
        Index("idx_user_quiz_question", "user_id", "quiz_id", "question_index"),
    )

    quiz = relationship("Quiz", back_populates="answers")  # Add relationship
    user = relationship(
        User, back_populates="quiz_answers"
    )  # Changed from string to direct class reference

    # Quick helper to compute rank based on correct answers and speed
    @staticmethod
    def compute_quiz_winners(session, quiz_id):
        """Compute winners for a quiz based on correct answers and timing"""
        # Import User model here to avoid circular imports
        from models.user import User

        # Get all correct answers for this quiz
        # Fix: Use string 'True' instead of boolean True for comparison
        correct_answers = (
            session.query(QuizAnswer)
            .filter(QuizAnswer.quiz_id == quiz_id, QuizAnswer.is_correct == "True")
            .order_by(QuizAnswer.answered_at)
            .all()
        )

        # Group by user and count correct answers
        user_scores = {}
        for answer in correct_answers:
            if answer.user_id not in user_scores:
                # Always get the current username from the User table
                user = session.query(User).filter(User.id == answer.user_id).first()
                actual_username = (
                    user.username
                    if user and user.username
                    else f"user_{answer.user_id[:8]}"
                )

                user_scores[answer.user_id] = {
                    "user_id": answer.user_id,
                    "username": actual_username,
                    "correct_count": 1,
                    "first_answer_time": answer.answered_at,
                }
            else:
                user_scores[answer.user_id]["correct_count"] += 1

        # Sort by correct count (desc) and then by time (asc)
        sorted_scores = sorted(
            user_scores.values(),
            key=lambda x: (-x["correct_count"], x["first_answer_time"]),
        )

        return sorted_scores

    @staticmethod
    def get_quiz_participants_ranking(session, quiz_id):
        """
        Computes a ranked list of all participants for a quiz.
        Ranking:
        1. Number of correct answers (descending)
        2. Time of first correct answer (ascending, for those with >0 correct answers)
        3. Time of earliest answer (ascending, for those with 0 correct answers or as tie-breaker)
        """
        # Import User model here to avoid circular imports
        from models.user import User

        all_answers = (
            session.query(QuizAnswer)
            .filter(QuizAnswer.quiz_id == quiz_id)
            .filter(QuizAnswer.answer != "")  # Exclude empty "started" records
            .order_by(QuizAnswer.user_id, QuizAnswer.answered_at)
            .all()
        )

        user_stats = {}
        for ans in all_answers:
            if ans.user_id not in user_stats:
                # Always get the current username from the User table
                user = session.query(User).filter(User.id == ans.user_id).first()
                actual_username = (
                    user.username
                    if user and user.username
                    else f"user_{ans.user_id[:8]}"
                )

                user_stats[ans.user_id] = {
                    "user_id": ans.user_id,
                    "username": actual_username,
                    "correct_count": 0,
                    "questions_answered": 0,
                    "first_correct_answer_time": None,
                    "earliest_answer_time": ans.answered_at,  # Initialize with the first answer encountered
                    "last_answer_time": ans.answered_at,
                }

            stats = user_stats[ans.user_id]
            stats["questions_answered"] += 1
            stats["last_answer_time"] = ans.answered_at
            if ans.is_correct == "True":  # Comparison with string "True"
                stats["correct_count"] += 1
                if stats["first_correct_answer_time"] is None:
                    stats["first_correct_answer_time"] = ans.answered_at

            # Ensure earliest_answer_time is indeed the earliest
            if ans.answered_at < stats["earliest_answer_time"]:
                stats["earliest_answer_time"] = ans.answered_at

        # Convert to list for sorting
        ranked_participants = list(user_stats.values())

        # Sort participants
        # Max datetime for sorting Nones last when ascending
        max_datetime = datetime.datetime.max
        # If answered_at is timezone-aware, use:
        # max_datetime = datetime.datetime.max.replace(tzinfo=datetime.timezone.utc)

        ranked_participants.sort(
            key=lambda x: (
                -x["correct_count"],  # Primary: more correct answers first
                (
                    x["first_correct_answer_time"]
                    if x["first_correct_answer_time"]
                    else max_datetime
                ),  # Secondary: faster first correct answer
                x[
                    "earliest_answer_time"
                ],  # Tertiary: faster overall earliest answer as further tie-breaker
            )
        )
        return ranked_participants
