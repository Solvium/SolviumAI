import asyncio
import logging
from typing import Optional, Dict, List
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import QueuePool
from sqlalchemy import select, update, delete
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
        
        # Verify initialization
        if not self.async_session:
            logger.error("Database service failed to initialize properly")
        else:
            logger.info("Database service initialized successfully")
    
    def _init_engine(self):
        """Initialize database engine with connection pooling"""
        try:
            database_url = Config.DATABASE_URL
            
            # Check if we're using PostgreSQL
            if 'postgresql' in database_url or 'postgres' in database_url:
                # For PostgreSQL, we need to use asyncpg for async operations
                # But since we might not have asyncpg installed, let's use sync fallback
                logger.info("PostgreSQL detected - using sync engine with async wrapper")
                self._init_sync_engine()
                return
            
            # For SQLite, we can use async operations
            if 'sqlite' in database_url:
                # Use async engine for SQLite
                self.engine = create_async_engine(
                    database_url.replace('sqlite:///', 'sqlite+aiosqlite:///'),
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
                
                logger.info("Async SQLite database engine initialized successfully")
            else:
                # Fallback to sync engine for other databases
                logger.info("Unknown database type - using sync engine with async wrapper")
                self._init_sync_engine()
            
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
            
            # Create a sync session factory
            self.sync_session = sessionmaker(
                self.engine,
                expire_on_commit=False
            )
            
            # Create a wrapper for async compatibility
            self.async_session = self._create_async_wrapper()
            
            logger.info("Sync database engine initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize sync database engine: {e}")
            # Set async_session to None to indicate failure
            self.async_session = None
    
    def _create_async_wrapper(self):
        """Create an async wrapper for sync sessions"""
        class AsyncSessionWrapper:
            def __init__(self, sync_session_factory):
                self.sync_session_factory = sync_session_factory
            
            def __call__(self):
                return self
            
            async def __aenter__(self):
                self.session = self.sync_session_factory()
                return self.session
            
            async def __aexit__(self, exc_type, exc_val, exc_tb):
                if exc_type is not None:
                    self.session.rollback()
                else:
                    self.session.commit()
                self.session.close()
        
        return AsyncSessionWrapper(self.sync_session)
    
    async def save_wallet_async(self, wallet_info: Dict[str, str], user_id: int, user_name: str = None) -> bool:
        """
        Save wallet information to database asynchronously (non-blocking)
        """
        try:
            # Check if database service is properly initialized
            if not self.async_session:
                logger.error(f"Database service not initialized - cannot save wallet for user {user_id}")
                return False
            
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
        session = None
        try:
            # Check if async_session is properly initialized
            if not self.async_session:
                logger.error(f"Database session not initialized for user {user_id}")
                return
            
            logger.debug(f"Starting wallet save for user {user_id}")
            
            # Add debug info about session type
            logger.debug(f"Session type: {type(self.async_session)}")
            
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
                
                # Handle flush for both async and sync sessions
                if hasattr(session, 'flush') and asyncio.iscoroutinefunction(session.flush):
                    await session.flush()  # Async flush
                else:
                    session.flush()  # Sync flush
                
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
                
                # Handle commit for both async and sync sessions
                if hasattr(session, 'commit') and asyncio.iscoroutinefunction(session.commit):
                    await session.commit()  # Async commit
                else:
                    session.commit()  # Sync commit
                
                logger.info(f"Successfully saved wallet to database for user {user_id}")
                
        except Exception as e:
            logger.error(f"Failed to save wallet to database for user {user_id}: {e}")
            if session:
                try:
                    if hasattr(session, 'rollback') and asyncio.iscoroutinefunction(session.rollback):
                        await session.rollback()
                    else:
                        session.rollback()
                except Exception as rollback_error:
                    logger.error(f"Failed to rollback session for user {user_id}: {rollback_error}")
    
    async def _get_or_create_user(self, session, user_id: int, user_name: str = None) -> User:
        """Get existing user or create new one"""
        try:
            # Try to get existing user
            if hasattr(session, 'execute') and asyncio.iscoroutinefunction(session.execute):
                # Async session
                result = await session.execute(
                    select(User).where(User.id == str(user_id))
                )
                user = result.scalar_one_or_none()
            else:
                # Sync session
                user = session.query(User).filter(User.id == str(user_id)).first()
            
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
            if hasattr(session, 'flush') and asyncio.iscoroutinefunction(session.flush):
                await session.flush()
            else:
                session.flush()
            return user
            
        except Exception as e:
            logger.error(f"Error in _get_or_create_user: {e}")
            raise
    
    async def get_user_wallet(self, user_id: int) -> Optional[Dict]:
        """Get user's wallet information"""
        try:
            async with self.async_session() as session:
                if hasattr(session, 'execute') and asyncio.iscoroutinefunction(session.execute):
                    # Async session
                    result = await session.execute(
                        select(UserWallet, WalletSecurity)
                        .join(WalletSecurity)
                        .where(UserWallet.telegram_user_id == str(user_id))
                        .where(UserWallet.is_active == True)
                    )
                    row = result.first()
                else:
                    # Sync session
                    row = session.query(UserWallet, WalletSecurity)\
                        .join(WalletSecurity)\
                        .filter(UserWallet.telegram_user_id == str(user_id))\
                        .filter(UserWallet.is_active == True)\
                        .first()
                
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
                if hasattr(session, 'execute') and asyncio.iscoroutinefunction(session.execute):
                    # Async session
                    result = await session.execute(
                        select(UserWallet.id)
                        .where(UserWallet.telegram_user_id == str(user_id))
                        .where(UserWallet.is_active == True)
                    )
                    return result.scalar_one_or_none() is not None
                else:
                    # Sync session
                    wallet = session.query(UserWallet.id)\
                        .filter(UserWallet.telegram_user_id == str(user_id))\
                        .filter(UserWallet.is_active == True)\
                        .first()
                    return wallet is not None
                
        except Exception as e:
            logger.error(f"Error checking if user has wallet: {e}")
            return False
    
    async def update_wallet_usage(self, user_id: int) -> None:
        """Update wallet last used timestamp"""
        try:
            async with self.async_session() as session:
                if hasattr(session, 'execute') and asyncio.iscoroutinefunction(session.execute):
                    # Async session
                    await session.execute(
                        update(UserWallet)
                        .where(UserWallet.telegram_user_id == str(user_id))
                        .where(UserWallet.is_active == True)
                        .values(last_used_at=datetime.datetime.utcnow())
                    )
                    await session.commit()
                else:
                    # Sync session
                    session.query(UserWallet)\
                        .filter(UserWallet.telegram_user_id == str(user_id))\
                        .filter(UserWallet.is_active == True)\
                        .update({'last_used_at': datetime.datetime.utcnow()})
                    session.commit()
                
        except Exception as e:
            logger.error(f"Error updating wallet usage: {e}")
    
    async def delete_user_wallet_data(self, user_id: int) -> bool:
        """Delete all wallet data for a user from database"""
        try:
            async with self.async_session() as session:
                if hasattr(session, 'execute') and asyncio.iscoroutinefunction(session.execute):
                    # Async session - delete wallet security records first (due to foreign key)
                    await session.execute(
                        delete(WalletSecurity)
                        .where(WalletSecurity.wallet_id.in_(
                            select(UserWallet.id)
                            .where(UserWallet.telegram_user_id == str(user_id))
                        ))
                    )
                    
                    # Delete user wallet records
                    await session.execute(
                        delete(UserWallet)
                        .where(UserWallet.telegram_user_id == str(user_id))
                    )
                    
                    # Update user record to reset wallet_created flag
                    await session.execute(
                        update(User)
                        .where(User.id == str(user_id))
                        .values(wallet_created=False)
                    )
                    
                    await session.commit()
                else:
                    # Sync session - delete wallet security records first (due to foreign key)
                    wallet_ids = session.query(UserWallet.id)\
                        .filter(UserWallet.telegram_user_id == str(user_id))\
                        .all()
                    
                    wallet_id_list = [w[0] for w in wallet_ids]
                    
                    if wallet_id_list:
                        session.query(WalletSecurity)\
                            .filter(WalletSecurity.wallet_id.in_(wallet_id_list))\
                            .delete(synchronize_session=False)
                    
                    # Delete user wallet records
                    session.query(UserWallet)\
                        .filter(UserWallet.telegram_user_id == str(user_id))\
                        .delete(synchronize_session=False)
                    
                    # Update user record to reset wallet_created flag
                    session.query(User)\
                        .filter(User.id == str(user_id))\
                        .update({'wallet_created': False})
                    
                    session.commit()
                
                logger.info(f"Successfully deleted wallet data for user {user_id}")
                return True
                
        except Exception as e:
            logger.error(f"Error deleting wallet data for user {user_id}: {e}")
            return False


# Global database service instance
db_service = DatabaseService() 