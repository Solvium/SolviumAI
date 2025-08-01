from sqlalchemy import Column, String, DateTime
from sqlalchemy.orm import relationship  # Import relationship
import datetime
from . import Base


class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True)  # Telegram user ID as string
    wallet_address = Column(String, nullable=True, index=True)  # Added index
    linked_at = Column(DateTime, default=datetime.datetime.utcnow)

    quiz_answers = relationship("QuizAnswer", back_populates="user")  # Add relationship
