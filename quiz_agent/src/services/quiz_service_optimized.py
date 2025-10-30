"""
High-performance Quiz Service with advanced caching and batch operations.
Optimized for real-time quiz gameplay with minimal latency.
"""

import asyncio
import time
import json
import logging
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict

from utils.redis_client import RedisClient
from services.performance_service import (
    redis_cache,
    performance_monitor,
    bulk_manager,
    connection_pool,
    optimize_quiz_cache,
)

logger = logging.getLogger(__name__)


@dataclass
class QuizQuestion:
    """Quiz question data structure."""

    id: str
    question: str
    options: List[str]
    correct_answer: int
    explanation: str
    difficulty: str
    category: str
    time_limit: int = 30


@dataclass
class QuizParticipant:
    """Quiz participant data structure."""

    user_id: str
    username: str
    score: int = 0
    correct_answers: int = 0
    total_answers: int = 0
    join_time: datetime = None
    last_answer_time: datetime = None


@dataclass
class QuizState:
    """Quiz state data structure."""

    quiz_id: str
    status: str  # 'waiting', 'active', 'completed'
    current_question: int
    total_questions: int
    start_time: Optional[datetime]
    end_time: Optional[datetime]
    participants: Dict[str, QuizParticipant]
    questions: List[QuizQuestion]
    topic: str
    duration_minutes: int


