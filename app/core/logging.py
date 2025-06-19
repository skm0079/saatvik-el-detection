from loguru import logger
import sys
from app.core.config import settings

def setup_logging():
    """Configure loguru logging"""
    
    # Remove default logger
    logger.remove()
    
    # Console logging
    logger.add(
        sys.stdout,
        level=settings.log_level,
        format="{time:YYYY-MM-DD HH:mm:ss} | {level} | {name}:{function}:{line} | {message}",
        colorize=True
    )
    
    # File logging
    logger.add(
        settings.log_file,
        level=settings.log_level,
        format="{time:YYYY-MM-DD HH:mm:ss} | {level} | {name}:{function}:{line} | {message}",
        rotation="1 day",
        retention="7 days",
        compression="zip"
    )
    
    logger.info("Logging configured")