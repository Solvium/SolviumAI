import asyncio
import os
import time
import logging
from datetime import datetime, timedelta
from models.quiz import Quiz, QuizStatus
from store.database import SessionLocal
from utils.config import Config
import traceback
from typing import Dict, List, Optional, Any

from py_near.account import Account

# Import py-near components
from py_near.dapps.core import NEAR
import httpx
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
)
import re
from sqlalchemy.exc import IntegrityError

logger = logging.getLogger(__name__)


class BlockchainMonitor:
    """
    NEAR blockchain monitor - connects to NEAR RPC nodes to monitor transactions
    and handle deposits/withdrawals for quiz rewards.
    """

    def __init__(self, bot, application=None):
        """Initialize with access to the bot for sending notifications and application for scheduling."""
        self.bot = bot
        self.application = (
            application  # Store application reference for JobQueue scheduling
        )
        self._running = False
        self._monitor_task = None
        self.near_account: Optional[Account] = None
        self._init_near_account()

    def _init_near_account(self):
        """Initialize NEAR account for blockchain operations."""
        try:
            private_key = Config.NEAR_WALLET_PRIVATE_KEY
            account_id = Config.NEAR_WALLET_ADDRESS
            rpc_addr = Config.NEAR_RPC_ENDPOINT

            if not private_key or not account_id:
                logger.error("Missing NEAR wallet credentials in configuration")
                return

            if not rpc_addr:
                logger.error("Missing NEAR RPC endpoint in configuration")
                return

            # Initialize the NEAR account
            self.near_account = Account(account_id, private_key, rpc_addr=rpc_addr)
            logger.info(f"NEAR account initialized with address: {account_id}")
        except Exception as e:
            logger.error(f"Failed to initialize NEAR account: {e}")
            traceback.print_exc()

    @retry(
        retry=retry_if_exception_type((httpx.ReadTimeout, httpx.ConnectTimeout)),
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10),
    )
    async def _fetch_transaction_details_rpc(
        self, tx_hash: str, sender_account_id: str
    ) -> Dict[str, Any]:
        """
        Fetches transaction details from NEAR RPC using the 'tx' endpoint.
        This is more reliable as it doesn't depend on knowing the sender beforehand.

        Args:
            tx_hash: The transaction hash to verify.
            sender_account_id: The account ID of the transaction initiator.

        Returns:
            A dictionary containing the transaction details.
        """
        async with httpx.AsyncClient(timeout=30.0) as client:
            payload = {
                "jsonrpc": "2.0",
                "id": "dontcare",
                "method": "tx",
                "params": [tx_hash, sender_account_id],
            }
            try:
                resp = await client.post(Config.NEAR_RPC_ENDPOINT, json=payload)
                resp.raise_for_status()
                result = resp.json()

                if "error" in result:
                    error_info = result["error"].get("data", {}).get("error_message")
                    logger.error(f"RPC Error fetching tx details: {error_info}")
                    raise Exception(f"Transaction verification failed: {error_info}")

                return result.get("result", {})

            except httpx.TimeoutException as e:
                logger.warning(
                    f"Timeout while fetching transaction {tx_hash}, retrying..."
                )
                raise
            except Exception as e:
                logger.error(f"Error fetching transaction {tx_hash}: {str(e)}")
                raise

    async def startup_near_account(self):
        """Start up the NEAR account connection."""
        if not self.near_account:
            logger.error("Cannot start NEAR account - not initialized")
            return False

        try:
            # Initialize connection to NEAR blockchain
            await self.near_account.startup()
            balance = await self.near_account.get_balance()
            logger.info(
                f"Connected to NEAR blockchain. Account balance: {balance/NEAR:.4f} NEAR"
            )
            return True
        except Exception as e:
            logger.error(f"Failed to connect to NEAR blockchain: {e}")
            traceback.print_exc()
            return False

    async def start_monitoring(self):
        """Start the blockchain monitoring service."""
        # Initialize NEAR connection first
        if not await self.startup_near_account():
            logger.error(
                "Failed to start blockchain monitor due to NEAR connection failure"
            )
            return

        logger.info(
            "Blockchain monitor initialized - no automatic monitoring enabled, using manual verification only"
        )
        return

    async def stop_monitoring(self):
        """Stop the blockchain monitoring service."""
        if not self._running:
            return

        self._running = False
        if self._monitor_task:
            self._monitor_task.cancel()
            try:
                await self._monitor_task
            except asyncio.CancelledError:
                pass
        logger.info("Blockchain monitor stopped")

    # We're keeping the monitor_loop and _check_deposit methods for backwards compatibility
    # but they won't be automatically used anymore

    async def _monitor_loop(self):
        """Continuously monitor for deposits to quiz addresses."""
        while self._running:
            try:
                # Check for quizzes in FUNDING status
                session = SessionLocal()
                try:
                    funding_quizzes = (
                        session.query(Quiz)
                        .filter(
                            Quiz.status == QuizStatus.FUNDING,
                            Quiz.deposit_address != None,
                        )
                        .all()
                    )

                    # Important: Load all necessary attributes while session is active
                    # and create a list of quiz IDs to process
                    quiz_ids_to_process = []
                    for quiz in funding_quizzes:
                        quiz_ids_to_process.append(quiz.id)
                finally:
                    session.close()

                # Process each quiz with its own session
                for quiz_id in quiz_ids_to_process:
                    await self._check_deposit(quiz_id)

                # Check every 60 seconds
                await asyncio.sleep(60)
            except Exception as e:
                logger.error(f"Error in blockchain monitor: {e}")
                traceback.print_exc()
                await asyncio.sleep(60)

    async def _check_deposit(self, quiz_id):
        """
        Check for deposits to a quiz address on the NEAR blockchain.

        Verifies if sufficient funds were received using NEAR RPC calls.
        """
        if not self.near_account:
            logger.error("Cannot check deposits - NEAR account not initialized")
            return

        # Open a new session for this operation
        session = SessionLocal()
        try:
            # Reload the quiz to get current state
            quiz = session.query(Quiz).filter(Quiz.id == quiz_id).first()
            if not quiz or quiz.status != QuizStatus.FUNDING:
                return

            deposit_address = quiz.deposit_address
            required_amount = (
                sum(int(value) for value in quiz.reward_schedule.values())
                if quiz.reward_schedule
                else 0
            )

            # Use py-near to check the blockchain for deposits
            try:
                # Fetch the balance of the deposit address
                deposit_balance = await self.near_account.get_balance(deposit_address)
                logger.info(
                    f"Checked balance for quiz {quiz_id}: {deposit_balance/NEAR:.4f} NEAR"
                )

                # Check if sufficient funds received
                if deposit_balance >= required_amount * NEAR:
                    # Update quiz to ACTIVE and commit immediately
                    quiz.status = QuizStatus.ACTIVE
                    total_reward = required_amount
                    group_chat_id = quiz.group_chat_id
                    topic = quiz.topic

                    session.commit()
                    session.close()
                    session = None  # Prevent further usage

                    # Announce the quiz is active in the original group chat
                    try:
                        if group_chat_id:
                            # Use longer timeout for the announcement
                            async with asyncio.timeout(10):  # 10 second timeout
                                await self.bot.send_message(
                                    chat_id=group_chat_id,
                                    text=f"📣 New quiz '{topic}' is now active! 🎯\n"
                                    f"Total rewards: {total_reward} NEAR\n"
                                    f"Type /playquiz to participate!",
                                )
                                logger.info(
                                    f"Quiz {quiz_id} activated with {total_reward} NEAR"
                                )
                    except asyncio.TimeoutError:
                        logger.error(f"Failed to announce active quiz: Timed out")
                    except Exception as e:
                        logger.error(f"Failed to announce active quiz: {e}")
                        traceback.print_exc()
                else:
                    logger.debug(
                        f"Insufficient funds for quiz {quiz_id}: {deposit_balance/NEAR:.4f}/{required_amount} NEAR"
                    )
            except Exception as e:
                logger.error(f"Error checking blockchain for deposits: {e}")
                traceback.print_exc()

        except Exception as e:
            logger.error(f"Error checking deposit: {e}")
            traceback.print_exc()
        finally:
            # Always ensure session is closed
            if session is not None:
                session.close()

    async def distribute_rewards(self, quiz_id: str) -> Optional[List[Dict[str, Any]]]:
        """
        Distribute rewards to quiz winners based on the defined reward schedule.

        Args:
            quiz_id: ID of the quiz to distribute rewards for

        Returns:
            Optional[List[Dict[str, Any]]]: None if no winners, list of successful transfers (possibly empty) if winners were processed, False for critical errors
        """
        logger.info(f"[distribute_rewards] called for quiz_id={quiz_id}")
        if not self.near_account:
            logger.error(
                "[distribute_rewards] Cannot distribute rewards - NEAR account not initialized"
            )
            return False
        logger.debug(f"[distribute_rewards] NEAR account present: {self.near_account}")

        # Open a new session for this operation
        session = SessionLocal()
        try:
            # Get quiz data and confirm it's in ACTIVE status
            quiz = session.query(Quiz).filter(Quiz.id == quiz_id).first()
            logger.info(
                f"[distribute_rewards] Fetched quiz {quiz_id}: status={quiz.status}, reward_schedule={quiz.reward_schedule}"
            )
            if not quiz:
                logger.error(f"Quiz {quiz_id} not found")
                return False

            if quiz.status == QuizStatus.CLOSED:
                logger.info(f"Quiz {quiz_id} already closed and rewards distributed")
                return True

            if quiz.status != QuizStatus.ACTIVE:
                logger.error(
                    f"[distribute_rewards] Quiz {quiz_id} not in ACTIVE state ({quiz.status}), cannot distribute rewards"
                )
                return False

            # Get winners from database
            from models.quiz import QuizAnswer

            # Use the same participant ranking method as the leaderboard for consistency
            all_participants = QuizAnswer.get_quiz_participants_ranking(
                session, quiz_id
            )

            # For reward distribution, filter participants with correct answers first
            eligible_participants = [
                p for p in all_participants if p.get("correct_count", 0) > 0
            ]

            # Determine winners based on reward schedule type
            reward_schedule = quiz.reward_schedule
            if (
                reward_schedule
                and isinstance(reward_schedule, dict)
                and reward_schedule.get("type") == "wta_amount"
            ):
                # Winner Takes All - only the top participant
                winners = eligible_participants[:1] if eligible_participants else []
            elif (
                reward_schedule
                and isinstance(reward_schedule, dict)
                and reward_schedule.get("type") == "top3_details"
            ):
                # Top 3 Winners - only the top 3 participants
                winners = eligible_participants[:3] if eligible_participants else []
            else:
                # Default: all participants with correct answers
                winners = eligible_participants

            logger.info(
                f"[distribute_rewards] Found {len(all_participants)} total participants, {len(eligible_participants)} with correct answers, {len(winners)} selected for rewards"
            )

            if len(all_participants) > 0 and len(eligible_participants) == 0:
                logger.info(
                    f"[distribute_rewards] All {len(all_participants)} participants had 0 correct answers - no rewards distributed"
                )
            elif len(winners) == 0:
                logger.info(
                    f"[distribute_rewards] No participants found for quiz {quiz_id}"
                )
            else:
                logger.info(
                    f"[distribute_rewards] Distributing rewards to {len(winners)} participants"
                )
                logger.debug(f"[distribute_rewards] Winner details: {winners}")
            if not winners:
                logger.warning(f"No winners found for quiz {quiz_id}")
                quiz.status = QuizStatus.CLOSED
                # Ensure rewards_distributed_at is part of your Quiz model
                if hasattr(quiz, "rewards_distributed_at"):
                    quiz.rewards_distributed_at = datetime.utcnow()
                session.commit()
                logger.info(f"Quiz {quiz_id} closed as no winners were found.")
                return None  # Indicates no winners to process

            # Get wallet addresses for winners
            from models.user import User  # Already imported but good to note
            from models.wallet import UserWallet  # Import for new wallet system

            logger.debug(
                f"[distribute_rewards] Using reward_schedule: {reward_schedule}"
            )

            # Track successful transfers
            successful_transfers = []

            # Check if this is a token reward quiz
            is_token_reward = (
                quiz.payment_method == "TOKEN" and quiz.token_contract_address
            )

            # Process each winner according to reward schedule
            if (
                reward_schedule
                and isinstance(reward_schedule, dict)
                and reward_schedule.get("type") == "wta_amount"
            ):
                # Winner Takes All Logic
                if winners:  # Ensure there is at least one winner
                    winner_data = winners[0]  # Get the top winner
                    logger.debug(
                        f"[distribute_rewards] WTA: Processing top winner, data={winner_data}"
                    )
                    user_id = winner_data["user_id"]
                    user = session.query(User).filter(User.id == user_id).first()

                    # Check for wallet in both legacy and new systems
                    wallet_address = None
                    if user:
                        # Check legacy wallet_address field
                        if user.wallet_address:
                            wallet_address = user.wallet_address
                        # Check new UserWallet system
                        elif user.wallets:
                            active_wallet = next(
                                (w for w in user.wallets if w.is_active), None
                            )
                            if active_wallet:
                                wallet_address = active_wallet.account_id

                    if not user or not wallet_address:
                        logger.warning(
                            f"[distribute_rewards] WTA: Top winner User {user_id} (Username: {winner_data.get('username', 'N/A')}) has no wallet linked or user not found. No reward distributed for WTA."
                        )
                    else:
                        reward_amount_yoctonear = 0
                        reward_amount_near_str = "0"
                        amount_text = str(reward_schedule.get("details_text", ""))
                        match = re.search(r"(\d+(?:\.\d+)?)", amount_text)
                        if match:
                            reward_amount_near_str = match.group(1)
                            try:
                                reward_amount_yoctonear = int(
                                    float(reward_amount_near_str) * NEAR
                                )
                            except ValueError:
                                logger.error(
                                    f"[distribute_rewards] WTA: Invalid reward amount in details_text: {amount_text} for quiz {quiz_id}"
                                )
                        else:
                            logger.error(
                                f"[distribute_rewards] WTA: Could not parse reward amount from details_text: {amount_text} for quiz {quiz_id}"
                            )

                        if reward_amount_yoctonear > 0:
                            # Deduct 2% fee from the reward
                            reward_amount_near_float = (
                                float(reward_amount_near_str) * 0.98
                            )
                            reward_amount_near_str_final = str(
                                round(reward_amount_near_float, 6)
                            )
                            reward_amount_yoctonear_final = int(
                                reward_amount_near_float * NEAR
                            )

                            if reward_amount_yoctonear_final > 0:
                                recipient_wallet = wallet_address

                                # SMART WALLET VERIFICATION - Check if wallet exists on blockchain before transfer
                                wallet_verified = await self._verify_and_recover_wallet(
                                    user_id,
                                    recipient_wallet,
                                    winner_data.get("username", "N/A"),
                                )

                                if wallet_verified and is_token_reward:
                                    # Handle token reward distribution
                                    try:
                                        from services.token_service import TokenService

                                        token_service = TokenService()

                                        # Get token metadata
                                        metadata = (
                                            await token_service.get_token_metadata(
                                                self.near_account,
                                                quiz.token_contract_address,
                                            )
                                        )
                                        token_symbol = metadata["symbol"]

                                        logger.info(
                                            f"[distribute_rewards] WTA: Attempting to send {reward_amount_near_str_final} {token_symbol} to {recipient_wallet} (User: {winner_data.get('username', 'N/A')})"
                                        )

                                        # Transfer tokens using py-near FTS
                                        transfer_result = await token_service.transfer_tokens(
                                            account=self.near_account,
                                            token_contract=quiz.token_contract_address,
                                            recipient_account_id=recipient_wallet,
                                            amount=reward_amount_near_float,
                                            force_register=True,  # Automatically handle storage deposits
                                        )

                                        if transfer_result["success"]:
                                            tx_hash_str = transfer_result[
                                                "transaction_hash"
                                            ]
                                            logger.info(
                                                f"[distribute_rewards] WTA: Successfully sent {reward_amount_near_str_final} {token_symbol} to {recipient_wallet}. Tx hash: {tx_hash_str}"
                                            )

                                            successful_transfers.append(
                                                {
                                                    "user_id": user_id,
                                                    "username": winner_data.get(
                                                        "username", "N/A"
                                                    ),
                                                    "wallet_address": recipient_wallet,
                                                    "amount": reward_amount_near_str_final,
                                                    "currency": token_symbol,
                                                    "transaction_hash": tx_hash_str,
                                                    "reward_type": "token",
                                                }
                                            )
                                        else:
                                            logger.error(
                                                f"[distribute_rewards] WTA: Failed to send {reward_amount_near_str_final} {token_symbol} to {recipient_wallet}. Error: {transfer_result['error']}"
                                            )
                                    except Exception as e:
                                        logger.error(
                                            f"[distribute_rewards] WTA: Error distributing token reward: {e}"
                                        )
                                elif wallet_verified:
                                    # Handle NEAR reward distribution (existing logic)
                                    logger.info(
                                        f"[distribute_rewards] WTA: Attempting to send {reward_amount_near_str_final} NEAR ({reward_amount_yoctonear_final} yoctoNEAR) to {recipient_wallet} (User: {winner_data.get('username', 'N/A')})"
                                    )
                                    try:
                                        # Use nowait=True to get transaction hash directly as string
                                        tx_hash_str = (
                                            await self.near_account.send_money(
                                                recipient_wallet,
                                                reward_amount_yoctonear_final,
                                                nowait=True,
                                            )
                                        )

                                        # tx_hash_str is now directly the transaction hash string
                                        if not tx_hash_str or tx_hash_str == "N/A":
                                            tx_hash_str = "UNKNOWN_HASH"

                                        logger.info(
                                            f"[distribute_rewards] WTA: Successfully sent {reward_amount_near_str_final} NEAR to {recipient_wallet}. Tx hash: {tx_hash_str}"
                                        )

                                        successful_transfers.append(
                                            {
                                                "user_id": user_id,
                                                "username": winner_data.get(
                                                    "username", "N/A"
                                                ),
                                                "wallet_address": recipient_wallet,
                                                "amount": reward_amount_near_str_final,
                                                "currency": "NEAR",
                                                "transaction_hash": tx_hash_str,
                                                "reward_type": "near",
                                            }
                                        )
                                    except Exception as e:
                                        error_msg = str(e)
                                        if "RPC not available" in error_msg:
                                            logger.error(
                                                f"[distribute_rewards] WTA: NEAR RPC connection failed. This is likely a temporary network issue. Reward distribution will be retried automatically."
                                            )
                                            logger.error(
                                                f"[distribute_rewards] WTA: Failed to send reward to {recipient_wallet}: RPC not available"
                                            )
                                        else:
                                            logger.error(
                                                f"[distribute_rewards] WTA: Failed to send reward to {recipient_wallet}: {e}"
                                            )
                                        traceback.print_exc()
                                else:
                                    logger.error(
                                        f"[distribute_rewards] WTA: Wallet {recipient_wallet} verification failed for user {user_id}. Skipping transfer."
                                    )
                            else:
                                logger.warning(
                                    f"[distribute_rewards] WTA: Calculated reward amount for user {user_id} is zero or negative after fee ({reward_amount_near_str_final} NEAR), skipping transfer."
                                )
                        else:
                            logger.warning(
                                f"[distribute_rewards] WTA: Parsed reward amount for user {user_id} is zero or negative ({reward_amount_near_str} NEAR), skipping transfer."
                            )
                else:
                    logger.info(
                        f"[distribute_rewards] WTA: No winners found for quiz {quiz_id}. No rewards distributed."
                    )
            else:
                # Existing rank-based or other reward logic
                for rank, winner_data in enumerate(winners, 1):
                    logger.debug(
                        f"[distribute_rewards] Processing rank={rank}, data={winner_data}"
                    )
                    user_id = winner_data["user_id"]
                    user = session.query(User).filter(User.id == user_id).first()

                    # Check for wallet in both legacy and new systems
                    wallet_address = None
                    if user:
                        # Check legacy wallet_address field
                        if user.wallet_address:
                            wallet_address = user.wallet_address
                        # Check new UserWallet system
                        elif user.wallets:
                            active_wallet = next(
                                (w for w in user.wallets if w.is_active), None
                            )
                            if active_wallet:
                                wallet_address = active_wallet.account_id

                    # Skip if no wallet linked
                    if not user or not wallet_address:
                        logger.warning(
                            f"[distribute_rewards] User {user_id} (Username: {winner_data.get('username', 'N/A')}) has no wallet linked or user not found, skipping."
                        )
                        continue

                    reward_amount_yoctonear = 0
                    reward_amount_near_str = "0"

                    if reward_schedule and isinstance(reward_schedule, dict):
                        schedule_type = reward_schedule.get("type")
                        if schedule_type == "wta_amount":  # Winner Takes All
                            amount_text = str(reward_schedule.get("details_text", ""))
                            # Expecting format like "1 NEAR" or "0.5 NEAR"
                            match = re.search(
                                r"(\d+\.?\d*)\s*([A-Za-z]{3,})\b", amount_text
                            )
                            if match:
                                reward_amount_near_str = match.group(1)
                                try:
                                    reward_amount_yoctonear = int(
                                        float(reward_amount_near_str) * NEAR
                                    )  # NEAR is 10^24 yoctoNEAR
                                except ValueError:
                                    logger.error(
                                        f"[distribute_rewards] Invalid reward amount in details_text: {amount_text} for quiz {quiz_id}"
                                    )
                                    continue
                            else:
                                logger.error(
                                    f"[distribute_rewards] Could not parse reward amount from details_text: {amount_text} for quiz {quiz_id}"
                                )
                                continue
                        elif schedule_type == "top3_details":  # Top 3 Winners
                            amount_text = str(reward_schedule.get("details_text", ""))

                            # First try to parse rank-specific format like "3 NEAR for 1st, 2 NEAR for 2nd, 1 NEAR for 3rd"
                            rank_patterns = [
                                r"(\d+\.?\d*)\s*([A-Za-z]{3,})\s*for\s*1st",  # 1st place
                                r"(\d+\.?\d*)\s*([A-Za-z]{3,})\s*for\s*2nd",  # 2nd place
                                r"(\d+\.?\d*)\s*([A-Za-z]{3,})\s*for\s*3rd",  # 3rd place
                            ]

                            if rank <= 3:  # Only process top 3 ranks
                                pattern = rank_patterns[rank - 1]
                                match = re.search(pattern, amount_text)
                                if match:
                                    reward_amount_near_str = match.group(1)
                                    try:
                                        reward_amount_yoctonear = int(
                                            float(reward_amount_near_str) * NEAR
                                        )
                                    except ValueError:
                                        logger.error(
                                            f"[distribute_rewards] Invalid reward amount in details_text: {amount_text} for quiz {quiz_id}, rank {rank}"
                                        )
                                        continue
                                else:
                                    # Fallback: if no rank-specific format found, try to parse a single amount
                                    # and distribute it according to a default ratio
                                    fallback_match = re.search(
                                        r"(\d+\.?\d*)\s*([A-Za-z]{3,})\b", amount_text
                                    )
                                    if fallback_match:
                                        total_amount = float(fallback_match.group(1))
                                        # Default distribution: 50% for 1st, 30% for 2nd, 20% for 3rd
                                        rank_ratios = {1: 0.5, 2: 0.3, 3: 0.2}
                                        if rank in rank_ratios:
                                            reward_amount_near_str = str(
                                                round(
                                                    total_amount * rank_ratios[rank], 6
                                                )
                                            )
                                            try:
                                                reward_amount_yoctonear = int(
                                                    float(reward_amount_near_str) * NEAR
                                                )
                                                logger.info(
                                                    f"[distribute_rewards] Using fallback distribution for rank {rank}: {reward_amount_near_str} NEAR (from total {total_amount} NEAR)"
                                                )
                                            except ValueError:
                                                logger.error(
                                                    f"[distribute_rewards] Invalid fallback reward amount for rank {rank}: {reward_amount_near_str} for quiz {quiz_id}"
                                                )
                                                continue
                                        else:
                                            logger.error(
                                                f"[distribute_rewards] Rank {rank} not supported in fallback distribution for quiz {quiz_id}"
                                            )
                                            continue
                                    else:
                                        logger.error(
                                            f"[distribute_rewards] Could not parse reward amount for rank {rank} from details_text: {amount_text} for quiz {quiz_id}"
                                        )
                                        continue
                            else:
                                logger.warning(
                                    f"[distribute_rewards] Rank {rank} is beyond top 3, skipping reward for quiz {quiz_id}"
                                )
                                continue
                        # Example for rank-based rewards (if you add this type later)
                        elif schedule_type == "rank_based" and str(
                            rank
                        ) in reward_schedule.get("ranks", {}):
                            reward_amount_near_str = str(
                                reward_schedule["ranks"][str(rank)]
                            )
                            try:
                                reward_amount_yoctonear = int(
                                    float(reward_amount_near_str) * NEAR
                                )
                            except ValueError:
                                logger.error(
                                    f"[distribute_rewards] Invalid reward amount for rank {rank}: {reward_amount_near_str} for quiz {quiz_id}"
                                )
                                continue
                        else:
                            logger.warning(
                                f"[distribute_rewards] Unknown or unhandled reward schedule type '{schedule_type}' or missing rank info for quiz {quiz_id}. Schedule: {reward_schedule}"
                            )
                            continue
                    else:
                        logger.error(
                            f"[distribute_rewards] Invalid or missing reward_schedule for quiz {quiz_id}"
                        )
                        continue

                    if reward_amount_yoctonear <= 0:
                        logger.warning(
                            f"[distribute_rewards] Calculated reward amount for user {user_id} is zero or negative ({reward_amount_near_str} NEAR), skipping transfer."
                        )
                        continue

                    # Deduct 2% fee from the reward
                    # Ensure reward_amount_near_str is a string representation of a float
                    try:
                        reward_amount_near_float = float(reward_amount_near_str) * 0.98
                        reward_amount_near_str_final = str(
                            round(reward_amount_near_float, 6)
                        )
                        reward_amount_yoctonear_final = int(
                            reward_amount_near_float * NEAR
                        )
                    except ValueError:
                        logger.error(
                            f"[distribute_rewards] Could not convert reward_amount_near_str '{reward_amount_near_str}' to float for fee calculation."
                        )
                        continue

                    if reward_amount_yoctonear_final <= 0:
                        logger.warning(
                            f"[distribute_rewards] Calculated reward amount for user {user_id} is zero or negative after fee ({reward_amount_near_str_final} NEAR), skipping transfer."
                        )
                        continue

                    recipient_wallet = wallet_address

                    # SMART WALLET VERIFICATION - Check if wallet exists on blockchain before transfer
                    wallet_verified = await self._verify_and_recover_wallet(
                        user_id, recipient_wallet, winner_data.get("username", "N/A")
                    )
                    if not wallet_verified:
                        logger.error(
                            f"[distribute_rewards] Wallet {recipient_wallet} verification failed for user {user_id}. Skipping transfer."
                        )
                        continue

                    # Check if this is a token reward and handle accordingly
                    if wallet_verified and is_token_reward:
                        # Handle token reward distribution
                        try:
                            from services.token_service import TokenService

                            token_service = TokenService()

                            # Get token metadata
                            metadata = await token_service.get_token_metadata(
                                self.near_account,
                                quiz.token_contract_address,
                            )
                            token_symbol = metadata["symbol"]

                            logger.info(
                                f"[distribute_rewards] Attempting to send {reward_amount_near_str_final} {token_symbol} to {recipient_wallet} (User: {winner_data.get('username', 'N/A')}, Rank: {rank})"
                            )

                            # Transfer tokens using py-near FTS
                            transfer_result = await token_service.transfer_tokens(
                                account=self.near_account,
                                token_contract=quiz.token_contract_address,
                                recipient_account_id=recipient_wallet,
                                amount=reward_amount_near_float,
                                force_register=True,  # Automatically handle storage deposits
                            )

                            if transfer_result["success"]:
                                tx_hash_str = transfer_result["transaction_hash"]
                                logger.info(
                                    f"[distribute_rewards] Successfully sent {reward_amount_near_str_final} {token_symbol} to {recipient_wallet}. Tx hash: {tx_hash_str}"
                                )

                                successful_transfers.append(
                                    {
                                        "user_id": user_id,
                                        "username": winner_data.get("username", "N/A"),
                                        "wallet_address": recipient_wallet,
                                        "amount": reward_amount_near_str_final,
                                        "currency": token_symbol,
                                        "transaction_hash": tx_hash_str,
                                        "reward_type": "token",
                                        "rank": rank,
                                    }
                                )
                            else:
                                logger.error(
                                    f"[distribute_rewards] Failed to send {reward_amount_near_str_final} {token_symbol} to {recipient_wallet}. Error: {transfer_result['error']}"
                                )
                        except Exception as e:
                            logger.error(
                                f"[distribute_rewards] Error distributing token reward: {e}"
                            )
                    elif wallet_verified:
                        # Handle NEAR reward distribution (existing logic)
                        logger.info(
                            f"[distribute_rewards] Attempting to send {reward_amount_near_str_final} NEAR ({reward_amount_yoctonear_final} yoctoNEAR) to {recipient_wallet} (User: {winner_data.get('username', 'N/A')}, Rank: {rank})"
                        )

                        try:
                            # THE ACTUAL TRANSFER CALL
                            # Use nowait=True to get transaction hash directly as string
                            tx_hash_str = await self.near_account.send_money(
                                recipient_wallet,
                                reward_amount_yoctonear_final,
                                nowait=True,
                            )

                            # tx_hash_str is now directly the transaction hash string
                            if not tx_hash_str or tx_hash_str == "N/A":
                                tx_hash_str = "UNKNOWN_HASH"

                            logger.info(
                                f"[distribute_rewards] Successfully sent {reward_amount_near_str_final} NEAR to {recipient_wallet}. Tx hash: {tx_hash_str}"
                            )
                            successful_transfers.append(
                                {
                                    "user_id": user_id,
                                    "username": winner_data.get(
                                        "username", "N/A"
                                    ),  # Added username
                                    "wallet_address": recipient_wallet,
                                    "amount_near": reward_amount_near_str_final,  # Use final amount
                                    "tx_hash": tx_hash_str,
                                    "rank": rank,  # Keep rank for non-WTA
                                    "reward_type": "near",
                                }
                            )
                        except Exception as transfer_exc:
                            logger.error(
                                f"[distribute_rewards] Failed to send NEAR to {recipient_wallet} for user {user_id}: {transfer_exc}"
                            )
                            traceback.print_exc()
                    else:
                        logger.error(
                            f"[distribute_rewards] Wallet {recipient_wallet} verification failed for user {user_id}. Skipping transfer."
                        )

            logger.info(
                f"[distribute_rewards] Total successful transfers: {len(successful_transfers)}"
            )

            # Mark quiz as CLOSED and set rewards_distributed_at if we processed winners
            quiz.status = QuizStatus.CLOSED
            if hasattr(quiz, "rewards_distributed_at"):
                quiz.rewards_distributed_at = datetime.utcnow()
            session.commit()

            if successful_transfers:
                logger.info(
                    f"Quiz {quiz_id} marked as CLOSED. Rewards distributed to {len(successful_transfers)} winner(s). Details: {successful_transfers}"
                )
            else:
                logger.warning(
                    f"[distribute_rewards] Quiz {quiz_id} marked as CLOSED. No transfers were successfully performed, though winners might have been present (e.g., no linked wallets, individual transfer failures)."
                )

            return successful_transfers  # Return list of successful transfers (can be empty)

        except Exception as e:
            logger.error(f"Error distributing rewards for quiz {quiz_id}: {e}")
            traceback.print_exc()
            # Do not change quiz status here, critical failure
            return False  # Indicates critical failure
        finally:
            if session:
                session.close()

    @retry(
        retry=retry_if_exception_type((httpx.ReadTimeout, httpx.ConnectTimeout)),
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10),
    )
    async def _fetch_transaction_status_rpc(
        self, tx_hash: str, sender_account_id: str
    ) -> Dict[str, Any]:
        """
        Fetches raw transaction status from NEAR RPC.
        Implements retry logic for timeout errors.

        Args:
            tx_hash: The transaction hash to verify
            sender_account_id: The sender's account ID

        Returns:
            Dict containing the transaction verification result

        Raises:
            httpx.TimeoutException: If all retry attempts fail
        """
        async with httpx.AsyncClient(timeout=30.0) as client:
            payload = {
                "jsonrpc": "2.0",
                "id": "dontcare",
                "method": "EXPERIMENTAL_tx_status",
                "params": {
                    "tx_hash": tx_hash,
                    "sender_account_id": sender_account_id,
                    "wait_until": "FINAL",
                },
            }

            try:
                resp = await client.post(Config.NEAR_RPC_ENDPOINT_TRANS, json=payload)
                resp.raise_for_status()
                result = resp.json()

                if "error" in result:
                    error_name = result["error"].get("name")
                    error_cause = result["error"].get("cause", {}).get("name")
                    logger.error(f"RPC Error: {error_name} - {error_cause}")
                    raise Exception(f"Transaction verification failed: {error_name}")

                return result["result"]

            except httpx.TimeoutException as e:
                logger.warning(
                    f"Timeout while verifying transaction {tx_hash}, retrying..."
                )
                raise
            except Exception as e:
                logger.error(f"Error verifying transaction {tx_hash}: {str(e)}")
                raise

    async def verify_transaction_by_hash(
        self,
        tx_hash: str,
        quiz_id: str,
        user_id: Optional[str] = None,
        expected_sender: Optional[str] = None,
        send_announcement: bool = True,
    ) -> tuple[bool, str]:
        """
        Verify a transaction by its hash, checking that it was sent by the quiz creator.

        Args:
            tx_hash: The transaction hash to verify
            quiz_id: The quiz ID being funded
            user_id: The ID of the user making the payment (quiz creator)
            expected_sender: Optional specific sender to verify (legacy parameter)
            send_announcement: Whether to send the quiz activation announcement (default: True)
            quiz_id: The quiz ID being funded
            user_id: The ID of the user making the payment (quiz creator)
            expected_sender: Optional specific sender to verify (legacy parameter)

        Returns:
            A tuple containing a boolean success status and a user-facing string message.
        """
        # 1. Basic validation - check if hash is provided
        if not tx_hash or not tx_hash.strip():
            msg = (
                "No transaction hash provided. Please provide a valid transaction hash."
            )
            logger.warning("Empty transaction hash provided")
            return False, msg

        tx_hash = tx_hash.strip()

        # 2. Length validation - NEAR transaction hashes are typically 44 characters
        if len(tx_hash) != 44:
            msg = f"Invalid transaction hash length. Expected 44 characters, got {len(tx_hash)} characters."
            logger.warning(f"Hash length validation failed for '{tx_hash}': {msg}")
            return False, msg

        # 3. Format validation - should be base58 encoded
        if not re.match(r"^[1-9A-HJ-NP-Za-km-z]{44}$", tx_hash):
            msg = "Invalid transaction hash format. The hash should contain only valid base58 characters (1-9, A-H, J-N, P-Z, a-k, m-z)."
            logger.warning(f"Hash format validation failed for '{tx_hash}': {msg}")
            return False, msg

        if not self.near_account:
            msg = "Cannot verify transaction - internal error."
            logger.error("NEAR account not initialized")
            return False, msg

        from store.database import get_db
        from models.user import User

        quiz_data = {}
        creator_wallet = None

        with get_db() as session:
            quiz = session.query(Quiz).filter(Quiz.id == quiz_id).first()
            if not quiz:
                msg = f"Quiz {quiz_id} not found."
                logger.warning(f"Verification failed: {msg}")
                return False, msg

            if quiz.status != QuizStatus.FUNDING:
                msg = f"This quiz is not currently awaiting funding. Its status is {quiz.status.value}."
                logger.warning(
                    f"Verification failed: Quiz {quiz_id} is not in FUNDING state (current: {quiz.status})."
                )
                return False, msg

            # Fetch the quiz creator's wallet address using the provided user_id
            if user_id:
                creator = session.query(User).filter(User.id == user_id).first()
            else:
                msg = "Cannot verify transaction - creator user ID not provided."
                logger.error(f"User ID not provided for quiz {quiz_id} verification.")
                return False, msg

            if not creator or not creator.wallet_address:
                msg = "Could not identify the quiz creator or their wallet address. Please make sure you have linked your wallet using /linkwallet."
                logger.error(
                    f"User {user_id} not found or has no wallet address for quiz {quiz_id}."
                )
                return False, msg
            creator_wallet = creator.wallet_address

            # Store all required attributes while session is open
            quiz_data = {
                "deposit_address": quiz.deposit_address,
                "required_amount": self._calculate_required_amount(
                    quiz.reward_schedule
                ),
                "topic": quiz.topic,
                "group_chat_id": quiz.group_chat_id,
                "created_at": quiz.created_at,
                "questions": quiz.questions,
                "duration_seconds": quiz.duration_seconds,
            }

            # Validate that deposit address is properly set
            if not quiz_data["deposit_address"]:
                msg = "Quiz deposit address is not configured. Please contact an administrator."
                logger.error(
                    f"Quiz {quiz_id} has no deposit_address set. This indicates a configuration problem."
                )
                return False, msg

        # Check if this hash has already been used for any quiz
        with get_db() as session:
            existing_quiz = (
                session.query(Quiz)
                .filter(Quiz.payment_transaction_hash == tx_hash)
                .first()
            )
            if existing_quiz:
                # Reject any duplicate use of the same hash
                msg = "This transaction hash has already been used. Please use a different one."
                logger.warning(
                    f"Transaction hash {tx_hash} already used for quiz {existing_quiz.id}."
                )
                return False, msg

        try:
            # Use the new, more reliable RPC fetcher
            result = await self._fetch_transaction_details_rpc(tx_hash, creator_wallet)

            if not result or "status" not in result:
                msg = "The transaction could not be found on the blockchain. Please check the hash and try again."
                logger.warning(f"RPC returned no result or status for tx {tx_hash}")
                return False, msg

            # Validate the sender from the transaction details
            signer_id = result.get("transaction", {}).get("signer_id")
            if signer_id != creator_wallet:
                msg = f"This transaction was not sent from the quiz creator's wallet ({creator_wallet})."
                logger.warning(
                    f"Transaction sender ({signer_id}) does not match quiz creator wallet ({creator_wallet})."
                )
                return False, msg

            status = result["status"]
            if isinstance(status, dict):
                if "SuccessValue" not in status and "success_value" not in status:
                    msg = "The transaction was found but it was not successful."
                    logger.warning(
                        f"Transaction {tx_hash} was not successful. Status: {status}"
                    )
                    return False, msg
            elif isinstance(status, str) and "SuccessValue" not in status:
                msg = "The transaction was found but it was not successful."
                logger.warning(
                    f"Transaction {tx_hash} was not successful. Status: {status}"
                )
                return False, msg

            tx = result.get("transaction", {})
            receiver_id = tx.get("receiver_id")
            expected_address = quiz_data["deposit_address"]

            if receiver_id != expected_address:
                msg = f"The funds were sent to the wrong address. Please send them to `{expected_address}`."
                logger.warning(
                    f"Transaction receiver ({receiver_id}) does not match deposit address ({expected_address})."
                )
                return False, msg

            # 3. Enforce stricter transfer window: only accept transactions after quiz creation and within 15 minutes
            quiz_created_at = quiz_data.get("created_at")
            if quiz_created_at:
                # Get block hash from transaction outcome for timestamp validation
                block_hash = result.get("transaction_outcome", {}).get("block_hash")
                if block_hash:
                    is_valid, error_msg = await self._validate_transaction_timestamp(
                        block_hash, quiz_created_at, tx_hash
                    )
                    if not is_valid:
                        return False, error_msg
                else:
                    logger.warning(
                        f"No block hash found in transaction outcome for tx {tx_hash}. Skipping timestamp validation."
                    )

            actions = tx.get("actions", [])
            total_yocto = 0
            for action in actions:
                if "Transfer" in action:
                    total_yocto += int(action["Transfer"].get("deposit", 0))

            # Calculate required amount including 2% fee
            # Use integer arithmetic to avoid floating point precision errors
            required_amount = quiz_data["required_amount"]

            # Convert to yoctoNEAR first, then add 2% fee using integer arithmetic
            required_yocto_base = int(required_amount * NEAR)
            fee_yocto = required_yocto_base * 2 // 100  # 2% fee using integer division
            required_yocto_with_fee = required_yocto_base + fee_yocto

            # For display purposes, convert back to NEAR
            required_amount_with_fee = required_yocto_with_fee / NEAR

            # Add a tolerance for floating point precision issues
            # The tolerance should be proportional to the transaction amount to handle
            # precision errors that scale with the amount being calculated
            # Use 0.01% of the required amount or 100,000 yoctoNEAR, whichever is larger
            proportional_tolerance = max(int(required_yocto_with_fee * 0.0001), 100000)

            logger.info(
                f"Transaction amount verification: deposited={total_yocto} yoctoNEAR ({total_yocto / NEAR:.6f} NEAR), "
                f"required={required_yocto_with_fee} yoctoNEAR ({required_yocto_with_fee / NEAR:.6f} NEAR), "
                f"difference={total_yocto - required_yocto_with_fee} yoctoNEAR, "
                f"tolerance={proportional_tolerance} yoctoNEAR"
            )

            if total_yocto >= (required_yocto_with_fee - proportional_tolerance):
                # mark active and announce in new session with retry logic
                from sqlalchemy.exc import IntegrityError
                from datetime import datetime, timezone, timedelta

                with get_db() as session:
                    quiz = session.query(Quiz).filter(Quiz.id == quiz_id).first()
                    if quiz.status != QuizStatus.FUNDING:
                        msg = "This quiz is no longer in a funding state. It may have been activated by another transaction."
                        logger.warning(
                            f"Quiz {quiz_id} is no longer in FUNDING state, aborting activation."
                        )
                        return False, msg

                    # Set up quiz activation with proper timing
                    quiz.status = QuizStatus.ACTIVE
                    quiz.payment_transaction_hash = tx_hash
                    quiz.activated_at = datetime.now(timezone.utc)

                    # Calculate end time if duration is specified
                    if quiz.duration_seconds and quiz.duration_seconds > 0:
                        quiz.end_time = quiz.activated_at + timedelta(
                            seconds=quiz.duration_seconds
                        )
                        logger.info(f"Quiz {quiz_id} end time set to: {quiz.end_time}")

                    try:
                        session.commit()
                        logger.info(
                            f"Quiz {quiz_id} activated successfully at {quiz.activated_at}"
                        )
                    except IntegrityError as ie:
                        session.rollback()
                        msg = "This transaction hash has just been used by another quiz. Please use a different one."
                        logger.warning(
                            f"IntegrityError in verify_transaction_by_hash for quiz {quiz_id}: {ie}"
                        )
                        return False, msg

                # send announcement using stored quiz data (only if requested)
                if send_announcement and quiz_data["group_chat_id"]:
                    # Calculate number of questions
                    num_questions = (
                        len(quiz_data["questions"]) if quiz_data["questions"] else 0
                    )

                    # Format end time information
                    end_time_text = "No specific end time set."
                    if (
                        quiz_data.get("duration_seconds")
                        and quiz_data["duration_seconds"] > 0
                    ):
                        # Calculate end time from activation
                        from datetime import datetime, timezone, timedelta

                        activation_time = datetime.now(timezone.utc)
                        end_time = activation_time + timedelta(
                            seconds=quiz_data["duration_seconds"]
                        )

                        # Format duration for display
                        duration_seconds = quiz_data["duration_seconds"]
                        if duration_seconds >= 86400:  # 1 day or more
                            days = duration_seconds // 86400
                            remaining = duration_seconds % 86400
                            hours = remaining // 3600
                            if hours > 0:
                                end_time_text = f"Ends in {days} day{'s' if days > 1 else ''} and {hours} hour{'s' if hours > 1 else ''}."
                            else:
                                end_time_text = (
                                    f"Ends in {days} day{'s' if days > 1 else ''}."
                                )
                        elif duration_seconds >= 3600:  # 1 hour or more
                            hours = duration_seconds // 3600
                            remaining = duration_seconds % 3600
                            minutes = remaining // 60
                            if minutes > 0:
                                end_time_text = f"Ends in {hours} hour{'s' if hours > 1 else ''} and {minutes} minute{'s' if minutes > 1 else ''}."
                            else:
                                end_time_text = (
                                    f"Ends in {hours} hour{'s' if hours > 1 else ''}."
                                )
                        elif duration_seconds >= 60:  # 1 minute or more
                            minutes = duration_seconds // 60
                            end_time_text = (
                                f"Ends in {minutes} minute{'s' if minutes > 1 else ''}."
                            )
                        else:
                            end_time_text = f"Ends in {duration_seconds} second{'s' if duration_seconds > 1 else ''}."  # Schedule auto-distribution if we have an application with JobQueue
                        if (
                            self.application
                            and hasattr(self.application, "job_queue")
                            and self.application.job_queue
                        ):
                            try:
                                # Import the scheduling function
                                from services.quiz_service import (
                                    schedule_auto_distribution,
                                )

                                # Schedule the auto-distribution
                                self.application.create_task(
                                    schedule_auto_distribution(
                                        self.application, quiz_id, duration_seconds
                                    )
                                )
                                logger.info(
                                    f"Scheduled auto-distribution for quiz {quiz_id} in {duration_seconds} seconds"
                                )
                            except Exception as schedule_error:
                                logger.error(
                                    f"Failed to schedule auto-distribution for quiz {quiz_id}: {schedule_error}"
                                )
                        else:
                            logger.warning(
                                f"Application or JobQueue not available for scheduling auto-distribution for quiz {quiz_id}"
                            )

                    await self.bot.send_message(
                        chat_id=quiz_data["group_chat_id"],
                        text=(
                            f"📣 New quiz '{quiz_data['topic']}' is now active! 🎯\n"
                            f"{num_questions} Question{'s' if num_questions != 1 else ''}\n"
                            f"Rewards: {quiz_data['required_amount']} NEAR\n"
                            f"Ends: {end_time_text}\n"
                            f"Type /playquiz to participate!"
                        ),
                    )  # Handle auto-distribution scheduling even if announcement is disabled
                elif (
                    not send_announcement
                    and quiz_data.get("duration_seconds")
                    and quiz_data["duration_seconds"] > 0
                ):
                    if (
                        self.application
                        and hasattr(self.application, "job_queue")
                        and self.application.job_queue
                    ):
                        try:
                            # Import the scheduling function
                            from services.quiz_service import schedule_auto_distribution

                            # Schedule the auto-distribution
                            self.application.create_task(
                                schedule_auto_distribution(
                                    self.application,
                                    quiz_id,
                                    quiz_data["duration_seconds"],
                                )
                            )
                            logger.info(
                                f"Scheduled auto-distribution for quiz {quiz_id} in {quiz_data['duration_seconds']} seconds"
                            )
                        except Exception as schedule_error:
                            logger.error(
                                f"Failed to schedule auto-distribution for quiz {quiz_id}: {schedule_error}"
                            )
                    else:
                        logger.warning(
                            f"Application or JobQueue not available for scheduling auto-distribution for quiz {quiz_id}"
                        )

                return True, "Quiz activated successfully!"
            else:
                shortage_yocto = required_yocto_with_fee - total_yocto
                shortage_near = shortage_yocto / NEAR
                msg = f"The deposited amount of {total_yocto / NEAR:.6f} NEAR is {shortage_near:.6f} NEAR short of the required {required_amount_with_fee:.6f} NEAR (including fees)."
                logger.warning(
                    f"Insufficient funds: deposited={total_yocto} yoctoNEAR, required={required_yocto_with_fee} yoctoNEAR, shortage={shortage_yocto} yoctoNEAR"
                )
                return False, msg
        except httpx.ReadTimeout:
            msg = "The blockchain network is currently slow to respond. Please try again in a few moments."
            logger.warning(f"Timeout error while verifying transaction {tx_hash}")
            return False, msg
        except httpx.ConnectTimeout:
            msg = "Unable to connect to the blockchain network. Please try again later."
            logger.warning(f"Connection timeout while verifying transaction {tx_hash}")
            return False, msg
        except Exception as e:
            # Handle specific retry errors from tenacity
            if "RetryError" in str(e) and (
                "ReadTimeout" in str(e) or "Timeout" in str(e)
            ):
                msg = "The blockchain network is experiencing delays. Please wait a few minutes and try again."
                logger.warning(
                    f"Retry timeout error while verifying transaction {tx_hash}: {e}"
                )
                return False, msg
            elif "RetryError" in str(e):
                msg = "Unable to verify the transaction after multiple attempts. Please check your transaction hash and try again."
                logger.warning(
                    f"Retry error while verifying transaction {tx_hash}: {e}"
                )
                return False, msg
            else:
                msg = "An unexpected internal error occurred. Please contact an administrator."
                logger.error(
                    f"Error verifying transaction {tx_hash}: {e}", exc_info=True
                )
                return False, msg

    def _calculate_required_amount(self, reward_schedule: dict) -> float:
        """
        Calculate the required amount from a reward schedule.

        Args:
            reward_schedule: Dictionary containing reward information

        Returns:
            Required amount as float, or 0.0 if parsing fails
        """
        if not reward_schedule:
            return 0.0

        reward_type = reward_schedule.get("type", "")
        details_text = reward_schedule.get("details_text", "")

        if not reward_type or not details_text:
            # Legacy format - try to sum numeric values
            try:
                return sum(
                    float(v)
                    for v in reward_schedule.values()
                    if isinstance(v, (int, float))
                    or (isinstance(v, str) and v.replace(".", "").isdigit())
                )
            except (ValueError, TypeError):
                logger.warning(
                    f"Could not parse legacy reward schedule: {reward_schedule}"
                )
                return 0.0

        # New format - parse from details_text based on type
        try:
            import re

            if reward_type == "wta_amount":
                # e.g., "5 NEAR", "10.5 USDT"
                match = re.search(r"(\d+\.?\d*)\s*([A-Za-z]{3,})\b", details_text)
                if match:
                    return float(match.group(1))

            elif reward_type in ["top3_details", "custom_details"]:
                # e.g., "3 NEAR for 1st, 2 NEAR for 2nd, 1 NEAR for 3rd"
                matches = re.findall(r"(\d+\.?\d*)\s*([A-Za-z]{3,})\b", details_text)
                if matches:
                    return sum(float(match[0]) for match in matches)

            elif reward_type == "manual_free_text":
                # Try to extract numbers and sum them
                matches = re.findall(r"(\d+\.?\d*)\s*([A-Za-z]{3,})\b", details_text)
                if matches:
                    return sum(float(match[0]) for match in matches)

        except (ValueError, AttributeError) as e:
            logger.warning(
                f"Error parsing reward amount from {reward_type}: {details_text} - {e}"
            )

        logger.warning(
            f"Could not determine required amount from reward schedule: {reward_schedule}"
        )
        return 0.0

    async def _fetch_block_details(self, block_hash: str) -> Optional[Dict[str, Any]]:
        """
        Fetches block details from NEAR RPC to get timestamp information.

        Args:
            block_hash: The block hash to query.

        Returns:
            A dictionary containing block details including timestamp, or None if failed.
        """
        async with httpx.AsyncClient(timeout=30.0) as client:
            payload = {
                "jsonrpc": "2.0",
                "id": "dontcare",
                "method": "block",
                "params": {"block_id": block_hash},
            }
            try:
                resp = await client.post(Config.NEAR_RPC_ENDPOINT, json=payload)
                resp.raise_for_status()
                result = resp.json()

                if "error" in result:
                    error_info = result["error"].get("data", {}).get("error_message")
                    logger.warning(f"RPC Error fetching block details: {error_info}")
                    return None

                return result.get("result", {})

            except httpx.TimeoutException:
                logger.warning(f"Timeout while fetching block {block_hash}")
                return None
            except Exception as e:
                logger.warning(f"Error fetching block {block_hash}: {str(e)}")
                return None

    async def _validate_transaction_timestamp(
        self, block_hash: str, quiz_created_at: datetime, tx_hash: str
    ) -> tuple[bool, str]:
        """
        Validates that a transaction occurred within the allowed time window.

        Args:
            block_hash: The block hash from the transaction outcome.
            quiz_created_at: When the quiz was created.
            tx_hash: Transaction hash for logging.

        Returns:
            Tuple of (is_valid: bool, error_message: str)
        """
        try:
            block_details = await self._fetch_block_details(block_hash)
            if not block_details:
                logger.warning(
                    f"Could not fetch block details for timestamp validation of tx {tx_hash}. Allowing transaction."
                )
                return True, ""

            # Extract timestamp from block header
            header = block_details.get("header", {})
            timestamp_nanosec = header.get("timestamp", 0)

            if not timestamp_nanosec:
                logger.warning(
                    f"No timestamp found in block {block_hash} for tx {tx_hash}. Allowing transaction."
                )
                return True, ""

            # Convert nanoseconds to datetime
            block_timestamp = datetime.utcfromtimestamp(int(timestamp_nanosec) / 1e9)
            time_limit = timedelta(minutes=15)

            # Check if transaction is within allowed window
            if not (
                quiz_created_at <= block_timestamp <= (quiz_created_at + time_limit)
            ):
                msg = "This transaction is too old. Please submit a transaction hash that is less than 15 minutes old."
                logger.warning(
                    f"Transaction {tx_hash} is outside the allowed window. "
                    f"Block time: {block_timestamp}, Quiz created: {quiz_created_at}, Limit: {time_limit}"
                )
                return False, msg

            return True, ""

        except (ValueError, TypeError) as e:
            logger.warning(
                f"Error validating timestamp for transaction {tx_hash}: {e}. Allowing transaction."
            )
            return True, ""

    async def _verify_and_recover_wallet(
        self, user_id: str, wallet_address: str, username: str = "N/A"
    ) -> bool:
        """
        Smart wallet verification with automatic recovery using stored private keys.

        This method:
        1. Checks if wallet exists on blockchain
        2. If missing but user has private key in DB, attempts auto-recovery
        3. Returns True only if wallet is verified to exist on blockchain

        Args:
            user_id: Telegram user ID
            wallet_address: NEAR wallet address to verify
            username: Username for logging

        Returns:
            bool: True if wallet exists or was successfully recovered, False otherwise
        """
        try:
            # Import services we need
            from services.near_wallet_service import NEARWalletService
            from services.wallet_service import WalletService

            logger.info(
                f"[Smart Wallet Verification] Checking wallet {wallet_address} for user {user_id} ({username})"
            )

            # Initialize services
            near_service = NEARWalletService()
            wallet_service = WalletService()

            # Get wallet from database first
            wallet_info = await wallet_service.get_user_wallet(user_id)
            if not wallet_info:
                logger.error(
                    f"[Smart Wallet Verification] No wallet found in database for user {user_id}"
                )
                return False

            network = wallet_info.get("network", "testnet")

            # Step 1: Check if wallet exists on blockchain
            try:
                exists_on_chain = await near_service.verify_account_exists(
                    wallet_address, network
                )
                if exists_on_chain:
                    logger.info(
                        f"[Smart Wallet Verification] ✅ Wallet {wallet_address} exists on blockchain"
                    )
                    return True

                logger.warning(
                    f"[Smart Wallet Verification] ❌ Wallet {wallet_address} missing from blockchain"
                )
            except Exception as e:
                logger.error(
                    f"[Smart Wallet Verification] Error checking wallet existence: {e}"
                )
                return False

            # Step 2: Attempt auto-recovery if we have private key
            if not wallet_info.get("encrypted_private_key"):
                logger.error(
                    f"[Smart Wallet Verification] No private key available for auto-recovery of {wallet_address}"
                )
                return False

            logger.info(
                f"[Smart Wallet Verification] 🔧 Attempting auto-recovery for {wallet_address}"
            )

            try:
                # Decrypt private key
                private_key = near_service.decrypt_private_key(
                    wallet_info["encrypted_private_key"],
                    wallet_info["iv"],
                    wallet_info["tag"],
                )

                # Extract public key from private key
                import base58

                private_key_bytes = base58.b58decode(
                    private_key.replace("ed25519:", "")
                )
                public_key_bytes = private_key_bytes[32:]  # Public key is last 32 bytes

                # Determine network and creation method
                if network == "mainnet":
                    success = await near_service._create_mainnet_sub_account_robust(
                        wallet_address, public_key_bytes
                    )
                else:
                    success = await near_service._create_testnet_sub_account_robust(
                        wallet_address, public_key_bytes
                    )

                if success:
                    # Verify the recovery worked
                    recovered_exists = await near_service.verify_account_exists(
                        wallet_address, network
                    )
                    if recovered_exists:
                        logger.info(
                            f"[Smart Wallet Verification] ✅ Successfully recovered wallet {wallet_address}"
                        )
                        return True
                    else:
                        logger.error(
                            f"[Smart Wallet Verification] Recovery appeared successful but verification failed for {wallet_address}"
                        )
                        return False
                else:
                    logger.error(
                        f"[Smart Wallet Verification] Recovery failed for {wallet_address}"
                    )
                    return False

            except Exception as recovery_error:
                logger.error(
                    f"[Smart Wallet Verification] Auto-recovery failed for {wallet_address}: {recovery_error}"
                )
                return False

        except Exception as e:
            logger.error(
                f"[Smart Wallet Verification] Unexpected error verifying wallet {wallet_address}: {e}"
            )
            return False


# To be called during bot initialization
async def start_blockchain_monitor(bot, application=None):
    """Initialize and start the blockchain monitor with the bot instance and application."""
    logger.info(
        f"[start_blockchain_monitor] creating BlockchainMonitor with bot={bot}, application={application}"
    )
    monitor = BlockchainMonitor(bot, application)
    await monitor.start_monitoring()
    logger.info(f"[start_blockchain_monitor] monitor started: {monitor}")
    return monitor