class HighPerformanceQuizService:
    """Ultra-fast quiz service optimized for real-time gameplay."""

    def __init__(self):
        self.quiz_cache_ttl = {
            "active": 60,  # 1 minute for active quizzes
            "waiting": 300,  # 5 minutes for waiting quizzes
            "completed": 3600,  # 1 hour for completed quizzes
        }
        self.leaderboard_cache_ttl = 30  # 30 seconds for real-time updates

    @redis_cache(ttl=60, key_prefix="quiz_state")
    @performance_monitor("get_quiz_state")
    async def get_quiz_state(self, quiz_id: str) -> Optional[QuizState]:
        """Get quiz state with aggressive caching for active quizzes."""
        try:
            # Try multiple cache layers
            cache_key = f"quiz_state:{quiz_id}"
            cached_state = await RedisClient.get_value(cache_key)

            if cached_state:
                # Deserialize quiz state
                return self._deserialize_quiz_state(cached_state)

            # If not cached, this would typically load from database
            # For now, return None (implement database loading as needed)
            return None

        except Exception as e:
            logger.error(f"Error getting quiz state for {quiz_id}: {e}")
            return None

    @performance_monitor("create_quiz")
    async def create_quiz_optimized(
        self,
        topic: str,
        duration_minutes: int,
        creator_id: str,
        num_questions: int = 10,
    ) -> str:
        """Create a new quiz with optimized caching."""
        try:
            quiz_id = f"quiz_{int(time.time())}_{creator_id}"

            # Generate questions (this would integrate with your AI service)
            questions = await self._generate_questions_cached(topic, num_questions)

            # Create quiz state
            quiz_state = QuizState(
                quiz_id=quiz_id,
                status="waiting",
                current_question=0,
                total_questions=len(questions),
                start_time=None,
                end_time=None,
                participants={},
                questions=questions,
                topic=topic,
                duration_minutes=duration_minutes,
            )

            # Cache quiz state with appropriate TTL
            await self._cache_quiz_state(quiz_state)

            # Add to active quizzes index
            await self._add_to_quiz_index(quiz_id, topic, creator_id)

            # Preload related cache data
            await self._preload_quiz_cache(quiz_id)

            logger.info(f"Created optimized quiz {quiz_id} for topic '{topic}'")
            return quiz_id

        except Exception as e:
            logger.error(f"Error creating optimized quiz: {e}")
            raise

    @redis_cache(ttl=1800, key_prefix="quiz_questions")
    async def _generate_questions_cached(
        self, topic: str, num_questions: int
    ) -> List[QuizQuestion]:
        """Generate questions with caching to avoid repeated AI calls."""
        try:
            # Check if we have cached questions for this topic
            cache_key = f"questions_{topic}_{num_questions}"
            cached_questions = await RedisClient.get_value(cache_key)

            if cached_questions:
                return [self._deserialize_question(q) for q in cached_questions]

            # Generate new questions (integrate with your AI service)
            questions = await self._generate_fresh_questions(topic, num_questions)

            # Cache the questions
            serialized_questions = [asdict(q) for q in questions]
            await RedisClient.set_value(
                cache_key, serialized_questions, ttl_seconds=1800
            )

            return questions

        except Exception as e:
            logger.error(f"Error generating cached questions for topic {topic}: {e}")
            return []

    async def _generate_fresh_questions(
        self, topic: str, num_questions: int
    ) -> List[QuizQuestion]:
        """Generate fresh questions (implement with your AI service)."""
        # This is a placeholder - implement with your actual question generation logic
        questions = []
        for i in range(num_questions):
            question = QuizQuestion(
                id=f"q_{i}_{int(time.time())}",
                question=f"Sample question {i+1} about {topic}",
                options=["Option A", "Option B", "Option C", "Option D"],
                correct_answer=0,
                explanation=f"Explanation for question {i+1}",
                difficulty="medium",
                category=topic,
                time_limit=30,
            )
            questions.append(question)

        return questions

    @performance_monitor("join_quiz")
    async def join_quiz_optimized(
        self, quiz_id: str, user_id: str, username: str
    ) -> bool:
        """Join quiz with optimized performance."""
        try:
            # Get quiz state
            quiz_state = await self.get_quiz_state(quiz_id)
            if not quiz_state:
                logger.warning(f"Quiz {quiz_id} not found for user {user_id}")
                return False

            if quiz_state.status != "waiting":
                logger.warning(
                    f"Cannot join quiz {quiz_id} - status: {quiz_state.status}"
                )
                return False

            # Create participant
            participant = QuizParticipant(
                user_id=user_id, username=username, join_time=datetime.now()
            )

            # Add participant to quiz state
            quiz_state.participants[user_id] = participant

            # Update cached quiz state
            await self._cache_quiz_state(quiz_state)

            # Update participant count cache for real-time updates
            participant_count = len(quiz_state.participants)
            await RedisClient.set_value(
                f"quiz_participant_count:{quiz_id}", participant_count, ttl_seconds=60
            )

            # Optimize cache settings based on participant count
            await optimize_quiz_cache(quiz_id, participant_count)

            # Add to bulk metrics collection
            await bulk_manager.add_operation(
                "quiz_metrics",
                {
                    "action": "user_joined",
                    "quiz_id": quiz_id,
                    "user_id": user_id,
                    "participant_count": participant_count,
                    "timestamp": datetime.now().isoformat(),
                },
            )

            logger.info(
                f"User {user_id} joined quiz {quiz_id} (total participants: {participant_count})"
            )
            return True

        except Exception as e:
            logger.error(f"Error joining quiz {quiz_id} for user {user_id}: {e}")
            return False

    @performance_monitor("start_quiz")
    async def start_quiz_optimized(self, quiz_id: str) -> bool:
        """Start quiz with performance optimizations."""
        try:
            quiz_state = await self.get_quiz_state(quiz_id)
            if not quiz_state or quiz_state.status != "waiting":
                return False

            # Update quiz state
            quiz_state.status = "active"
            quiz_state.start_time = datetime.now()
            quiz_state.end_time = datetime.now() + timedelta(
                minutes=quiz_state.duration_minutes
            )
            quiz_state.current_question = 0

            # Cache with shorter TTL for active quiz
            await self._cache_quiz_state(quiz_state, ttl_override=60)

            # Preload first question for all participants
            if quiz_state.questions:
                first_question = quiz_state.questions[0]
                await self._cache_current_question(quiz_id, first_question)

            # Set up automatic quiz progression timer
            asyncio.create_task(self._schedule_quiz_progression(quiz_id))

            # Update metrics
            await bulk_manager.add_operation(
                "quiz_metrics",
                {
                    "action": "quiz_started",
                    "quiz_id": quiz_id,
                    "participant_count": len(quiz_state.participants),
                    "timestamp": datetime.now().isoformat(),
                },
            )

            logger.info(
                f"Quiz {quiz_id} started with {len(quiz_state.participants)} participants"
            )
            return True

        except Exception as e:
            logger.error(f"Error starting quiz {quiz_id}: {e}")
            return False

    @performance_monitor("submit_answer")
    async def submit_answer_optimized(
        self, quiz_id: str, user_id: str, question_id: str, answer: int
    ) -> Dict[str, Any]:
        """Submit answer with real-time leaderboard updates."""
        try:
            quiz_state = await self.get_quiz_state(quiz_id)
            if not quiz_state or quiz_state.status != "active":
                return {"success": False, "error": "Quiz not active"}

            if user_id not in quiz_state.participants:
                return {"success": False, "error": "User not in quiz"}

            # Get current question
            current_question = quiz_state.questions[quiz_state.current_question]
            if current_question.id != question_id:
                return {"success": False, "error": "Question mismatch"}

            # Update participant stats
            participant = quiz_state.participants[user_id]
            participant.total_answers += 1
            participant.last_answer_time = datetime.now()

            is_correct = answer == current_question.correct_answer
            if is_correct:
                participant.correct_answers += 1
                participant.score += self._calculate_score(
                    current_question, participant.last_answer_time
                )

            # Update quiz state cache
            await self._cache_quiz_state(quiz_state)

            # Update real-time leaderboard
            await self._update_leaderboard_cache(quiz_id, quiz_state.participants)

            # Add to bulk processing for detailed analytics
            await bulk_manager.add_operation(
                "answer_submissions",
                {
                    "quiz_id": quiz_id,
                    "user_id": user_id,
                    "question_id": question_id,
                    "answer": answer,
                    "is_correct": is_correct,
                    "score_earned": participant.score,
                    "timestamp": datetime.now().isoformat(),
                },
            )

            return {
                "success": True,
                "is_correct": is_correct,
                "correct_answer": current_question.correct_answer,
                "explanation": current_question.explanation,
                "score": participant.score,
                "leaderboard_position": await self._get_user_position(quiz_id, user_id),
            }

        except Exception as e:
            logger.error(
                f"Error submitting answer for quiz {quiz_id}, user {user_id}: {e}"
            )
            return {"success": False, "error": "Internal error"}

    def _calculate_score(self, question: QuizQuestion, answer_time: datetime) -> int:
        """Calculate score based on question difficulty and response time."""
        base_score = {"easy": 10, "medium": 15, "hard": 20}.get(question.difficulty, 15)

        # Time bonus (implement based on your scoring logic)
        time_bonus = max(0, 10 - int((answer_time.second % question.time_limit) / 3))

        return base_score + time_bonus

    @redis_cache(ttl=30, key_prefix="quiz_leaderboard")
    async def get_quiz_leaderboard(
        self, quiz_id: str, limit: int = 10
    ) -> List[Dict[str, Any]]:
        """Get quiz leaderboard with aggressive caching."""
        try:
            quiz_state = await self.get_quiz_state(quiz_id)
            if not quiz_state:
                return []

            # Sort participants by score
            sorted_participants = sorted(
                quiz_state.participants.values(),
                key=lambda p: (p.score, p.correct_answers, -p.total_answers),
                reverse=True,
            )

            leaderboard = []
            for i, participant in enumerate(sorted_participants[:limit]):
                leaderboard.append(
                    {
                        "position": i + 1,
                        "user_id": participant.user_id,
                        "username": participant.username,
                        "score": participant.score,
                        "correct_answers": participant.correct_answers,
                        "total_answers": participant.total_answers,
                        "accuracy": participant.correct_answers
                        / max(participant.total_answers, 1)
                        * 100,
                    }
                )

            return leaderboard

        except Exception as e:
            logger.error(f"Error getting leaderboard for quiz {quiz_id}: {e}")
            return []

    async def _update_leaderboard_cache(
        self, quiz_id: str, participants: Dict[str, QuizParticipant]
    ):
        """Update leaderboard cache for real-time updates."""
        try:
            leaderboard_data = []
            sorted_participants = sorted(
                participants.values(),
                key=lambda p: (p.score, p.correct_answers),
                reverse=True,
            )

            for i, participant in enumerate(sorted_participants):
                leaderboard_data.append(
                    {
                        "position": i + 1,
                        "user_id": participant.user_id,
                        "username": participant.username,
                        "score": participant.score,
                        "correct_answers": participant.correct_answers,
                        "total_answers": participant.total_answers,
                    }
                )

            # Cache with very short TTL for real-time updates
            await RedisClient.set_value(
                f"live_leaderboard:{quiz_id}", leaderboard_data, ttl_seconds=15
            )

        except Exception as e:
            logger.error(f"Error updating leaderboard cache for quiz {quiz_id}: {e}")

    async def _get_user_position(self, quiz_id: str, user_id: str) -> int:
        """Get user's current position in the leaderboard."""
        try:
            leaderboard = await RedisClient.get_value(f"live_leaderboard:{quiz_id}")
            if leaderboard:
                for entry in leaderboard:
                    if entry["user_id"] == user_id:
                        return entry["position"]
            return 0
        except Exception as e:
            logger.error(
                f"Error getting user position for {user_id} in quiz {quiz_id}: {e}"
            )
            return 0

    async def _cache_quiz_state(
        self, quiz_state: QuizState, ttl_override: Optional[int] = None
    ):
        """Cache quiz state with appropriate TTL based on status."""
        try:
            ttl = ttl_override or self.quiz_cache_ttl.get(quiz_state.status, 300)

            # Serialize quiz state
            serialized_state = self._serialize_quiz_state(quiz_state)

            cache_key = f"quiz_state:{quiz_state.quiz_id}"
            await RedisClient.set_value(cache_key, serialized_state, ttl_seconds=ttl)

        except Exception as e:
            logger.error(f"Error caching quiz state for {quiz_state.quiz_id}: {e}")

    async def _cache_current_question(self, quiz_id: str, question: QuizQuestion):
        """Cache current question for fast access."""
        try:
            question_data = asdict(question)
            await RedisClient.set_value(
                f"current_question:{quiz_id}", question_data, ttl_seconds=60
            )
        except Exception as e:
            logger.error(f"Error caching current question for quiz {quiz_id}: {e}")

    async def _add_to_quiz_index(self, quiz_id: str, topic: str, creator_id: str):
        """Add quiz to searchable index."""
        try:
            index_data = {
                "quiz_id": quiz_id,
                "topic": topic,
                "creator_id": creator_id,
                "created_at": datetime.now().isoformat(),
                "status": "waiting",
            }

            # Add to topic-based index
            topic_quizzes = await RedisClient.get_value(f"topic_quizzes:{topic}") or []
            topic_quizzes.append(index_data)
            await RedisClient.set_value(
                f"topic_quizzes:{topic}", topic_quizzes, ttl_seconds=3600
            )

            # Add to global active quizzes
            active_quizzes = await RedisClient.get_value("active_quizzes") or []
            active_quizzes.append(index_data)
            await RedisClient.set_value(
                "active_quizzes", active_quizzes, ttl_seconds=300
            )

        except Exception as e:
            logger.error(f"Error adding quiz {quiz_id} to index: {e}")

    async def _preload_quiz_cache(self, quiz_id: str):
        """Preload related cache data for better performance."""
        try:
            # Preload empty leaderboard
            await RedisClient.set_value(
                f"live_leaderboard:{quiz_id}", [], ttl_seconds=60
            )

            # Preload participant count
            await RedisClient.set_value(
                f"quiz_participant_count:{quiz_id}", 0, ttl_seconds=60
            )

            # Preload quiz status for quick checks
            await RedisClient.set_value(
                f"quiz_status:{quiz_id}", "waiting", ttl_seconds=300
            )

        except Exception as e:
            logger.error(f"Error preloading cache for quiz {quiz_id}: {e}")

    async def _schedule_quiz_progression(self, quiz_id: str):
        """Schedule automatic quiz progression."""
        try:
            quiz_state = await self.get_quiz_state(quiz_id)
            if not quiz_state:
                return

            for question_index in range(len(quiz_state.questions)):
                question = quiz_state.questions[question_index]

                # Wait for question time limit
                await asyncio.sleep(question.time_limit)

                # Update current question
                quiz_state.current_question = question_index + 1
                await self._cache_quiz_state(quiz_state)

                # Cache next question if available
                if question_index + 1 < len(quiz_state.questions):
                    next_question = quiz_state.questions[question_index + 1]
                    await self._cache_current_question(quiz_id, next_question)

            # End quiz
            await self._end_quiz(quiz_id)

        except Exception as e:
            logger.error(f"Error in quiz progression for {quiz_id}: {e}")

    async def _end_quiz(self, quiz_id: str):
        """End quiz and finalize results."""
        try:
            quiz_state = await self.get_quiz_state(quiz_id)
            if not quiz_state:
                return

            quiz_state.status = "completed"
            quiz_state.end_time = datetime.now()

            # Cache with longer TTL for completed quizzes
            await self._cache_quiz_state(quiz_state, ttl_override=3600)

            # Generate final results
            final_results = await self.get_quiz_leaderboard(quiz_id, limit=50)
            await RedisClient.set_value(
                f"final_results:{quiz_id}", final_results, ttl_seconds=86400  # 24 hours
            )

            # Clean up temporary cache
            await self._cleanup_quiz_cache(quiz_id)

            logger.info(
                f"Quiz {quiz_id} ended with {len(quiz_state.participants)} participants"
            )

        except Exception as e:
            logger.error(f"Error ending quiz {quiz_id}: {e}")

    async def _cleanup_quiz_cache(self, quiz_id: str):
        """Clean up temporary cache entries for completed quiz."""
        try:
            cleanup_keys = [
                f"live_leaderboard:{quiz_id}",
                f"current_question:{quiz_id}",
                f"quiz_participant_count:{quiz_id}",
                f"quiz_status:{quiz_id}",
            ]

            for key in cleanup_keys:
                await RedisClient.delete_value(key)

            # Clean up leaderboard message IDs for this quiz
            await self._cleanup_leaderboard_messages(quiz_id)

        except Exception as e:
            logger.error(f"Error cleaning up cache for quiz {quiz_id}: {e}")

    async def _cleanup_leaderboard_messages(self, quiz_id: str):
        """Clean up leaderboard message IDs for completed quiz."""
        try:
            from utils.redis_client import RedisClient

            # Get all leaderboard message keys for this quiz
            redis_client = await RedisClient.get_instance()
            if redis_client:
                pattern = f"leaderboard_msg_{quiz_id}_*"
                async for key in redis_client.scan_iter(match=pattern):
                    await redis_client.delete(key)
                    logger.info(f"Cleaned up leaderboard message key: {key}")

        except Exception as e:
            logger.error(
                f"Error cleaning up leaderboard messages for quiz {quiz_id}: {e}"
            )

    def _serialize_quiz_state(self, quiz_state: QuizState) -> Dict[str, Any]:
        """Serialize quiz state for caching."""
        return {
            "quiz_id": quiz_state.quiz_id,
            "status": quiz_state.status,
            "current_question": quiz_state.current_question,
            "total_questions": quiz_state.total_questions,
            "start_time": (
                quiz_state.start_time.isoformat() if quiz_state.start_time else None
            ),
            "end_time": (
                quiz_state.end_time.isoformat() if quiz_state.end_time else None
            ),
            "participants": {k: asdict(v) for k, v in quiz_state.participants.items()},
            "questions": [asdict(q) for q in quiz_state.questions],
            "topic": quiz_state.topic,
            "duration_minutes": quiz_state.duration_minutes,
        }

    def _deserialize_quiz_state(self, data: Dict[str, Any]) -> QuizState:
        """Deserialize quiz state from cache."""
        # Convert participant data back to objects
        participants = {}
        for user_id, participant_data in data.get("participants", {}).items():
            participant_data["join_time"] = (
                datetime.fromisoformat(participant_data["join_time"])
                if participant_data.get("join_time")
                else None
            )
            participant_data["last_answer_time"] = (
                datetime.fromisoformat(participant_data["last_answer_time"])
                if participant_data.get("last_answer_time")
                else None
            )
            participants[user_id] = QuizParticipant(**participant_data)

        # Convert question data back to objects
        questions = [QuizQuestion(**q) for q in data.get("questions", [])]

        return QuizState(
            quiz_id=data["quiz_id"],
            status=data["status"],
            current_question=data["current_question"],
            total_questions=data["total_questions"],
            start_time=(
                datetime.fromisoformat(data["start_time"])
                if data.get("start_time")
                else None
            ),
            end_time=(
                datetime.fromisoformat(data["end_time"])
                if data.get("end_time")
                else None
            ),
            participants=participants,
            questions=questions,
            topic=data["topic"],
            duration_minutes=data["duration_minutes"],
        )

    def _deserialize_question(self, data: Dict[str, Any]) -> QuizQuestion:
        """Deserialize question from cache."""
        return QuizQuestion(**data)


