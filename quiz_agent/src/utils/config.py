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

    # FastAPI Configuration
    FASTAPI_HOST = os.getenv("FASTAPI_HOST", "0.0.0.0")
    FASTAPI_PORT = int(os.getenv("FASTAPI_PORT", "8000"))
    FASTAPI_RELOAD = os.getenv("FASTAPI_RELOAD", "false").lower() == "true"
    FASTAPI_WORKERS = int(os.getenv("FASTAPI_WORKERS", "1"))

    # Use FastAPI for webhooks (default: True in production, False in development)
    USE_FASTAPI_WEBHOOK = (
        os.getenv(
            "USE_FASTAPI_WEBHOOK", "true" if ENVIRONMENT == "production" else "false"
        ).lower()
        == "true"
    )
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
    # Remote Redis (production)
    REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
    REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
    REDIS_SSL = (
        os.getenv("REDIS_SSL", "false").lower() == "true"
    )  # Default to False for local development
    # REDIS_DB = int(os.getenv("REDIS_DB", 0))
    REDIS_PASSWORD = os.getenv("REDIS_PASSWORD", None)

    # Local Redis (development)
    REDIS_HOST_LOCAL = os.getenv("REDIS_HOST_LOCAL", "localhost")
    REDIS_PORT_LOCAL = int(os.getenv("REDIS_PORT_LOCAL", 6379))
    REDIS_SSL_LOCAL = os.getenv("REDIS_SSL_LOCAL", "false").lower() == "true"
    REDIS_PASSWORD_LOCAL = os.getenv("REDIS_PASSWORD_LOCAL", None)

    BOT_USERNAME = os.getenv("BOT_USERNAME", "")  # Add this

    # Production check helper
    @classmethod
    def is_production(cls):
        return ENVIRONMENT == "production"

    @classmethod
    def is_development(cls):
        return ENVIRONMENT == "development"

    # NEAR Wallet Configuration
    NEAR_TESTNET_RPC_URL = os.getenv(
        "NEAR_TESTNET_RPC_URL", "https://test.rpc.fastnear.com"
    )
    NEAR_TESTNET_HELPER_URL = os.getenv(
        "NEAR_TESTNET_HELPER_URL", "https://rpc.web4.testnet.page/account/testnet"
    )
    NEAR_MAINNET_RPC_URL = os.getenv(
        "NEAR_MAINNET_RPC_URL", "https://rpc.web4.near.page	"
    )
    NEAR_MAINNET_HELPER_URL = os.getenv(
        "NEAR_MAINNET_HELPER_URL", "https://free.rpc.fastnear.com"
    )

    # Wallet Security Configuration
    WALLET_ENCRYPTION_KEY = os.getenv("WALLET_ENCRYPTION_KEY")
    WALLET_KEY_DERIVATION_ITERATIONS = int(
        os.getenv("WALLET_KEY_DERIVATION_ITERATIONS", "100000")
    )

    # Account Creation Configuration
    DEFAULT_ACCOUNT_SUFFIX_LENGTH = int(os.getenv("DEFAULT_ACCOUNT_SUFFIX_LENGTH", "8"))
    ACCOUNT_CREATION_TIMEOUT = int(os.getenv("ACCOUNT_CREATION_TIMEOUT", "30"))
    BALANCE_CHECK_TIMEOUT = int(os.getenv("BALANCE_CHECK_TIMEOUT", "10"))

    # RPC Retry Configuration
    RPC_MAX_RETRIES = int(os.getenv("RPC_MAX_RETRIES", "3"))
    RPC_RETRY_DELAY = float(
        os.getenv("RPC_RETRY_DELAY", "1.0")
    )  # Initial delay in seconds
    RPC_MAX_RETRY_DELAY = float(
        os.getenv("RPC_MAX_RETRY_DELAY", "10.0")
    )  # Max delay in seconds
    RPC_BACKOFF_MULTIPLIER = float(os.getenv("RPC_BACKOFF_MULTIPLIER", "2.0"))

    # Circuit Breaker Configuration
    CIRCUIT_BREAKER_FAILURE_THRESHOLD = int(
        os.getenv("CIRCUIT_BREAKER_FAILURE_THRESHOLD", "5")
    )
    CIRCUIT_BREAKER_RECOVERY_TIMEOUT = int(
        os.getenv("CIRCUIT_BREAKER_RECOVERY_TIMEOUT", "60")
    )  # seconds

    # Account Verification Configuration
    ACCOUNT_VERIFICATION_TIMEOUT = int(os.getenv("ACCOUNT_VERIFICATION_TIMEOUT", "15"))
    ACCOUNT_VERIFICATION_RETRIES = int(os.getenv("ACCOUNT_VERIFICATION_RETRIES", "2"))

    # Wallet Creation Queue Configuration
    WALLET_CREATION_QUEUE_ENABLED = (
        os.getenv("WALLET_CREATION_QUEUE_ENABLED", "true").lower() == "true"
    )
    WALLET_CREATION_RETRY_DELAY = int(
        os.getenv("WALLET_CREATION_RETRY_DELAY", "300")
    )  # 5 minutes
    WALLET_CREATION_MAX_RETRIES = int(os.getenv("WALLET_CREATION_MAX_RETRIES", "3"))

    # NEAR Account Creation Settings
    # Minimum balance required for account creation (in NEAR)
    # This covers storage costs and allows the account to exist
    MINIMAL_ACCOUNT_BALANCE = float(os.getenv("MINIMAL_ACCOUNT_BALANCE", "0.00182"))

    # Security Settings
    MIN_PRIVATE_KEY_LENGTH = 64
    MAX_ACCOUNT_ID_LENGTH = 64
    ALLOWED_ACCOUNT_CHARS = set("abcdefghijklmnopqrstuvwxyz0123456789._-")

    @classmethod
    def validate_wallet_config(cls) -> bool:
        """Validate that all required wallet configuration is present"""
        if not cls.WALLET_ENCRYPTION_KEY:
            print(
                "⚠️  WARNING: WALLET_ENCRYPTION_KEY not set. Using generated key (not persistent across restarts)."
            )
            return False
        return True

    @classmethod
    def get_wallet_encryption_key(cls) -> bytes:
        """Get the wallet encryption key, generating one if not set"""
        if cls.WALLET_ENCRYPTION_KEY:
            # Ensure we get exactly 32 bytes by hashing the key
            import hashlib

            key_bytes = cls.WALLET_ENCRYPTION_KEY.encode()
            return hashlib.sha256(key_bytes).digest()  # Always returns 32 bytes
        else:
            # Generate a temporary key (not persistent)
            import secrets

            return secrets.token_bytes(32)

    @classmethod
    def is_testnet_enabled(cls) -> bool:
        """Check if testnet is enabled"""
        return os.getenv("ENABLE_NEAR_TESTNET", "true").lower() == "true"

    @classmethod
    def is_mainnet_enabled(cls) -> bool:
        """Check if mainnet is enabled"""
        return os.getenv("ENABLE_NEAR_MAINNET", "false").lower() == "true"
