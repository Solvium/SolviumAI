#!/usr/bin/env python3
"""
Database migration script to create wallet tables
Run this script to create the new wallet-related tables
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from models import Base
from models.user import User
from models.wallet import UserWallet, WalletSecurity
from utils.config import Config
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def create_wallet_tables():
    """Create wallet-related tables in the database"""
    try:
        # Create engine
        engine = create_engine(Config.DATABASE_URL)
        
        # Create all tables
        Base.metadata.create_all(engine)
        
        logger.info("✅ Successfully created wallet tables")
        
        # Verify tables were created
        with engine.connect() as conn:
            # Check if tables exist
            result = conn.execute(text("""
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name IN ('users', 'user_wallets', 'wallet_security')
            """))
            tables = [row[0] for row in result.fetchall()]
            
            logger.info(f"📋 Created tables: {tables}")
            
            # Show table schemas
            for table_name in tables:
                result = conn.execute(text(f"PRAGMA table_info({table_name})"))
                columns = result.fetchall()
                logger.info(f"📊 Table '{table_name}' columns:")
                for col in columns:
                    logger.info(f"   - {col[1]} ({col[2]})")
        
        logger.info("🎉 Database migration completed successfully!")
        
    except Exception as e:
        logger.error(f"❌ Error creating wallet tables: {e}")
        raise


if __name__ == "__main__":
    create_wallet_tables() 