#!/usr/bin/env python3
"""
Database migration script to add point system tables and update existing tables.

This script:
1. Adds creator_id field to quizzes table
2. Creates point_transactions table
3. Creates user_points table
4. Updates existing quizzes with creator_id (if possible to determine)
"""

import sys
import os
import logging
from datetime import datetime

# Add the src directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from store.database import SessionLocal, engine
from sqlalchemy import text, inspect
from models.quiz import Quiz
from models.user import User
from models.points import PointTransaction, UserPoints

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def table_exists(table_name):
    """Check if a table exists in the database"""
    inspector = inspect(engine)
    return table_name in inspector.get_table_names()


def column_exists(table_name, column_name):
    """Check if a column exists in a table"""
    inspector = inspect(engine)
    columns = inspector.get_columns(table_name)
    return any(col["name"] == column_name for col in columns)


def run_migration():
    """Run the point system migration"""
    session = SessionLocal()

    try:
        logger.info("Starting point system migration...")

        # 1. Add creator_id column to quizzes table if it doesn't exist
        if table_exists("quizzes") and not column_exists("quizzes", "creator_id"):
            logger.info("Adding creator_id column to quizzes table...")
            session.execute(
                text(
                    """
                ALTER TABLE quizzes
                ADD COLUMN creator_id VARCHAR(255)
            """
                )
            )
            session.execute(
                text(
                    """
                CREATE INDEX ix_quizzes_creator_id ON quizzes (creator_id)
            """
                )
            )
            session.commit()
            logger.info("✅ Added creator_id column to quizzes table")
        else:
            logger.info("✅ creator_id column already exists in quizzes table")

        # 2. Create point_transactions table if it doesn't exist
        if not table_exists("point_transactions"):
            logger.info("Creating point_transactions table...")
            PointTransaction.__table__.create(engine, checkfirst=True)
            logger.info("✅ Created point_transactions table")
        else:
            logger.info("✅ point_transactions table already exists")

        # 3. Create user_points table if it doesn't exist
        if not table_exists("user_points"):
            logger.info("Creating user_points table...")
            UserPoints.__table__.create(engine, checkfirst=True)
            logger.info("✅ Created user_points table")
        else:
            logger.info("✅ user_points table already exists")

        # 4. Initialize user_points records for existing users
        logger.info("Initializing user_points records for existing users...")
        existing_users = session.query(User).all()
        initialized_count = 0

        for user in existing_users:
            existing_points = (
                session.query(UserPoints).filter(UserPoints.user_id == user.id).first()
            )

            if not existing_points:
                user_points = UserPoints(user_id=user.id)
                session.add(user_points)
                initialized_count += 1

        session.commit()
        logger.info(f"✅ Initialized {initialized_count} user_points records")

        # 5. Try to populate creator_id for existing quizzes (if possible)
        logger.info("Attempting to populate creator_id for existing quizzes...")
        quizzes_without_creator = (
            session.query(Quiz).filter(Quiz.creator_id.is_(None)).all()
        )

        populated_count = 0
        for quiz in quizzes_without_creator:
            # For existing quizzes, we can't determine the creator
            # We'll leave them as NULL for now
            # In a real scenario, you might have this information in logs or other sources
            pass

        logger.info(f"✅ Migration completed successfully")
        logger.info(
            f"   - {len(quizzes_without_creator)} quizzes without creator_id (left as NULL)"
        )
        logger.info(f"   - {initialized_count} user_points records initialized")

    except Exception as e:
        logger.error(f"❌ Migration failed: {e}")
        session.rollback()
        raise
    finally:
        session.close()


def rollback_migration():
    """Rollback the point system migration (for testing purposes)"""
    session = SessionLocal()

    try:
        logger.info("Rolling back point system migration...")

        # Drop tables in reverse order (due to foreign key constraints)
        if table_exists("point_transactions"):
            logger.info("Dropping point_transactions table...")
            session.execute(text("DROP TABLE IF EXISTS point_transactions"))

        if table_exists("user_points"):
            logger.info("Dropping user_points table...")
            session.execute(text("DROP TABLE IF EXISTS user_points"))

        # Remove creator_id column from quizzes table
        if table_exists("quizzes") and column_exists("quizzes", "creator_id"):
            logger.info("Removing creator_id column from quizzes table...")
            session.execute(text("DROP INDEX IF EXISTS ix_quizzes_creator_id"))
            session.execute(
                text("ALTER TABLE quizzes DROP COLUMN IF EXISTS creator_id")
            )

        session.commit()
        logger.info("✅ Rollback completed successfully")

    except Exception as e:
        logger.error(f"❌ Rollback failed: {e}")
        session.rollback()
        raise
    finally:
        session.close()


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Point system database migration")
    parser.add_argument(
        "--rollback", action="store_true", help="Rollback the migration"
    )
    args = parser.parse_args()

    if args.rollback:
        rollback_migration()
    else:
        run_migration()
