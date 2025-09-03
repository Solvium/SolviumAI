"""
Prometheus metrics service for SolviumAI Quiz Bot.
Provides custom metrics for monitoring bot performance and usage.
"""

import time
import logging
from typing import Dict, Any
from prometheus_client import Counter, Gauge, Histogram, Summary, generate_latest

logger = logging.getLogger(__name__)

# Custom Prometheus metrics
QUIZ_REQUESTS_TOTAL = Counter(
    "solvium_quiz_requests_total",
    "Total number of quiz requests",
    ["quiz_type", "difficulty"],
)

QUIZ_COMPLETIONS_TOTAL = Counter(
    "solvium_quiz_completions_total",
    "Total number of completed quizzes",
    ["quiz_type", "difficulty", "score_range"],
)

USER_ACTIVITY_GAUGE = Gauge(
    "solvium_active_users", "Number of active users", ["time_window"]
)

QUIZ_RESPONSE_TIME = Histogram(
    "solvium_quiz_response_time_seconds", "Quiz response time in seconds", ["quiz_type"]
)

CACHE_HIT_RATIO = Gauge(
    "solvium_cache_hit_ratio", "Cache hit ratio percentage", ["cache_type"]
)

BOT_ERRORS_TOTAL = Counter(
    "solvium_bot_errors_total", "Total number of bot errors", ["error_type"]
)

WEBHOOK_REQUESTS_TOTAL = Counter(
    "solvium_webhook_requests_total", "Total number of webhook requests", ["status"]
)


# Performance tracking
class MetricsService:
    """Service for managing Prometheus metrics."""

    def __init__(self):
        self.start_time = time.time()
        self.request_count = 0
        self.error_count = 0

    def record_quiz_request(self, quiz_type: str, difficulty: str):
        """Record a quiz request."""
        try:
            QUIZ_REQUESTS_TOTAL.labels(quiz_type=quiz_type, difficulty=difficulty).inc()
            self.request_count += 1
        except Exception as e:
            logger.error(f"Error recording quiz request metric: {e}")

    def record_quiz_completion(self, quiz_type: str, difficulty: str, score: int):
        """Record a quiz completion with score."""
        try:
            # Categorize score into ranges
            if score >= 80:
                score_range = "excellent"
            elif score >= 60:
                score_range = "good"
            elif score >= 40:
                score_range = "fair"
            else:
                score_range = "poor"

            QUIZ_COMPLETIONS_TOTAL.labels(
                quiz_type=quiz_type, difficulty=difficulty, score_range=score_range
            ).inc()
        except Exception as e:
            logger.error(f"Error recording quiz completion metric: {e}")

    def record_user_activity(self, time_window: str, count: int):
        """Record active user count for different time windows."""
        try:
            USER_ACTIVITY_GAUGE.labels(time_window=time_window).set(count)
        except Exception as e:
            logger.error(f"Error recording user activity metric: {e}")

    def record_response_time(self, quiz_type: str, response_time: float):
        """Record quiz response time."""
        try:
            QUIZ_RESPONSE_TIME.labels(quiz_type=quiz_type).observe(response_time)
        except Exception as e:
            logger.error(f"Error recording response time metric: {e}")

    def record_cache_hit_ratio(self, cache_type: str, hit_ratio: float):
        """Record cache hit ratio."""
        try:
            CACHE_HIT_RATIO.labels(cache_type=cache_type).set(hit_ratio)
        except Exception as e:
            logger.error(f"Error recording cache hit ratio metric: {e}")

    def record_bot_error(self, error_type: str):
        """Record a bot error."""
        try:
            BOT_ERRORS_TOTAL.labels(error_type=error_type).inc()
            self.error_count += 1
        except Exception as e:
            logger.error(f"Error recording bot error metric: {e}")

    def record_webhook_request(self, status: str):
        """Record a webhook request."""
        try:
            WEBHOOK_REQUESTS_TOTAL.labels(status=status).inc()
        except Exception as e:
            logger.error(f"Error recording webhook request metric: {e}")

    def get_uptime_seconds(self) -> float:
        """Get bot uptime in seconds."""
        return time.time() - self.start_time

    def get_request_rate(self) -> float:
        """Get request rate (requests per second)."""
        uptime = self.get_uptime_seconds()
        return self.request_count / uptime if uptime > 0 else 0

    def get_error_rate(self) -> float:
        """Get error rate (errors per second)."""
        uptime = self.get_uptime_seconds()
        return self.error_count / uptime if uptime > 0 else 0

    def generate_custom_metrics(self) -> str:
        """Generate custom metrics in Prometheus format."""
        try:
            uptime = self.get_uptime_seconds()
            request_rate = self.get_request_rate()
            error_rate = self.get_error_rate()

            custom_metrics = f"""# HELP solvium_bot_uptime_seconds Bot uptime in seconds
# TYPE solvium_bot_uptime_seconds gauge
solvium_bot_uptime_seconds {uptime}
# HELP solvium_bot_request_rate_requests_per_second Request rate
# TYPE solvium_bot_request_rate_requests_per_second gauge
solvium_bot_request_rate_requests_per_second {request_rate}
# HELP solvium_bot_error_rate_errors_per_second Error rate
# TYPE solvium_bot_error_rate_errors_per_second gauge
solvium_bot_error_rate_errors_per_second {error_rate}
# HELP solvium_bot_requests_total Total requests since startup
# TYPE solvium_bot_requests_total counter
solvium_bot_requests_total {self.request_count}
# HELP solvium_bot_errors_total Total errors since startup
# TYPE solvium_bot_errors_total counter
solvium_bot_errors_total {self.error_count}
"""
            return custom_metrics
        except Exception as e:
            logger.error(f"Error generating custom metrics: {e}")
            return ""


# Global metrics service instance
metrics_service = MetricsService()


def get_metrics_service() -> MetricsService:
    """Get the global metrics service instance."""
    return metrics_service
