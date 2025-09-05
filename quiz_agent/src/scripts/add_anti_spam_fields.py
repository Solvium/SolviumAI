#!/usr/bin/env python3
"""
Database migration script to add anti-spam fields to the Quiz model.

This script adds the following fields to the quizzes table:
- announcement_message_id: Track announcement message IDs for cleanup
- leaderboard_message_id: Track leaderboard message IDs for cleanup
- announcement_deleted_at: When announcement was deleted
- leaderboard_deleted_at: When leaderboard was deleted
- leaderboard_created_at: When leaderboard was created

Run this script to update your database schema.
"""

import sys
import os
from sqlalchemy import text

# Add the src directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import logging
from store.database import engine, SessionLocal

logger = logging.getLogger(__name__)


def add_anti_spam_fields():
    """Add anti-spam fields to the quizzes table"""

    session = SessionLocal()
    try:
        # Check if fields already exist
        result = session.execute(
            text(
                """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'quizzes'
            AND column_name IN ('announcement_message_id', 'leaderboard_message_id',
                               'announcement_deleted_at', 'leaderboard_deleted_at',
                               'leaderboard_created_at')
        """
            )
        )

        existing_columns = [row[0] for row in result.fetchall()]

        if existing_columns:
            logger.info(f"Some anti-spam fields already exist: {existing_columns}")
            logger.info("Skipping creation of existing fields...")

        # Add announcement_message_id if it doesn't exist
        if "announcement_message_id" not in existing_columns:
            session.execute(
                text(
                    """
                ALTER TABLE quizzes
                ADD COLUMN announcement_message_id BIGINT
            """
                )
            )
            logger.info("Added announcement_message_id field")

        # Add leaderboard_message_id if it doesn't exist
        if "leaderboard_message_id" not in existing_columns:
            session.execute(
                text(
                    """
                ALTER TABLE quizzes
                ADD COLUMN leaderboard_message_id BIGINT
            """
                )
            )
            logger.info("Added leaderboard_message_id field")

        # Add announcement_deleted_at if it doesn't exist
        if "announcement_deleted_at" not in existing_columns:
            session.execute(
                text(
                    """
                ALTER TABLE quizzes
                ADD COLUMN announcement_deleted_at TIMESTAMP
            """
                )
            )
            logger.info("Added announcement_deleted_at field")

        # Add leaderboard_deleted_at if it doesn't exist
        if "leaderboard_deleted_at" not in existing_columns:
            session.execute(
                text(
                    """
                ALTER TABLE quizzes
                ADD COLUMN leaderboard_deleted_at TIMESTAMP
            """
                )
            )
            logger.info("Added leaderboard_deleted_at field")

        # Add leaderboard_created_at if it doesn't exist
        if "leaderboard_created_at" not in existing_columns:
            session.execute(
                text(
                    """
                ALTER TABLE quizzes
                ADD COLUMN leaderboard_created_at TIMESTAMP
            """
                )
            )
            logger.info("Added leaderboard_created_at field")

        # Commit the changes
        session.commit()
        logger.info("Successfully added all anti-spam fields to quizzes table")

        # Verify the changes
        result = session.execute(
            text(
                """
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'quizzes'
            AND column_name IN ('announcement_message_id', 'leaderboard_message_id',
                               'announcement_deleted_at', 'leaderboard_deleted_at',
                               'leaderboard_created_at')
            ORDER BY column_name
        """
            )
        )

        logger.info("Verification - Anti-spam fields in quizzes table:")
        for row in result.fetchall():
            logger.info(f"  {row[0]}: {row[1]} (nullable: {row[2]})")

    except Exception as e:
        logger.error(f"Error adding anti-spam fields: {e}")
        session.rollback()
        raise
    finally:
        session.close()


def main():
    """Main function to run the migration"""
    logger.info("Starting anti-spam fields migration...")

    try:
        add_anti_spam_fields()
        logger.info("Migration completed successfully!")

    except Exception as e:
        logger.error(f"Migration failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
