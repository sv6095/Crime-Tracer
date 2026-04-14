# app/deps.py
"""
Shared FastAPI dependencies:
- get_current_user: decode JWT and return active user
- get_victim / get_cop / get_admin: role-based guards
- get_current_user_optional: soft auth for endpoints that allow anonymous
"""

from typing import Optional

from fastapi import Depends, HTTPException, status, Header
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
import logging

from .db import get_db
from . import models, security

logger = logging.getLogger("crime_tracer.deps")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token")


def get_db_session():
    return next(get_db())


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> models.User:
    logger.debug("get_current_user called; token_present=%s token_len=%s", bool(token), (len(token) if token else 0))

    payload = security.decode_token(token)
    if not payload:
        logger.info("Token invalid or expired (decode returned None).")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication credentials")

    username = payload.get("sub")
    if not username:
        logger.info("JWT payload missing 'sub' claim: %s", payload)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication credentials")

    user = (
        db.query(models.User)
        .filter(
            (models.User.username == username)
            | (models.User.email == username)
            | (models.User.phone == username)
        )
        .first()
    )

    if not user or not user.is_active:
        logger.info("User not found or inactive for identifier=%s", username)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    logger.debug("Authenticated user id=%s identifier=%s role=%s", user.id, username, user.role.value)
    return user


def get_current_user_optional(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
) -> Optional[models.User]:
    try:
        if not authorization or not authorization.startswith("Bearer "):
            logger.debug("Optional auth: no Bearer header")
            return None
        token = authorization.split(" ", 1)[1]
        payload = security.decode_token(token)
        if not payload:
            logger.debug("Optional auth: token decode failed")
            return None
        username = payload.get("sub")
        if not username:
            logger.debug("Optional auth: decoded payload missing sub")
            return None

        user = (
            db.query(models.User)
            .filter(
                (models.User.username == username)
                | (models.User.email == username)
                | (models.User.phone == username)
            )
            .first()
        )
        if not user or not user.is_active:
            logger.debug("Optional auth: user not found or inactive")
            return None
        return user
    except Exception:
        logger.exception("Unexpected error in get_current_user_optional")
        return None


def require_role(role: models.UserRole):
    def _wrapper(user: models.User = Depends(get_current_user)):
        if user.role != role:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"{role.value.capitalize()} role required")
        return user
    return _wrapper


def get_victim(user: models.User = Depends(get_current_user)) -> models.User:
    if user.role != models.UserRole.VICTIM:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Victim role required")
    return user


def get_cop(user: models.User = Depends(get_current_user)) -> models.User:
    if user.role != models.UserRole.COP:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cop role required")
    if getattr(user, "pending_approval", False):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cop account pending admin approval")
    return user


def get_cop_or_admin(user: models.User = Depends(get_current_user)) -> models.User:
    """Allow COP or ADMIN for investigation/evidence endpoints."""
    if user.role not in (models.UserRole.COP, models.UserRole.ADMIN):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cop or admin role required")
    if user.role == models.UserRole.COP and getattr(user, "pending_approval", False):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cop account pending admin approval")
    return user


def get_admin(user: models.User = Depends(get_current_user)) -> models.User:
    if user.role != models.UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin role required")
    return user
