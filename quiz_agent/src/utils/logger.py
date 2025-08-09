"""
Enhanced logging configuration for SolviumAI Quiz Bot with performance monitoring.
"""

import logging
import sys
from typing import Optional
from datetime import datetime


def setup_logger(
    name: str, level: int = logging.INFO, format_string: Optional[str] = None
) -> logging.Logger:
    """
    Set up a logger with enhanced formatting and performance-friendly configuration.

    Args:
        name: Logger name (usually __name__)
        level: Logging level (default: INFO)
        format_string: Custom format string (optional)

    Returns:
        Configured logger instance
    """
    # Default format with emojis for better visibility
    if format_string is None:
        format_string = "%(asctime)s | %(name)s | %(levelname)s | %(message)s"

    # Create logger
    logger = logging.getLogger(name)

    # Avoid duplicate handlers if logger already exists
    if logger.handlers:
        return logger

    logger.setLevel(level)

    # Create console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(level)

    # Create formatter
    formatter = logging.Formatter(fmt=format_string, datefmt="%Y-%m-%d %H:%M:%S")
    console_handler.setFormatter(formatter)

    # Add handler to logger
    logger.addHandler(console_handler)

    # Prevent propagation to avoid duplicate logs
    logger.propagate = False

    return logger


def setup_performance_logger() -> logging.Logger:
    """
    Set up a specialized logger for performance metrics.

    Returns:
        Performance logger instance
    """
    return setup_logger(
        "performance",
        level=logging.INFO,
        format_string="🚀 %(asctime)s | PERF | %(message)s",
    )


def setup_error_logger() -> logging.Logger:
    """
    Set up a specialized logger for errors and exceptions.

    Returns:
        Error logger instance
    """
    return setup_logger(
        "errors",
        level=logging.ERROR,
        format_string="❌ %(asctime)s | ERROR | %(name)s | %(message)s",
    )


def setup_cache_logger() -> logging.Logger:
    """
    Set up a specialized logger for cache operations.

    Returns:
        Cache logger instance
    """
    return setup_logger(
        "cache",
        level=logging.INFO,
        format_string="💾 %(asctime)s | CACHE | %(message)s",
    )


# Configure root logger with basic settings
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(name)s | %(levelname)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
