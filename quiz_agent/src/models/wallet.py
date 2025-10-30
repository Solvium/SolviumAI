from sqlalchemy import (
    Column, String, DateTime, Boolean, Integer, ForeignKey, Index, Text
)
from sqlalchemy.orm import relationship
import datetime
from . import Base


class UserWallet(Base):
    """Model for storing public wallet information"""
    __tablename__ = "user_wallets"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    telegram_user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    account_id = Column(String, nullable=False, unique=True, index=True)  # e.g., "dwarf2e75.kindpuma8958.testnet"
    public_key = Column(String, nullable=False)  # ed25519:...
    
    # Wallet metadata
    is_demo = Column(Boolean, default=False, index=True)
    is_active = Column(Boolean, default=True, index=True)
    network = Column(String, default="testnet", index=True)  # testnet/mainnet
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    last_used_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="wallets")
    security = relationship("WalletSecurity", back_populates="wallet", uselist=False)
    
    # Indexes for performance
    __table_args__ = (
        Index("idx_wallet_user_active", "telegram_user_id", "is_active"),
        Index("idx_wallet_account_network", "account_id", "network"),
    )


class WalletSecurity(Base):
    """Model for storing encrypted private key information"""
    __tablename__ = "wallet_security"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    wallet_id = Column(Integer, ForeignKey("user_wallets.id"), nullable=False, unique=True)
    
    # Encrypted private key data
    encrypted_private_key = Column(Text, nullable=False)  # Base64 encoded encrypted private key
    encryption_iv = Column(String, nullable=False)  # Base64 encoded IV
    encryption_tag = Column(String, nullable=False)  # Base64 encoded authentication tag
    
    # Security metadata
    encryption_version = Column(String, default="AES-256-GCM")  # For future encryption upgrades
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    last_accessed_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    
    # Relationships
    wallet = relationship("UserWallet", back_populates="security")
    
    # Indexes
    __table_args__ = (
        Index("idx_security_wallet_id", "wallet_id"),
    ) 