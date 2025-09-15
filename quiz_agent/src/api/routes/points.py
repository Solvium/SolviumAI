"""
API routes for the point system - user points, leaderboards, and point history.
"""

import logging
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel

from services.point_service import PointService

logger = logging.getLogger(__name__)

router = APIRouter()


class UserPointsResponse(BaseModel):
    """Response model for user points"""

    user_id: str
    total_points: int
    quiz_creator_points: int
    quiz_taker_points: int
    total_correct_answers: int
    total_quizzes_created: int
    total_quizzes_taken: int
    first_correct_answers: int
    last_updated: Optional[str]


class LeaderboardEntry(BaseModel):
    """Response model for leaderboard entries"""

    rank: int
    user_id: str
    username: str
    first_name: Optional[str]
    total_points: int
    quiz_creator_points: int
    quiz_taker_points: int
    total_correct_answers: int
    total_quizzes_created: int
    total_quizzes_taken: int


class PointTransactionResponse(BaseModel):
    """Response model for point transactions"""

    id: str
    transaction_type: str
    points: int
    description: str
    quiz_id: Optional[str]
    created_at: str
    metadata: Optional[str]


class LeaderboardResponse(BaseModel):
    """Response model for leaderboard"""

    leaderboard_type: str
    entries: List[LeaderboardEntry]
    total_entries: int


@router.get("/user/{user_id}", response_model=UserPointsResponse)
async def get_user_points(user_id: str):
    """
    Get points and statistics for a specific user.

    Args:
        user_id: The user's Telegram ID

    Returns:
        User's point balance and statistics
    """
    try:
        points_data = await PointService.get_user_points(user_id)

        if not points_data:
            raise HTTPException(status_code=404, detail="User not found")

        return UserPointsResponse(**points_data)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting user points for {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/leaderboard", response_model=LeaderboardResponse)
async def get_leaderboard(
    leaderboard_type: str = Query(
        "total", description="Type of leaderboard: total, creator, or taker"
    ),
    limit: int = Query(10, ge=1, le=100, description="Number of entries to return"),
):
    """
    Get the points leaderboard.

    Args:
        leaderboard_type: Type of leaderboard (total, creator, taker)
        limit: Maximum number of entries to return

    Returns:
        Leaderboard entries sorted by points
    """
    try:
        if leaderboard_type not in ["total", "creator", "taker"]:
            raise HTTPException(
                status_code=400,
                detail="leaderboard_type must be one of: total, creator, taker",
            )

        leaderboard = await PointService.get_leaderboard(
            limit=limit, leaderboard_type=leaderboard_type
        )

        return LeaderboardResponse(
            leaderboard_type=leaderboard_type,
            entries=[LeaderboardEntry(**entry) for entry in leaderboard],
            total_entries=len(leaderboard),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting leaderboard: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/user/{user_id}/history", response_model=List[PointTransactionResponse])
async def get_user_point_history(
    user_id: str,
    limit: int = Query(
        50, ge=1, le=100, description="Number of transactions to return"
    ),
):
    """
    Get point transaction history for a specific user.

    Args:
        user_id: The user's Telegram ID
        limit: Maximum number of transactions to return

    Returns:
        List of point transactions for the user
    """
    try:
        history = await PointService.get_user_point_history(user_id, limit=limit)

        return [PointTransactionResponse(**transaction) for transaction in history]

    except Exception as e:
        logger.error(f"Error getting point history for {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/stats")
async def get_point_system_stats():
    """
    Get overall statistics about the point system.

    Returns:
        Statistics about the point system
    """
    try:
        # Get top leaderboards for different categories
        total_leaderboard = await PointService.get_leaderboard(
            limit=10, leaderboard_type="total"
        )
        creator_leaderboard = await PointService.get_leaderboard(
            limit=10, leaderboard_type="creator"
        )
        taker_leaderboard = await PointService.get_leaderboard(
            limit=10, leaderboard_type="taker"
        )

        # Calculate some basic stats
        total_users = len(total_leaderboard)
        total_points_distributed = sum(
            entry["total_points"] for entry in total_leaderboard
        )

        # Get top performers
        top_creator = creator_leaderboard[0] if creator_leaderboard else None
        top_taker = taker_leaderboard[0] if taker_leaderboard else None
        top_overall = total_leaderboard[0] if total_leaderboard else None

        return {
            "total_users_with_points": total_users,
            "total_points_distributed": total_points_distributed,
            "top_performers": {
                "overall": {
                    "user_id": top_overall["user_id"] if top_overall else None,
                    "username": top_overall["username"] if top_overall else None,
                    "points": top_overall["total_points"] if top_overall else 0,
                },
                "creator": {
                    "user_id": top_creator["user_id"] if top_creator else None,
                    "username": top_creator["username"] if top_creator else None,
                    "points": top_creator["quiz_creator_points"] if top_creator else 0,
                },
                "taker": {
                    "user_id": top_taker["user_id"] if top_taker else None,
                    "username": top_taker["username"] if top_taker else None,
                    "points": top_taker["quiz_taker_points"] if top_taker else 0,
                },
            },
            "point_values": {
                "correct_answer": PointService.POINTS_CORRECT_ANSWER,
                "first_correct_answer_bonus": PointService.POINTS_FIRST_CORRECT_ANSWER_BONUS,
                "creator_unique_player": PointService.POINTS_CREATOR_UNIQUE_PLAYER,
                "creator_correct_answer_bonus": PointService.POINTS_CREATOR_CORRECT_ANSWER_BONUS,
            },
        }

    except Exception as e:
        logger.error(f"Error getting point system stats: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/user/{user_id}/rank")
async def get_user_rank(user_id: str):
    """
    Get a user's rank in the overall leaderboard.

    Args:
        user_id: The user's Telegram ID

    Returns:
        User's rank and surrounding players
    """
    try:
        # Get a larger leaderboard to find the user's rank
        leaderboard = await PointService.get_leaderboard(
            limit=1000, leaderboard_type="total"
        )

        # Find the user's rank
        user_rank = None
        for i, entry in enumerate(leaderboard):
            if entry["user_id"] == user_id:
                user_rank = i + 1
                break

        if user_rank is None:
            raise HTTPException(status_code=404, detail="User not found in leaderboard")

        # Get surrounding players (5 before and after)
        start_idx = max(0, user_rank - 6)  # -1 for 0-based index, -5 for context
        end_idx = min(len(leaderboard), user_rank + 5)

        surrounding_players = leaderboard[start_idx:end_idx]

        return {
            "user_id": user_id,
            "rank": user_rank,
            "total_players": len(leaderboard),
            "surrounding_players": [
                {
                    "rank": start_idx + i + 1,
                    "user_id": player["user_id"],
                    "username": player["username"],
                    "points": player["total_points"],
                }
                for i, player in enumerate(surrounding_players)
            ],
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting user rank for {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
