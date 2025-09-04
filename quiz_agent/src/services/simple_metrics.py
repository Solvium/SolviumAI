"""
Simple metrics service for SolviumAI Quiz Bot.
Provides basic Prometheus metrics for monitoring.
"""

import time
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

class SimpleMetricsService:
    """Simple metrics service for basic monitoring."""
    
    def __init__(self):
        self.start_time = time.time()
        self.request_count = 0
        self.error_count = 0
        self.quiz_requests = 0
        self.webhook_requests = 0
        
    def increment_request(self):
        """Increment request counter."""
        self.request_count += 1
        
    def increment_error(self):
        """Increment error counter."""
        self.error_count += 1
        
    def increment_quiz_request(self):
        """Increment quiz request counter."""
        self.quiz_requests += 1
        
    def increment_webhook_request(self):
        """Increment webhook request counter."""
        self.webhook_requests += 1
        
    def get_uptime_seconds(self) -> float:
        """Get bot uptime in seconds."""
        return time.time() - self.start_time
        
    def generate_prometheus_metrics(self) -> str:
        """Generate Prometheus-formatted metrics."""
        uptime = self.get_uptime_seconds()
        
        metrics = f"""# HELP solvium_quiz_bot_up Bot is running
# TYPE solvium_quiz_bot_up gauge
solvium_quiz_bot_up 1

# HELP solvium_quiz_bot_uptime_seconds Bot uptime in seconds
# TYPE solvium_quiz_bot_uptime_seconds gauge
solvium_quiz_bot_uptime_seconds {uptime}

# HELP solvium_quiz_bot_requests_total Total requests since startup
# TYPE solvium_quiz_bot_requests_total counter
solvium_quiz_bot_requests_total {self.request_count}

# HELP solvium_quiz_bot_errors_total Total errors since startup
# TYPE solvium_quiz_bot_errors_total counter
solvium_quiz_bot_errors_total {self.error_count}

# HELP solvium_quiz_bot_quiz_requests_total Total quiz requests since startup
# TYPE solvium_quiz_bot_quiz_requests_total counter
solvium_quiz_bot_quiz_requests_total {self.quiz_requests}

# HELP solvium_quiz_bot_webhook_requests_total Total webhook requests since startup
# TYPE solvium_quiz_bot_webhook_requests_total counter
solvium_quiz_bot_webhook_requests_total {self.webhook_requests}

# HELP solvium_quiz_bot_request_rate_requests_per_second Request rate
# TYPE solvium_quiz_bot_request_rate_requests_per_second gauge
solvium_quiz_bot_request_rate_requests_per_second {self.request_count / uptime if uptime > 0 else 0}

# HELP solvium_quiz_bot_error_rate_errors_per_second Error rate
# TYPE solvium_quiz_bot_error_rate_errors_per_second gauge
solvium_quiz_bot_error_rate_errors_per_second {self.error_count / uptime if uptime > 0 else 0}
"""
        return metrics

# Global metrics service instance
simple_metrics = SimpleMetricsService()

def get_simple_metrics() -> SimpleMetricsService:
    """Get the global simple metrics service instance."""
    return simple_metrics
