from sqlalchemy import Column, String, DateTime, Boolean, BigInteger
from sqlalchemy.orm import relationship
import datetime
from . import Base


class User(Base):
    __tablename__ = "users"
    
    # Core user identification
    id = Column(String, primary_key=True)  # Telegram user ID as string
    username = Column(String, nullable=True, index=True)
    first_name = Column(String, nullable=True)
    last_name = Column(String, nullable=True)
    
    # Wallet information
    wallet_address = Column(String, nullable=True, index=True)  # Legacy field for manually linked wallets
    wallet_created = Column(Boolean, default=False, index=True)  # Track if auto-wallet was created
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    linked_at = Column(DateTime, default=datetime.datetime.utcnow)
    last_active_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    
    # Relationships
    quiz_answers = relationship("QuizAnswer", back_populates="user")
    wallets = relationship("UserWallet", back_populates="user")
