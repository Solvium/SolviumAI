#!/usr/bin/env python3
"""
Script to fix point breakdown for existing users by recalculating quiz_creator_points and quiz_taker_points
from the point_transactions table.
"""

import sys
import os
import logging
from datetime import datetime

# Add the src directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from store.database import SessionLocal
from models.points import PointTransaction, PointTransactionType, UserPoints
from models.user import User

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def fix_point_breakdown():
    """Fix point breakdown for all users"""
    session = SessionLocal()

    try:
        logger.info("Starting point breakdown fix...")

        # Get all users with points
        users_with_points = (
            session.query(UserPoints).filter(UserPoints.total_points > 0).all()
        )

        fixed_count = 0

        for user_points in users_with_points:
            user_id = user_points.user_id

            # Get all transactions for this user
            transactions = (
                session.query(PointTransaction)
                .filter(PointTransaction.user_id == user_id)
                .all()
            )

            # Recalculate breakdown
            creator_points = 0
            taker_points = 0

            for transaction in transactions:
                if transaction.transaction_type in [
                    PointTransactionType.QUIZ_CREATOR_UNIQUE_PLAYER,
                    PointTransactionType.QUIZ_CREATOR_CORRECT_ANSWER,
                ]:
                    creator_points += transaction.points
                elif transaction.transaction_type in [
                    PointTransactionType.QUIZ_CORRECT_ANSWER,
                    PointTransactionType.QUIZ_FIRST_CORRECT_ANSWER,
                ]:
                    taker_points += transaction.points

            # Update the user points record
            old_creator_points = user_points.quiz_creator_points
            old_taker_points = user_points.quiz_taker_points

            user_points.quiz_creator_points = creator_points
            user_points.quiz_taker_points = taker_points
            user_points.last_updated = datetime.utcnow()

            logger.info(
                f"Fixed user {user_id}: "
                f"creator_points {old_creator_points} -> {creator_points}, "
                f"taker_points {old_taker_points} -> {taker_points}"
            )

            fixed_count += 1

        session.commit()
        logger.info(f"✅ Fixed point breakdown for {fixed_count} users")

    except Exception as e:
        logger.error(f"❌ Fix failed: {e}")
        session.rollback()
        raise
    finally:
        session.close()


if __name__ == "__main__":
    fix_point_breakdown()
