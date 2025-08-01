from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import OperationalError, DBAPIError
from utils.config import Config
from models.user import Base as UserBase
from models.quiz import Base as QuizBase
import logging
import os
import time
from contextlib import contextmanager
from typing import Generator

logger = logging.getLogger(__name__)

# Maximum number of retries for database operations
MAX_RETRIES = 3
RETRY_DELAY = 1  # seconds


def create_db_engine():
    """Create database engine with proper error handling and configuration."""
    try:
        database_url = Config.DATABASE_URL

        # Fix the postgres dialect issue - replace 'postgres:' with 'postgresql:'
        if database_url and database_url.startswith("postgres:"):
            database_url = database_url.replace("postgres:", "postgresql:", 1)
            logger.info("Modified database URL from postgres: to postgresql: format")

        # For better debugging
        if database_url and (
            "postgresql" in database_url or "postgres" in database_url
        ):
            logger.info("Using PostgreSQL database")
            try:
                import psycopg2

                logger.info("PostgreSQL driver (psycopg2) found")
            except ImportError:
                logger.error("PostgreSQL driver not found. Falling back to SQLite.")
                database_url = "sqlite:///./mental_maze.db"

            # Additional logging for remote connections
            if "@" in database_url:
                host_part = database_url.split("@")[1].split("/")[0]
                logger.info(f"Connecting to remote PostgreSQL database at {host_part}")
        else:
            logger.info("Using SQLite database")

        logger.info("Attempting database connection...")

        # PERFORMANCE OPTIMIZATION: Enhanced connection pool settings for PostgreSQL
        engine_args = {}
        if "postgresql" in database_url:
            engine_args.update(
                {
                    "pool_size": 10,  # Increased from 5 for better concurrency
                    "max_overflow": 20,  # Increased from 10 for handling spikes
                    "pool_timeout": 30,
                    "pool_recycle": 1800,  # Recycle connections after 30 minutes
                    "pool_pre_ping": True,  # Enable connection health checks
                    "pool_reset_on_return": "commit",  # Reset connections on return
                    "isolation_level": "READ_COMMITTED",  # Optimize for concurrent reads
                }
            )
        else:
            # SQLite optimizations for development
            engine_args.update(
                {
                    "pool_size": 5,
                    "max_overflow": 0,  # SQLite doesn't benefit from overflow
                    "pool_timeout": 10,
                    "pool_pre_ping": True,
                }
            )

        engine = create_engine(
            database_url,
            connect_args=(
                {"check_same_thread": False}
                if database_url.startswith("sqlite")
                else {}
            ),
            **engine_args,
        )

        # Add event listener for connection pool checkout
        @event.listens_for(engine, "connect")
        def connect(dbapi_connection, connection_record):
            logger.debug("New database connection established")

        @event.listens_for(engine, "checkout")
        def checkout(dbapi_connection, connection_record, connection_proxy):
            logger.debug("Database connection checked out from pool")

        logger.info("Database engine created successfully")
        return engine

    except Exception as e:
        logger.error(f"Failed to create database engine: {e}")
        logger.error("Falling back to SQLite database")

        sqlite_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
            "mental_maze.db",
        )
        fallback_url = f"sqlite:///{sqlite_path}"
        logger.info(f"Using fallback database URL: {fallback_url}")

        return create_engine(fallback_url, connect_args={"check_same_thread": False})


# Create the engine
engine = create_db_engine()

# Create session factory with retry mechanism
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@contextmanager
def get_db() -> Generator:
    """
    Get a database session with automatic retry on connection errors.
    Use as a context manager:
    with get_db() as session:
        session.query(...)
    """
    retry_count = 0
    while True:
        try:
            db = SessionLocal()
            try:
                yield db
                break
            finally:
                db.close()
        except (OperationalError, DBAPIError) as e:
            if retry_count >= MAX_RETRIES:
                logger.error(
                    f"Max retries ({MAX_RETRIES}) reached. Database error: {e}"
                )
                raise
            retry_count += 1
            logger.warning(f"Database error, attempt {retry_count}/{MAX_RETRIES}: {e}")
            time.sleep(RETRY_DELAY)
        except Exception as e:
            logger.error(f"Unexpected database error: {e}")
            raise


def init_db():
    """Create database tables."""
    # Drop existing tables to sync new schema (dev only)
    # This is potentially dangerous in production, so add a safety check
    if not Config.is_production():
        logger.info("Development environment detected. Recreating database tables...")
        UserBase.metadata.drop_all(bind=engine)
        QuizBase.metadata.drop_all(bind=engine)
        # Create fresh tables
        UserBase.metadata.create_all(bind=engine)
        QuizBase.metadata.create_all(bind=engine)
    else:
        logger.info(
            "Production environment detected. Creating tables if they don't exist..."
        )
        # Only create tables that don't exist
        UserBase.metadata.create_all(bind=engine)
        QuizBase.metadata.create_all(bind=engine)


def migrate_schema():
    """Handle schema migrations for existing database structures."""
    try:
        # For BigInteger migration, we need to recreate the table
        # This is destructive, so we'll log it clearly
        logger.warning(
            "Migrating database schema - this may involve dropping and recreating tables"
        )

        # We specifically need to update the quizzes table for the BigInteger change
        QuizBase.metadata.drop_all(
            bind=engine, tables=[QuizBase.metadata.tables["quizzes"]]
        )
        QuizBase.metadata.create_all(
            bind=engine, tables=[QuizBase.metadata.tables["quizzes"]]
        )

        logger.info("Schema migration completed successfully")
        return True
    except Exception as e:
        logger.error(f"Schema migration failed: {e}")
        return False
