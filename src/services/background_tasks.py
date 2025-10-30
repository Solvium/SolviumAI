import asyncio
import logging
from typing import Dict, Any
from services.wallet_creation_queue import wallet_creation_queue
from utils.config import Config

logger = logging.getLogger(__name__)


class BackgroundTaskService:
    """Service for managing background tasks like wallet creation queue processing"""

    def __init__(self):
        self.running = False
        self.tasks: Dict[str, asyncio.Task] = {}

    async def start(self):
        """Start all background tasks"""
        if self.running:
            logger.warning("Background tasks already running")
            return

        self.running = True
        logger.info("Starting background tasks")

        # Start wallet creation queue processor
        if Config.WALLET_CREATION_QUEUE_ENABLED:
            self.tasks["wallet_queue_processor"] = asyncio.create_task(
                self._process_wallet_creation_queue()
            )
            logger.info("Started wallet creation queue processor")

        # Start other background tasks here as needed

    async def stop(self):
        """Stop all background tasks"""
        if not self.running:
            return

        logger.info("Stopping background tasks")
        self.running = False

        # Cancel all tasks
        for task_name, task in self.tasks.items():
            if not task.done():
                logger.info(f"Cancelling task: {task_name}")
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    logger.info(f"Task {task_name} cancelled successfully")
                except Exception as e:
                    logger.error(f"Error cancelling task {task_name}: {e}")

        self.tasks.clear()
        logger.info("All background tasks stopped")

    async def _process_wallet_creation_queue(self):
        """Process the wallet creation queue periodically"""
        logger.info("Wallet creation queue processor started")

        while self.running:
            try:
                # Process the queue
                await wallet_creation_queue.process_queue()

                # Get queue stats for monitoring
                stats = await wallet_creation_queue.get_queue_stats()
                if stats["pending"] > 0:
                    logger.info(f"Wallet creation queue stats: {stats}")

                # Wait before next processing cycle
                await asyncio.sleep(Config.WALLET_CREATION_RETRY_DELAY)

            except asyncio.CancelledError:
                logger.info("Wallet creation queue processor cancelled")
                break
            except Exception as e:
                logger.error(f"Error in wallet creation queue processor: {e}")
                # Wait a bit before retrying to avoid rapid error loops
                await asyncio.sleep(60)

        logger.info("Wallet creation queue processor stopped")

    async def get_status(self) -> Dict[str, Any]:
        """Get status of all background tasks"""
        status = {"running": self.running, "tasks": {}}

        for task_name, task in self.tasks.items():
            status["tasks"][task_name] = {
                "running": not task.done(),
                "cancelled": task.cancelled(),
                "exception": (
                    str(task.exception()) if task.done() and task.exception() else None
                ),
            }

        return status


# Global instance
background_task_service = BackgroundTaskService()
