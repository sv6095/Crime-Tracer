# app/logging_config.py
import logging
import sys
import os
import json
from datetime import datetime
from typing import Any, Dict

class JSONFormatter(logging.Formatter):
    """JSON formatter for structured logging."""
    
    def format(self, record: logging.LogRecord) -> str:
        log_data: Dict[str, Any] = {
            "timestamp": datetime.utcnow().isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }
        
        # Add exception info if present
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)
        
        # Add extra fields
        if hasattr(record, "user_id"):
            log_data["user_id"] = record.user_id
        if hasattr(record, "request_id"):
            log_data["request_id"] = record.request_id
        if hasattr(record, "endpoint"):
            log_data["endpoint"] = record.endpoint
        
        return json.dumps(log_data)


def setup_logging(use_json: bool = False):
    """
    Setup logging configuration.
    
    Args:
        use_json: If True, use JSON format for structured logging (production).
                  If False, use human-readable format (development).
    """
    level = os.getenv("CRIME_TRACER_LOG_LEVEL", "INFO").upper()
    numeric = getattr(logging, level, logging.INFO)
    
    # Check if JSON logging is requested
    use_json = use_json or os.getenv("CRIME_TRACER_JSON_LOGS", "false").lower() == "true"
    
    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(numeric)
    
    # Remove existing handlers
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)
    
    # Create console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(numeric)
    
    if use_json:
        formatter = JSONFormatter()
    else:
        fmt = "%(asctime)s | %(levelname)s | %(name)s | %(message)s"
        formatter = logging.Formatter(fmt)
    
    console_handler.setFormatter(formatter)
    root_logger.addHandler(console_handler)
    
    # Set levels for noisy loggers
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("urllib3").setLevel(logging.WARNING)
    logging.getLogger("boto3").setLevel(logging.WARNING)
    logging.getLogger("botocore").setLevel(logging.WARNING)
    
    return root_logger
