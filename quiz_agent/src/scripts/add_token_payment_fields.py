#!/usr/bin/env python3
"""
Database migration script to add token payment fields to quizzes table
"""
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from store.database import engine
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def add_token_payment_fields():
    """Add token payment fields to quizzes table"""
    try:
        with engine.connect() as conn:
            # Check if columns already exist
            result = conn.execute(
                text(
                    """
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'quizzes'
                AND column_name IN ('payment_method', 'token_contract_address', 'token_payment_amount')
            """
                )
            )
            existing_columns = [row[0] for row in result.fetchall()]

            # Add columns that don't exist
            if "payment_method" not in existing_columns:
                conn.execute(
                    text(
                        """
                    ALTER TABLE quizzes
                    ADD COLUMN payment_method VARCHAR(10) DEFAULT 'NEAR'
                """
                    )
                )
                logger.info("Added payment_method column")

            if "token_contract_address" not in existing_columns:
                conn.execute(
                    text(
                        """
                    ALTER TABLE quizzes
                    ADD COLUMN token_contract_address VARCHAR(255)
                """
                    )
                )
                logger.info("Added token_contract_address column")

            if "token_payment_amount" not in existing_columns:
                conn.execute(
                    text(
                        """
                    ALTER TABLE quizzes
                    ADD COLUMN token_payment_amount VARCHAR(50)
                """
                    )
                )
                logger.info("Added token_payment_amount column")

            conn.commit()
            logger.info("Token payment fields added successfully")

    except Exception as e:
        logger.error(f"Error adding token payment fields: {e}")
        raise


if __name__ == "__main__":
    add_token_payment_fields()
