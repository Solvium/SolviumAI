from sqlalchemy import (
    Column,
    String,
    Integer,
    DateTime,
    ForeignKey,
    Index,
    Text,
    Enum,
)
from sqlalchemy.orm import relationship
import enum
import uuid
import datetime
from .user import Base, User


class PointTransactionType(enum.Enum):
    """Types of point transactions"""

    QUIZ_CORRECT_ANSWER = "QUIZ_CORRECT_ANSWER"  # +5 points
    QUIZ_FIRST_CORRECT_ANSWER = "QUIZ_FIRST_CORRECT_ANSWER"  # +3 bonus points
    QUIZ_CREATOR_UNIQUE_PLAYER = "QUIZ_CREATOR_UNIQUE_PLAYER"  # +2 points
    QUIZ_CREATOR_CORRECT_ANSWER = "QUIZ_CREATOR_CORRECT_ANSWER"  # +1 bonus points


class PointTransaction(Base):
    """Model to track individual point transactions"""

    __tablename__ = "point_transactions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    quiz_id = Column(String, ForeignKey("quizzes.id"), nullable=True, index=True)
    transaction_type = Column(Enum(PointTransactionType), nullable=False, index=True)
    points = Column(Integer, nullable=False)  # Can be positive or negative
    description = Column(Text, nullable=True)  # Human-readable description
    metadata = Column(String, nullable=True)  # JSON string for additional data
    created_at = Column(DateTime, default=datetime.datetime.utcnow, index=True)

    # Relationships
    user = relationship("User", back_populates="point_transactions")
    quiz = relationship("Quiz", back_populates="point_transactions")

    # Indexes for common queries
    __table_args__ = (
        Index("idx_user_points_time", "user_id", "created_at"),
        Index("idx_quiz_points", "quiz_id", "transaction_type"),
        Index("idx_points_type_time", "transaction_type", "created_at"),
    )


class UserPoints(Base):
    """Model to track user's current point balance and statistics"""

    __tablename__ = "user_points"

    user_id = Column(String, ForeignKey("users.id"), primary_key=True)
    total_points = Column(Integer, default=0, nullable=False, index=True)
    quiz_creator_points = Column(
        Integer, default=0, nullable=False
    )  # Points earned as creator
    quiz_taker_points = Column(
        Integer, default=0, nullable=False
    )  # Points earned as taker
    total_correct_answers = Column(Integer, default=0, nullable=False)
    total_quizzes_created = Column(Integer, default=0, nullable=False)
    total_quizzes_taken = Column(Integer, default=0, nullable=False)
    first_correct_answers = Column(
        Integer, default=0, nullable=False
    )  # First correct answers in timed quizzes
    last_updated = Column(
        DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow
    )

    # Relationships
    user = relationship("User", back_populates="user_points")

    # Indexes for leaderboard queries
    __table_args__ = (
        Index("idx_total_points_desc", "total_points"),
        Index("idx_creator_points_desc", "quiz_creator_points"),
        Index("idx_taker_points_desc", "quiz_taker_points"),
    )
