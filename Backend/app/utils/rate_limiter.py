# app/utils/rate_limiter.py
"""
Rate limiting utilities for Crime Tracer API.

Uses slowapi for FastAPI-compatible rate limiting with Redis backend (optional).
Falls back to in-memory storage if Redis is not available.
"""

from typing import Optional
from fastapi import Request
import logging

logger = logging.getLogger("crime_tracer.rate_limiter")

try:
    from slowapi import Limiter, _rate_limit_exceeded_handler
    from slowapi.util import get_remote_address
    from slowapi.errors import RateLimitExceeded
    import redis
    
    # Try to connect to Redis, fallback to in-memory if unavailable
    try:
        redis_client = redis.Redis(
            host='localhost',
            port=6379,
            db=0,
            decode_responses=True
        )
        redis_client.ping()
        storage_uri = "redis://localhost:6379"
        logger.info("Rate limiter using Redis backend")
    except Exception:
        storage_uri = "memory://"
        redis_client = None
        logger.warning("Redis not available, using in-memory rate limiting")
    
    limiter = Limiter(
        key_func=get_remote_address,
        storage_uri=storage_uri,
        default_limits=["1000/hour", "100/minute"]
    )
    
    RATE_LIMITING_AVAILABLE = True
    
except ImportError:
    logger.warning("slowapi not installed, rate limiting disabled")
    limiter = None
    RATE_LIMITING_AVAILABLE = False


def get_rate_limiter():
    """Get the rate limiter instance."""
    return limiter if RATE_LIMITING_AVAILABLE else None


def get_client_identifier(request: Request) -> str:
    """
    Get client identifier for rate limiting.
    Uses IP address, or user ID if authenticated.
    """
    if RATE_LIMITING_AVAILABLE:
        # Try to get user ID from request state (set by auth middleware)
        user_id = getattr(request.state, "user_id", None)
        if user_id:
            return f"user:{user_id}"
        return get_remote_address(request)
    return "default"


# Rate limit decorators for common endpoints
# Note: slowapi requires functions to have a 'request' parameter
# Use Depends(Request) in your route handlers when using these decorators

def rate_limit_login():
    """Rate limit for login endpoints: 5 requests per minute per IP."""
    if not RATE_LIMITING_AVAILABLE:
        return lambda func: func
    
    def decorator(func):
        return limiter.limit("5/minute", key_func=get_remote_address)(func)
    return decorator


def rate_limit_auth():
    """Rate limit for auth endpoints: 10 requests per minute per IP."""
    if not RATE_LIMITING_AVAILABLE:
        return lambda func: func
    
    def decorator(func):
        return limiter.limit("10/minute", key_func=get_remote_address)(func)
    return decorator


def rate_limit_upload():
    """Rate limit for file uploads: 20 requests per minute per user."""
    if not RATE_LIMITING_AVAILABLE:
        return lambda func: func
    
    def decorator(func):
        return limiter.limit("20/minute", key_func=get_client_identifier)(func)
    return decorator


def rate_limit_api():
    """Rate limit for general API endpoints: 60 requests per minute per IP."""
    if not RATE_LIMITING_AVAILABLE:
        return lambda func: func
    
    def decorator(func):
        return limiter.limit("60/minute", key_func=get_remote_address)(func)
    return decorator
