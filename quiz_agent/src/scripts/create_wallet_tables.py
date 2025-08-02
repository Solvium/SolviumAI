#!/usr/bin/env python3
"""
Database migration script to create wallet tables
Run this script to create the new wallet-related tables
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text, inspect
from models.wallet import UserWallet, WalletSecurity
from models.user import User
from utils.config import Config
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def create_wallet_tables():
    """Create only wallet-related tables in the database"""
    try:
        # Create engine
        engine = create_engine(Config.DATABASE_URL)
        
        # Get inspector to check existing tables
        inspector = inspect(engine)
        existing_tables = inspector.get_table_names()
        
        logger.info(f"📋 Existing tables: {existing_tables}")
        
        # Only create wallet tables if they don't exist
        wallet_tables = ['user_wallets', 'wallet_security']
        tables_to_create = []
        
        for table_name in wallet_tables:
            if table_name not in existing_tables:
                tables_to_create.append(table_name)
                logger.info(f"➕ Will create table: {table_name}")
            else:
                logger.info(f"✅ Table already exists: {table_name}")
        
        if not tables_to_create:
            logger.info("🎉 All wallet tables already exist!")
            return
        
        # Create only the wallet tables
        logger.info(f"🔨 Creating tables: {tables_to_create}")
        
        # Create UserWallet table
        if 'user_wallets' in tables_to_create:
            UserWallet.__table__.create(engine, checkfirst=True)
            logger.info("✅ Created user_wallets table")
        
        # Create WalletSecurity table
        if 'wallet_security' in tables_to_create:
            WalletSecurity.__table__.create(engine, checkfirst=True)
            logger.info("✅ Created wallet_security table")
        
        # Verify tables were created
        with engine.connect() as conn:
            # Check if tables exist
            result = conn.execute(text("""
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name IN ('user_wallets', 'wallet_security')
            """))
            tables = [row[0] for row in result.fetchall()]
            
            logger.info(f"📋 Wallet tables: {tables}")
            
            # Show table schemas
            for table_name in tables:
                result = conn.execute(text(f"PRAGMA table_info({table_name})"))
                columns = result.fetchall()
                logger.info(f"📊 Table '{table_name}' columns:")
                for col in columns:
                    logger.info(f"   - {col[1]} ({col[2]})")
        
        logger.info("🎉 Wallet tables migration completed successfully!")
        
    except Exception as e:
        logger.error(f"❌ Error creating wallet tables: {e}")
        raise


if __name__ == "__main__":
    create_wallet_tables() 