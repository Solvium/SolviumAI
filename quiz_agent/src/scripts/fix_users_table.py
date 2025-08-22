#!/usr/bin/env python3
"""
Database migration script to fix users table schema
Adds missing columns to the users table
"""

import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text, inspect
from utils.config import Config
from models import Base
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def fix_users_table():
    """Add missing columns to the users table"""
    try:
        # Get database URL and fix format
        database_url = Config.DATABASE_URL

        # Fix PostgreSQL URL format for SQLAlchemy 2.0+
        if database_url.startswith("postgres://"):
            database_url = database_url.replace("postgres://", "postgresql://", 1)
            logger.info("Fixed PostgreSQL URL format for SQLAlchemy 2.0+")

        # Create engine
        engine = create_engine(database_url)

        # Get inspector to check existing tables and columns
        inspector = inspect(engine)
        existing_tables = inspector.get_table_names()

        logger.info(f"📋 Existing tables: {existing_tables}")

        if "users" not in existing_tables:
            logger.error("❌ Users table does not exist!")
            return

        # Check existing columns in users table
        existing_columns = [col["name"] for col in inspector.get_columns("users")]
        logger.info(f"📋 Existing columns in users table: {existing_columns}")

        # Define required columns and their types
        required_columns = {
            "created_at": "TIMESTAMP",
            "linked_at": "TIMESTAMP",
            "last_active_at": "TIMESTAMP",
        }

        missing_columns = []
        for col_name, col_type in required_columns.items():
            if col_name not in existing_columns:
                missing_columns.append((col_name, col_type))
                logger.info(f"➕ Will add column: {col_name} ({col_type})")
            else:
                logger.info(f"✅ Column already exists: {col_name}")

        if not missing_columns:
            logger.info("🎉 All required columns already exist in users table!")
            return

        # Add missing columns
        with engine.connect() as conn:
            for col_name, col_type in missing_columns:
                try:
                    # Add column with default value
                    if col_type == "TIMESTAMP":
                        sql = f"ALTER TABLE users ADD COLUMN {col_name} TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
                    else:
                        sql = f"ALTER TABLE users ADD COLUMN {col_name} {col_type}"

                    logger.info(f"🔨 Executing: {sql}")
                    conn.execute(text(sql))
                    conn.commit()
                    logger.info(f"✅ Successfully added column: {col_name}")

                except Exception as e:
                    logger.error(f"❌ Failed to add column {col_name}: {e}")
                    conn.rollback()

        # Verify the changes
        inspector = inspect(engine)
        final_columns = [col["name"] for col in inspector.get_columns("users")]
        logger.info(f"📋 Final columns in users table: {final_columns}")

        logger.info("🎉 Users table migration completed successfully!")

    except Exception as e:
        logger.error(f"❌ Error fixing users table: {e}")
        raise


def create_all_tables():
    """Create all tables if they don't exist"""
    try:
        # Get database URL and fix format
        database_url = Config.DATABASE_URL

        # Fix PostgreSQL URL format for SQLAlchemy 2.0+
        if database_url.startswith("postgres://"):
            database_url = database_url.replace("postgres://", "postgresql://", 1)
            logger.info("Fixed PostgreSQL URL format for SQLAlchemy 2.0+")

        # Create engine
        engine = create_engine(database_url)

        # Create all tables
        logger.info("🔨 Creating all tables...")
        Base.metadata.create_all(bind=engine)

        # Verify tables were created
        inspector = inspect(engine)
        existing_tables = inspector.get_table_names()
        logger.info(f"📋 All tables created: {existing_tables}")

        logger.info("🎉 All tables created successfully!")

    except Exception as e:
        logger.error(f"❌ Error creating all tables: {e}")
        raise


if __name__ == "__main__":
    # First create all tables
    create_all_tables()
    # Then fix any specific issues
    fix_users_table()