# Global high-performance quiz service instance
hp_quiz_service = HighPerformanceQuizService()


# Legacy function wrappers for backward compatibility
async def create_quiz(
    topic: str, duration_minutes: int, creator_id: str, num_questions: int = 10
) -> str:
    """Legacy wrapper for create_quiz functionality."""
    return await hp_quiz_service.create_quiz_optimized(
        topic, duration_minutes, creator_id, num_questions
    )


async def join_quiz(quiz_id: str, user_id: str, username: str) -> bool:
    """Legacy wrapper for join_quiz functionality."""
    return await hp_quiz_service.join_quiz_optimized(quiz_id, user_id, username)


async def start_quiz(quiz_id: str) -> bool:
    """Legacy wrapper for start_quiz functionality."""
    return await hp_quiz_service.start_quiz_optimized(quiz_id)


async def submit_answer(
    quiz_id: str, user_id: str, question_id: str, answer: int
) -> Dict[str, Any]:
    """Legacy wrapper for submit_answer functionality."""
    return await hp_quiz_service.submit_answer_optimized(
        quiz_id, user_id, question_id, answer
    )


async def get_quiz_leaderboard(quiz_id: str, limit: int = 10) -> List[Dict[str, Any]]:
    """Legacy wrapper for get_quiz_leaderboard functionality."""
    return await hp_quiz_service.get_quiz_leaderboard(quiz_id, limit)
