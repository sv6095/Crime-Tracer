# app/services/account_lockout.py
"""
Account lockout service for tracking and managing failed login attempts.

Implements:
- Failed login attempt tracking
- Account lockout after 5 failed attempts
- 15-minute lockout period
- Automatic unlock after lockout expires
"""

from datetime import datetime, timedelta
from typing import Optional
from sqlalchemy.orm import Session
import logging

from .. import models

logger = logging.getLogger("crime_tracer.account_lockout")

# Configuration
MAX_FAILED_ATTEMPTS = 5
LOCKOUT_DURATION_MINUTES = 15


def check_account_lockout(user: models.User) -> tuple[bool, Optional[str]]:
    """
    Check if account is currently locked.
    
    Returns:
        (is_locked, unlock_time_iso) - unlock_time_iso is None if not locked
    """
    if not user.locked_until:
        return False, None
    
    if datetime.utcnow() < user.locked_until:
        return True, user.locked_until.isoformat()
    
    # Lockout expired, reset
    user.locked_until = None
    user.failed_login_attempts = 0
    return False, None


def record_failed_login(db: Session, user: models.User) -> bool:
    """
    Record a failed login attempt and lock account if threshold reached.
    
    Returns:
        True if account is now locked, False otherwise
    """
    user.failed_login_attempts += 1
    user.last_failed_login = datetime.utcnow()
    
    if user.failed_login_attempts >= MAX_FAILED_ATTEMPTS:
        lockout_until = datetime.utcnow() + timedelta(minutes=LOCKOUT_DURATION_MINUTES)
        user.locked_until = lockout_until
        logger.warning(
            f"Account locked for user_id={user.id} identifier={user.email or user.username or user.phone} "
            f"until {lockout_until.isoformat()}"
        )
        db.commit()
        return True
    
    db.commit()
    return False


def reset_failed_attempts(db: Session, user: models.User):
    """Reset failed login attempts on successful login."""
    if user.failed_login_attempts > 0 or user.locked_until:
        user.failed_login_attempts = 0
        user.locked_until = None
        db.commit()
        logger.info(f"Reset failed login attempts for user_id={user.id}")


def get_remaining_attempts(user: models.User) -> int:
    """Get remaining login attempts before lockout."""
    return max(0, MAX_FAILED_ATTEMPTS - user.failed_login_attempts)
