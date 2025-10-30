import asyncio
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
from utils.redis_client import RedisClient
from utils.config import Config
from utils.rpc_retry import WalletCreationError, RPCErrorType
from services.near_wallet_service import NEARWalletService

logger = logging.getLogger(__name__)


@dataclass
class WalletCreationTask:
    """Represents a wallet creation task in the queue"""

    user_id: int
    user_name: Optional[str]
    is_mainnet: bool
    account_id: str
    public_key: str
    private_key: str
    created_at: str
    retry_count: int = 0
    last_error: Optional[str] = None
    status: str = "pending"  # pending, processing, completed, failed

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "WalletCreationTask":
        return cls(**data)


class WalletCreationQueue:
    """Manages wallet creation retry queue"""

    def __init__(self):
        self.redis_client = RedisClient()
        self.near_wallet_service = NEARWalletService()
        self.queue_key = "wallet_creation_queue"
        self.processing_key = "wallet_creation_processing"
        self.completed_key = "wallet_creation_completed"
        self.failed_key = "wallet_creation_failed"

    async def add_failed_wallet_creation(
        self,
        user_id: int,
        user_name: Optional[str],
        is_mainnet: bool,
        account_id: str,
        public_key: str,
        private_key: str,
        error_message: str,
    ) -> bool:
        """
        Add a failed wallet creation to the retry queue

        Args:
            user_id: Telegram user ID
            user_name: User's display name
            is_mainnet: Whether this is a mainnet wallet
            account_id: Generated account ID
            public_key: Generated public key
            private_key: Generated private key
            error_message: Error that caused the failure

        Returns:
            True if successfully added to queue
        """
        if not Config.WALLET_CREATION_QUEUE_ENABLED:
            logger.info("Wallet creation queue is disabled")
            return False

        try:
            task = WalletCreationTask(
                user_id=user_id,
                user_name=user_name,
                is_mainnet=is_mainnet,
                account_id=account_id,
                public_key=public_key,
                private_key=private_key,
                created_at=datetime.now().isoformat(),
                retry_count=0,
                last_error=error_message,
                status="pending",
            )

            # Add to queue with TTL
            queue_ttl = (
                Config.WALLET_CREATION_RETRY_DELAY * Config.WALLET_CREATION_MAX_RETRIES
            )
            await self.redis_client.set_value(
                f"{self.queue_key}:{user_id}",
                json.dumps(task.to_dict()),
                ttl_seconds=queue_ttl,
            )

            logger.info(f"Added wallet creation task to queue for user {user_id}")
            return True

        except Exception as e:
            logger.error(f"Failed to add wallet creation task to queue: {e}")
            return False

    async def get_pending_tasks(self) -> List[WalletCreationTask]:
        """Get all pending wallet creation tasks"""
        try:
            tasks = []
            keys = await self.redis_client.get_keys(f"{self.queue_key}:*")

            for key in keys:
                task_data = await self.redis_client.get_value(key)
                if task_data:
                    task = WalletCreationTask.from_dict(json.loads(task_data))
                    if task.status == "pending":
                        tasks.append(task)

            return tasks

        except Exception as e:
            logger.error(f"Failed to get pending tasks: {e}")
            return []

    async def process_wallet_creation_task(self, task: WalletCreationTask) -> bool:
        """
        Process a wallet creation task

        Args:
            task: The wallet creation task to process

        Returns:
            True if successful, False otherwise
        """
        try:
            # Mark as processing
            task.status = "processing"
            await self._update_task_status(task)

            logger.info(
                f"Processing wallet creation for user {task.user_id} (attempt {task.retry_count + 1})"
            )

            # Try to create the account on blockchain
            if task.is_mainnet:
                success = (
                    await self.near_wallet_service._create_real_mainnet_sub_account(
                        task.account_id,
                        bytes.fromhex(task.public_key.replace("ed25519:", "")),
                    )
                )
            else:
                success = await self.near_wallet_service._create_real_sub_account(
                    task.account_id,
                    bytes.fromhex(task.public_key.replace("ed25519:", "")),
                )

            if success:
                # Verify account exists
                verified = await self._verify_account_exists(
                    task.account_id, task.is_mainnet
                )

                if verified:
                    # Mark as completed
                    task.status = "completed"
                    await self._update_task_status(task)
                    await self._move_to_completed(task)

                    logger.info(
                        f"Successfully created and verified wallet for user {task.user_id}"
                    )
                    return True
                else:
                    raise WalletCreationError(
                        "Account verification failed after creation"
                    )
            else:
                raise WalletCreationError("Failed to create account on blockchain")

        except Exception as e:
            logger.error(
                f"Failed to process wallet creation for user {task.user_id}: {e}"
            )

            # Update retry count and error
            task.retry_count += 1
            task.last_error = str(e)
            task.status = "pending"

            if task.retry_count >= Config.WALLET_CREATION_MAX_RETRIES:
                # Move to failed queue
                task.status = "failed"
                await self._move_to_failed(task)
                logger.error(
                    f"Wallet creation failed permanently for user {task.user_id}"
                )
            else:
                # Update task for retry
                await self._update_task_status(task)
                logger.info(f"Wallet creation will be retried for user {task.user_id}")

            return False

    async def _verify_account_exists(self, account_id: str, is_mainnet: bool) -> bool:
        """Verify that an account exists on the blockchain"""
        try:
            network = "mainnet" if is_mainnet else "testnet"
            balance = await self.near_wallet_service.get_account_balance(
                account_id, network
            )

            # If we get a balance (even 0), the account exists
            return balance is not None and balance != "0 NEAR"

        except Exception as e:
            logger.error(f"Failed to verify account {account_id}: {e}")
            return False

    async def _update_task_status(self, task: WalletCreationTask):
        """Update task status in Redis"""
        try:
            await self.redis_client.set_value(
                f"{self.queue_key}:{task.user_id}",
                json.dumps(task.to_dict()),
                ttl_seconds=Config.WALLET_CREATION_RETRY_DELAY
                * Config.WALLET_CREATION_MAX_RETRIES,
            )
        except Exception as e:
            logger.error(f"Failed to update task status: {e}")

    async def _move_to_completed(self, task: WalletCreationTask):
        """Move completed task to completed queue"""
        try:
            # Remove from main queue
            await self.redis_client.delete_key(f"{self.queue_key}:{task.user_id}")

            # Add to completed queue with shorter TTL
            await self.redis_client.set_value(
                f"{self.completed_key}:{task.user_id}",
                json.dumps(task.to_dict()),
                ttl_seconds=3600,  # 1 hour
            )
        except Exception as e:
            logger.error(f"Failed to move task to completed: {e}")

    async def _move_to_failed(self, task: WalletCreationTask):
        """Move failed task to failed queue"""
        try:
            # Remove from main queue
            await self.redis_client.delete_key(f"{self.queue_key}:{task.user_id}")

            # Add to failed queue with longer TTL for debugging
            await self.redis_client.set_value(
                f"{self.failed_key}:{task.user_id}",
                json.dumps(task.to_dict()),
                ttl_seconds=86400,  # 24 hours
            )
        except Exception as e:
            logger.error(f"Failed to move task to failed: {e}")

    async def process_queue(self):
        """Process all pending wallet creation tasks"""
        if not Config.WALLET_CREATION_QUEUE_ENABLED:
            return

        try:
            tasks = await self.get_pending_tasks()
            logger.info(f"Processing {len(tasks)} wallet creation tasks")

            for task in tasks:
                try:
                    await self.process_wallet_creation_task(task)
                    # Small delay between tasks to avoid overwhelming the RPC
                    await asyncio.sleep(1)
                except Exception as e:
                    logger.error(f"Error processing task for user {task.user_id}: {e}")

        except Exception as e:
            logger.error(f"Error processing wallet creation queue: {e}")

    async def get_queue_stats(self) -> Dict[str, int]:
        """Get statistics about the wallet creation queue"""
        try:
            pending_keys = await self.redis_client.get_keys(f"{self.queue_key}:*")
            completed_keys = await self.redis_client.get_keys(f"{self.completed_key}:*")
            failed_keys = await self.redis_client.get_keys(f"{self.failed_key}:*")

            return {
                "pending": len(pending_keys),
                "completed": len(completed_keys),
                "failed": len(failed_keys),
            }
        except Exception as e:
            logger.error(f"Failed to get queue stats: {e}")
            return {"pending": 0, "completed": 0, "failed": 0}


# Global instance
wallet_creation_queue = WalletCreationQueue()
