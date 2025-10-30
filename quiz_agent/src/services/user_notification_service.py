import asyncio
import logging
from typing import Dict, Optional, List
from telegram import Bot, InlineKeyboardMarkup, InlineKeyboardButton
from telegram.error import TelegramError
from utils.config import Config
from services.wallet_creation_queue import wallet_creation_queue
from services.database_service import db_service

logger = logging.getLogger(__name__)


class UserNotificationService:
    """Service for sending user notifications about wallet creation status"""

    def __init__(self, bot: Bot):
        self.bot = bot
        self.notification_queue: Dict[int, Dict] = {}

    async def notify_wallet_creation_delay(
        self,
        user_id: int,
        account_id: str,
        network: str = "testnet",
        estimated_delay: int = 5,
    ):
        """
        Notify user that wallet creation is delayed

        Args:
            user_id: Telegram user ID
            account_id: The account ID being created
            network: Network (testnet/mainnet)
            estimated_delay: Estimated delay in minutes
        """
        try:
            network_name = "Mainnet" if network == "mainnet" else "Testnet"

            message = f"""⏳ **Wallet Creation in Progress** *({network_name})*

🔧 **Status:** Your NEAR wallet is being created on the blockchain
📋 **Account ID:** `{account_id}`
⏱️ **Estimated Time:** {estimated_delay} minutes

🔄 **What's happening:**
• Creating your account on the NEAR blockchain
• Verifying account creation
• Setting up your wallet

💡 **Note:** This process may take a few minutes due to network conditions. You'll receive a notification once your wallet is ready!

🎮 **In the meantime:** You can still explore the bot features while we set up your wallet."""

            # Create a simple keyboard
            keyboard = InlineKeyboardMarkup(
                [
                    [
                        InlineKeyboardButton(
                            "🔄 Check Status",
                            callback_data=f"check_wallet_status_{user_id}",
                        )
                    ],
                    [InlineKeyboardButton("ℹ️ Help", callback_data="help")],
                ]
            )

            await self.bot.send_message(
                chat_id=user_id,
                text=message,
                parse_mode="Markdown",
                reply_markup=keyboard,
            )

            logger.info(f"Sent wallet creation delay notification to user {user_id}")

        except TelegramError as e:
            logger.error(f"Failed to send delay notification to user {user_id}: {e}")
        except Exception as e:
            logger.error(f"Error sending delay notification to user {user_id}: {e}")

    async def notify_wallet_creation_success(
        self, user_id: int, account_id: str, network: str = "testnet"
    ):
        """
        Notify user that wallet creation was successful

        Args:
            user_id: Telegram user ID
            account_id: The created account ID
            network: Network (testnet/mainnet)
        """
        try:
            network_name = "Mainnet" if network == "mainnet" else "Testnet"

            message = f"""✅ **Wallet Creation Successful!** *({network_name})*

🎉 **Great news!** Your NEAR wallet has been successfully created and verified on the blockchain.

📋 **Account Details:**
• **Account ID:** `{account_id}`
• **Network:** {network_name}
• **Status:** ✅ Active and ready to use

🎮 **You can now:**
• Play quiz games and earn rewards
• Receive NEAR tokens in your wallet
• Transfer funds to other accounts

🚀 **Ready to start gaming?** Use the buttons below to explore!"""

            # Create gaming keyboard
            keyboard = InlineKeyboardMarkup(
                [
                    [InlineKeyboardButton("🎮 Play Games", callback_data="play_games")],
                    [
                        InlineKeyboardButton(
                            "💰 Check Balance", callback_data=f"check_balance_{user_id}"
                        )
                    ],
                    [
                        InlineKeyboardButton(
                            "ℹ️ Wallet Info", callback_data=f"wallet_info_{user_id}"
                        )
                    ],
                ]
            )

            await self.bot.send_message(
                chat_id=user_id,
                text=message,
                parse_mode="Markdown",
                reply_markup=keyboard,
            )

            logger.info(f"Sent wallet creation success notification to user {user_id}")

        except TelegramError as e:
            logger.error(f"Failed to send success notification to user {user_id}: {e}")
        except Exception as e:
            logger.error(f"Error sending success notification to user {user_id}: {e}")

    async def notify_wallet_creation_failure(
        self,
        user_id: int,
        account_id: str,
        error_message: str,
        network: str = "testnet",
    ):
        """
        Notify user that wallet creation failed

        Args:
            user_id: Telegram user ID
            account_id: The account ID that failed to create
            error_message: Error description
            network: Network (testnet/mainnet)
        """
        try:
            network_name = "Mainnet" if network == "mainnet" else "Testnet"

            message = f"""❌ **Wallet Creation Failed** *({network_name})*

😔 **Sorry!** We encountered an issue while creating your NEAR wallet.

📋 **Details:**
• **Account ID:** `{account_id}`
• **Network:** {network_name}
• **Error:** {error_message}

🔧 **What we're doing:**
• We've added your wallet creation to our retry queue
• Our system will automatically attempt to create your wallet again
• You'll receive a notification once it's ready

🆘 **Need help?** Contact our support team if this issue persists.

🔄 **Try again:** You can also attempt to create a new wallet."""

            # Create retry keyboard
            keyboard = InlineKeyboardMarkup(
                [
                    [
                        InlineKeyboardButton(
                            "🔄 Try Again", callback_data="create_wallet"
                        )
                    ],
                    [
                        InlineKeyboardButton(
                            "🆘 Contact Support", callback_data="contact_support"
                        )
                    ],
                    [InlineKeyboardButton("ℹ️ Help", callback_data="help")],
                ]
            )

            await self.bot.send_message(
                chat_id=user_id,
                text=message,
                parse_mode="Markdown",
                reply_markup=keyboard,
            )

            logger.info(f"Sent wallet creation failure notification to user {user_id}")

        except TelegramError as e:
            logger.error(f"Failed to send failure notification to user {user_id}: {e}")
        except Exception as e:
            logger.error(f"Error sending failure notification to user {user_id}: {e}")

    async def notify_wallet_creation_retry(
        self, user_id: int, account_id: str, retry_count: int, network: str = "testnet"
    ):
        """
        Notify user about wallet creation retry

        Args:
            user_id: Telegram user ID
            account_id: The account ID being retried
            retry_count: Current retry attempt number
            network: Network (testnet/mainnet)
        """
        try:
            network_name = "Mainnet" if network == "mainnet" else "Testnet"

            message = f"""🔄 **Retrying Wallet Creation** *({network_name})*

⏳ **Update:** We're retrying to create your NEAR wallet (attempt {retry_count}).

📋 **Account ID:** `{account_id}`
🌐 **Network:** {network_name}

💪 **Don't worry!** Our system is working to resolve any network issues and get your wallet created.

⏱️ **Expected time:** 2-5 minutes

You'll receive another notification once your wallet is ready!"""

            await self.bot.send_message(
                chat_id=user_id, text=message, parse_mode="Markdown"
            )

            logger.info(
                f"Sent wallet creation retry notification to user {user_id} (attempt {retry_count})"
            )

        except TelegramError as e:
            logger.error(f"Failed to send retry notification to user {user_id}: {e}")
        except Exception as e:
            logger.error(f"Error sending retry notification to user {user_id}: {e}")

    async def process_notification_queue(self):
        """Process pending notifications from the wallet creation queue"""
        try:
            # Get completed tasks from the queue
            completed_tasks = await self._get_completed_wallet_tasks()

            for task in completed_tasks:
                user_id = task["user_id"]
                account_id = task["account_id"]
                network = "mainnet" if task["is_mainnet"] else "testnet"

                if task["status"] == "completed":
                    await self.notify_wallet_creation_success(
                        user_id, account_id, network
                    )
                elif task["status"] == "failed":
                    error_msg = task.get("last_error", "Unknown error")
                    await self.notify_wallet_creation_failure(
                        user_id, account_id, error_msg, network
                    )

                # Remove from notification queue
                await self._remove_completed_task(task)

        except Exception as e:
            logger.error(f"Error processing notification queue: {e}")

    async def _get_completed_wallet_tasks(self) -> List[Dict]:
        """Get completed wallet creation tasks that need notifications"""
        try:
            # This would integrate with the wallet creation queue
            # For now, return empty list
            return []
        except Exception as e:
            logger.error(f"Error getting completed wallet tasks: {e}")
            return []

    async def _remove_completed_task(self, task: Dict):
        """Remove a completed task from the notification queue"""
        try:
            # This would integrate with the wallet creation queue
            # For now, just log
            logger.info(f"Removed completed task for user {task['user_id']}")
        except Exception as e:
            logger.error(f"Error removing completed task: {e}")


# Global instance (will be initialized with bot)
user_notification_service: Optional[UserNotificationService] = None


def initialize_notification_service(bot: Bot):
    """Initialize the global notification service with a bot instance"""
    global user_notification_service
    user_notification_service = UserNotificationService(bot)
    logger.info("User notification service initialized")
