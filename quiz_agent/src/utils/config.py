import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Define environment modes
ENVIRONMENT = os.getenv("ENVIRONMENT", "development").lower()


class Config:
    # Telegram Bot Configuration
    TELEGRAM_TOKEN = os.getenv("TELEGRAM_TOKEN")
    # Webhook Configuration (optional, if not set, polling is used)
    WEBHOOK_URL = os.getenv("WEBHOOK_URL")  # e.g., https://yourdomain.com or ngrok URL
    WEBHOOK_LISTEN_IP = os.getenv("WEBHOOK_LISTEN_IP", "0.0.0.0")  # IP to listen on
    WEBHOOK_PORT = os.getenv("WEBHOOK_PORT", "8443")  # Port to listen on
    WEBHOOK_URL_PATH = os.getenv(
        "WEBHOOK_URL_PATH"
    )  # Path for the webhook, defaults to TELEGRAM_TOKEN in main.py if not set
    SSL_CERT_PATH = os.getenv("SSL_CERT_PATH")
    SSL_PRIVATE_KEY_PATH = os.getenv("SSL_PRIVATE_KEY_PATH")
    # Gemini API for quiz generation
    GOOGLE_API_KEY = os.getenv("GOOGLE_GEMINI_API_KEY")

    # NEAR Blockchain Configuration
    NEAR_RPC_ENDPOINT = os.getenv("NEAR_RPC_ENDPOINT", "https://free.rpc.fastnear.com")
    NEAR_WALLET_PRIVATE_KEY = os.getenv("NEAR_WALLET_PRIVATE_KEY")
    NEAR_WALLET_ADDRESS = os.getenv("NEAR_WALLET_ADDRESS")
    NEAR_RPC_ENDPOINT_TRANS = os.getenv(
        "NEAR_RPC_ENDPOINT", "https://allthatnode.com/protocol/near.dsrv"
    )
    # Database Configuration
    # In production, use PostgreSQL; in development, fallback to SQLite
    DATABASE_URL = os.getenv(
        "DATABASE_URL",
        (
            "sqlite:///./mental_maze.db"
            if ENVIRONMENT == "development"
            else "postgresql://mental_maze_user:change_this_password@localhost:5432/mental_maze"
        ),
    )

    # Address for users to deposit funds for quiz rewards
    DEPOSIT_ADDRESS = os.getenv("NEAR_WALLET_ADDRESS", "solviumagent.near")

    # Quiz Configuration
    DEFAULT_QUIZ_QUESTIONS = 1
    MAX_QUIZ_QUESTIONS = 5
    QUESTION_TIMER_SECONDS = 60  # Time limit for each question

    # Reward Distribution Strategy
    # "correct_answers_only" - Only participants with at least one correct answer get rewards
    # "all_participants" - All participants get rewards regardless of correctness
    REWARD_DISTRIBUTION_STRATEGY = os.getenv(
        "REWARD_DISTRIBUTION_STRATEGY", "correct_answers_only"
    )

    # Redis Configuration
    REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
    REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
    REDIS_SSL = os.getenv("REDIS_SSL", True)
    # REDIS_DB = int(os.getenv("REDIS_DB", 0))
    REDIS_PASSWORD = os.getenv("REDIS_PASSWORD", None)

    # Production check helper
    @classmethod
    def is_production(cls):
        return ENVIRONMENT == "production"

    @classmethod
    def is_development(cls):
        return ENVIRONMENT == "development"
