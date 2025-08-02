import asyncio
import logging
from typing import Optional, Dict, List
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import QueuePool
from sqlalchemy import select, update
from models.user import User
from models.wallet import UserWallet, WalletSecurity
from utils.config import Config
import datetime

logger = logging.getLogger(__name__)


class DatabaseService:
    """Service for database operations with connection pooling and async support"""
    
    def __init__(self):
        self.engine = None
        self.async_session = None
        self._init_engine()
    
    def _init_engine(self):
        """Initialize database engine with connection pooling"""
        try:
            # Use async engine for better performance
            self.engine = create_async_engine(
                Config.DATABASE_URL.replace('sqlite:///', 'sqlite+aiosqlite:///'),
                poolclass=QueuePool,
                pool_size=20,
                max_overflow=30,
                pool_pre_ping=True,
                echo=False  # Set to True for SQL debugging
            )
            
            # Create async session factory
            self.async_session = async_sessionmaker(
                self.engine,
                class_=AsyncSession,
                expire_on_commit=False
            )
            
            logger.info("Database engine initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize database engine: {e}")
            # Fallback to sync engine if async not available
            self._init_sync_engine()
    
    def _init_sync_engine(self):
        """Fallback to sync engine"""
        try:
            from sqlalchemy import create_engine
            self.engine = create_engine(
                Config.DATABASE_URL,
                poolclass=QueuePool,
                pool_size=20,
                max_overflow=30,
                pool_pre_ping=True
            )
            
            self.async_session = sessionmaker(
                self.engine,
                expire_on_commit=False
            )
            
            logger.info("Sync database engine initialized as fallback")
            
        except Exception as e:
            logger.error(f"Failed to initialize sync database engine: {e}")
    
    async def save_wallet_async(self, wallet_info: Dict[str, str], user_id: int, user_name: str = None) -> bool:
        """
        Save wallet information to database asynchronously (non-blocking)
        """
        try:
            # Fire and forget - don't await
            asyncio.create_task(self._save_wallet_background(wallet_info, user_id, user_name))
            return True
        except Exception as e:
            logger.error(f"Failed to queue wallet save operation: {e}")
            return False
    
    async def _save_wallet_background(self, wallet_info: Dict[str, str], user_id: int, user_name: str = None) -> None:
        """
        Background task to save wallet information
        """
        try:
            async with self.async_session() as session:
                # Create or update user
                user = await self._get_or_create_user(session, user_id, user_name)
                
                # Create wallet record
                wallet = UserWallet(
                    telegram_user_id=str(user_id),
                    account_id=wallet_info['account_id'],
                    public_key=wallet_info['public_key'],
                    is_demo=wallet_info.get('is_demo', False),
                    network=wallet_info.get('network', 'testnet')
                )
                
                session.add(wallet)
                await session.flush()  # Get the wallet ID
                
                # Create security record
                security = WalletSecurity(
                    wallet_id=wallet.id,
                    encrypted_private_key=wallet_info['encrypted_private_key'],
                    encryption_iv=wallet_info['iv'],
                    encryption_tag=wallet_info['tag']
                )
                
                session.add(security)
                
                # Update user wallet status
                user.wallet_created = True
                user.last_active_at = datetime.datetime.utcnow()
                
                await session.commit()
                logger.info(f"Successfully saved wallet to database for user {user_id}")
                
        except Exception as e:
            logger.error(f"Failed to save wallet to database for user {user_id}: {e}")
            if session:
                await session.rollback()
    
    async def _get_or_create_user(self, session, user_id: int, user_name: str = None) -> User:
        """Get existing user or create new one"""
        try:
            # Try to get existing user
            result = await session.execute(
                select(User).where(User.id == str(user_id))
            )
            user = result.scalar_one_or_none()
            
            if user:
                # Update last active time
                user.last_active_at = datetime.datetime.utcnow()
                if user_name and not user.first_name:
                    user.first_name = user_name
                return user
            
            # Create new user
            user = User(
                id=str(user_id),
                username=user_name,
                first_name=user_name,
                created_at=datetime.datetime.utcnow(),
                last_active_at=datetime.datetime.utcnow()
            )
            
            session.add(user)
            await session.flush()
            return user
            
        except Exception as e:
            logger.error(f"Error in _get_or_create_user: {e}")
            raise
    
    async def get_user_wallet(self, user_id: int) -> Optional[Dict]:
        """Get user's wallet information"""
        try:
            async with self.async_session() as session:
                result = await session.execute(
                    select(UserWallet, WalletSecurity)
                    .join(WalletSecurity)
                    .where(UserWallet.telegram_user_id == str(user_id))
                    .where(UserWallet.is_active == True)
                )
                
                row = result.first()
                if row:
                    wallet, security = row
                    return {
                        'account_id': wallet.account_id,
                        'public_key': wallet.public_key,
                        'is_demo': wallet.is_demo,
                        'network': wallet.network,
                        'encrypted_private_key': security.encrypted_private_key,
                        'iv': security.encryption_iv,
                        'tag': security.encryption_tag
                    }
                return None
                
        except Exception as e:
            logger.error(f"Error getting user wallet: {e}")
            return None
    
    async def has_wallet(self, user_id: int) -> bool:
        """Check if user has a wallet"""
        try:
            async with self.async_session() as session:
                result = await session.execute(
                    select(UserWallet.id)
                    .where(UserWallet.telegram_user_id == str(user_id))
                    .where(UserWallet.is_active == True)
                )
                return result.scalar_one_or_none() is not None
                
        except Exception as e:
            logger.error(f"Error checking if user has wallet: {e}")
            return False
    
    async def update_wallet_usage(self, user_id: int) -> None:
        """Update wallet last used timestamp"""
        try:
            async with self.async_session() as session:
                await session.execute(
                    update(UserWallet)
                    .where(UserWallet.telegram_user_id == str(user_id))
                    .where(UserWallet.is_active == True)
                    .values(last_used_at=datetime.datetime.utcnow())
                )
                await session.commit()
                
        except Exception as e:
            logger.error(f"Error updating wallet usage: {e}")


# Global database service instance
db_service = DatabaseService() 