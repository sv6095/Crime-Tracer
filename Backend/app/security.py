# app/security.py
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from jose import jwt, JWTError
from passlib.context import CryptContext
import logging

from .config import settings

logger = logging.getLogger("crime_tracer.security")

pwd_context = CryptContext(
    schemes=["pbkdf2_sha256"],
    deprecated="auto",
)

ALGORITHM = "HS256"

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(
    data: Dict[str, Any],
    expires_delta: Optional[timedelta] = None,
) -> str:
    to_encode = data.copy()
    now = datetime.utcnow()
    expire = now + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    # store ISO timestamps for easier debugging/inspection
    to_encode.update({"exp": expire, "iat": now, "type": "access"})
    try:
        encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)
        logger.debug("Created JWT sub=%s exp=%s", to_encode.get("sub"), expire.isoformat())
        return encoded_jwt
    except Exception:
        logger.exception("Failed to create JWT")
        raise


def create_refresh_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a refresh token with longer expiration (default 7 days).
    """
    to_encode = data.copy()
    now = datetime.utcnow()
    expire = now + (
        expires_delta or timedelta(days=7)  # Default 7 days for refresh tokens
    )
    to_encode.update({"exp": expire, "iat": now, "type": "refresh"})
    try:
        encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)
        logger.debug("Created refresh token sub=%s exp=%s", to_encode.get("sub"), expire.isoformat())
        return encoded_jwt
    except Exception:
        logger.exception("Failed to create refresh token")
        raise


def verify_refresh_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Verify and decode a refresh token.
    Returns None if invalid or not a refresh token.
    """
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        # Verify it's a refresh token
        if payload.get("type") != "refresh":
            logger.warning("Token is not a refresh token")
            return None
        return payload
    except JWTError as e:
        logger.info("Refresh token decode error: %s", str(e))
        return None
    except Exception:
        logger.exception("Unexpected error while decoding refresh token")
        return None

def decode_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Decode a JWT and return payload, or None if invalid/expired.
    Logs the specific JWTError message for diagnostics.
    """
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        logger.debug("Decoded JWT for sub=%s", payload.get("sub"))
        return payload
    except JWTError as e:
        logger.info("JWT decode error: %s", str(e))
        return None
    except Exception:
        logger.exception("Unexpected error while decoding JWT")
        return None
