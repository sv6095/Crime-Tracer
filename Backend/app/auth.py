# app/auth.py
"""
Auth router + JWT helpers for Crime Tracer Mangalore.

Exposes:
- POST /api/auth/victim/register
- POST /api/auth/cop/register
- POST /api/auth/token        -> JWT login
- GET  /api/auth/me           -> current user

Token payload:
- sub: login identifier (username OR email OR phone)
- role: user.role.value
"""

from datetime import datetime, timedelta
from typing import Optional, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from jose import jwt, JWTError
from passlib.context import CryptContext
import logging

from .db import get_db
from . import models, security
from .config import settings
from .schemas import (
    UserCreateVictim,
    UserCreateCop,
    UserOut,
    Token,
    TokenRefresh,
)
from .deps import get_current_user
from .services.audit import log_action
from .services.account_lockout import (
    check_account_lockout,
    record_failed_login,
    reset_failed_attempts,
    get_remaining_attempts
)
from .utils.rate_limiter import rate_limit_login, rate_limit_auth
from .utils.metrics import auth_attempts_total, auth_tokens_issued_total
from .utils.password_validator import validate_password_strength
from .utils.exceptions import (
    AuthenticationError,
    AccountLockedError,
    ValidationError
)

router = APIRouter(tags=["auth"])
logger = logging.getLogger("crime_tracer.auth")


# ---------- Victim Register ----------

@router.post("/victim/register", response_model=UserOut)
@rate_limit_auth()
def register_victim(
    payload: UserCreateVictim,
    request: Request = None,
    db: Session = Depends(get_db),
):
    if payload.email:
        existing = db.query(models.User).filter(models.User.email == payload.email).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")

    if payload.phone:
        existing = db.query(models.User).filter(models.User.phone == payload.phone).first()
        if existing:
            raise HTTPException(status_code=400, detail="Phone already registered")

    if payload.station_id is not None:
        station = db.query(models.Station).filter(models.Station.id == payload.station_id).first()
        if not station:
            raise HTTPException(status_code=404, detail="Station not found")

    user = models.User(
        name=payload.name,
        email=payload.email,
        phone=payload.phone,
        address=payload.address,
        station_id=payload.station_id,
        role=models.UserRole.VICTIM,
        password_hash=security.get_password_hash(payload.password),
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    log_action(
        db=db,
        user=user,
        action="victim_registered",
        entity_type="User",
        entity_id=user.id,
        meta={
            "role": user.role.value,
            "email": user.email,
            "phone": user.phone,
            "station_id": user.station_id,
        },
    )

    return user


# ---------- Cop Register (requires admin approval) ----------

@router.post("/cop/register", response_model=UserOut)
@rate_limit_auth()
def register_cop(
    payload: UserCreateCop,
    request: Request = None,
    db: Session = Depends(get_db),
):
    # Validate password strength
    is_valid, errors = validate_password_strength(payload.password)
    if not is_valid:
        raise ValidationError(
            detail="Password does not meet strength requirements",
            metadata={"password_errors": errors}
        )
    
    existing = db.query(models.User).filter(models.User.username == payload.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already taken")

    station = db.query(models.Station).filter(models.Station.id == payload.station_id).first()
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")

    user = models.User(
        name=payload.name,
        username=payload.username,
        station_id=payload.station_id,
        phone=payload.phone,
        badge_number=payload.badge_number,
        role=models.UserRole.COP,
        password_hash=security.get_password_hash(payload.password),
        is_active=True,
        pending_approval=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    log_action(
        db=db,
        user=user,
        action="cop_registered_pending_approval",
        entity_type="User",
        entity_id=user.id,
        meta={
            "role": user.role.value,
            "username": user.username,
            "station_id": user.station_id,
        },
    )

    return user


# ---------- Login -> Token ----------

@router.post("/token", response_model=Token)
@rate_limit_login()
def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    request: Request = None,
    db: Session = Depends(get_db),
):
    identifier = form_data.username
    password = form_data.password
    
    # Get client IP for security tracking
    client_ip = "unknown"
    try:
        if request and hasattr(request, "client") and request.client:
            client_ip = request.client.host
    except Exception:
        pass

    user = (
        db.query(models.User)
        .filter(
            (models.User.username == identifier)
            | (models.User.email == identifier)
            | (models.User.phone == identifier)
        )
        .first()
    )
    
    # Handle user not found
    if not user:
        auth_attempts_total.labels(result="failed", role="unknown").inc()
        log_action(
            db=db,
            user=None,
            action="login_failed",
            entity_type="User",
            entity_id=None,
            meta={
                "identifier": identifier,
                "reason": "user_not_found",
                "client_ip": client_ip
            }
        )
        raise AuthenticationError(
            detail="Invalid credentials",
            metadata={"identifier": identifier}
        )
    
    # Check account lockout
    is_locked, unlock_time = check_account_lockout(user)
    if is_locked:
        auth_attempts_total.labels(result="blocked", role=user.role.value).inc()
        log_action(
            db=db,
            user=user,
            action="login_blocked_account_locked",
            entity_type="User",
            entity_id=user.id,
            meta={
                "identifier": identifier,
                "unlock_time": unlock_time,
                "failed_attempts": user.failed_login_attempts,
                "client_ip": client_ip
            }
        )
        raise AccountLockedError(locked_until=unlock_time)
    
    # Verify password
    if not security.verify_password(password, user.password_hash):
        # Record failed attempt
        is_now_locked = record_failed_login(db, user)
        remaining = get_remaining_attempts(user)
        
        auth_attempts_total.labels(result="failed", role=user.role.value).inc()
        log_action(
            db=db,
            user=user,
            action="login_failed",
            entity_type="User",
            entity_id=user.id,
            meta={
                "identifier": identifier,
                "reason": "invalid_password",
                "failed_attempts": user.failed_login_attempts,
                "remaining_attempts": remaining,
                "account_locked": is_now_locked,
                "client_ip": client_ip
            }
        )
        
        if is_now_locked:
            raise AccountLockedError(
                locked_until=user.locked_until.isoformat() if user.locked_until else None
            )
        
        raise AuthenticationError(
            detail=f"Invalid credentials. {remaining} attempt(s) remaining before account lockout.",
            metadata={"remaining_attempts": remaining}
        )

    # Check if user is active
    if not user.is_active:
        auth_attempts_total.labels(result="blocked", role=user.role.value).inc()
        log_action(
            db=db,
            user=user,
            action="login_blocked_inactive",
            entity_type="User",
            entity_id=user.id,
            meta={"identifier": identifier, "client_ip": client_ip}
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive"
        )

    # Check cop approval status
    if user.role == models.UserRole.COP and user.pending_approval:
        auth_attempts_total.labels(result="blocked", role=user.role.value).inc()
        log_action(
            db=db,
            user=user,
            action="login_blocked_pending_approval",
            entity_type="User",
            entity_id=user.id,
            meta={
                "identifier": identifier,
                "role": user.role.value,
                "station_id": user.station_id,
                "client_ip": client_ip
            }
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cop account pending admin approval"
        )

    # Successful login - reset failed attempts
    reset_failed_attempts(db, user)
    
    # Create access token (short-lived, 15 minutes)
    access_token = security.create_access_token(
        data={"sub": identifier, "role": user.role.value},
        expires_delta=timedelta(minutes=15)
    )
    
    # Create refresh token (long-lived, 7 days)
    refresh_token = security.create_refresh_token(
        data={"sub": identifier, "role": user.role.value}
    )
    
    # Store refresh token in database
    refresh_token_expires = datetime.utcnow() + timedelta(days=7)
    db_refresh_token = models.RefreshToken(
        user_id=user.id,
        token=refresh_token,
        expires_at=refresh_token_expires,
        user_agent=request.headers.get("user-agent", "") if request else None,
        ip_address=client_ip
    )
    db.add(db_refresh_token)
    db.commit()
    
    # Track successful authentication
    auth_attempts_total.labels(result="success", role=user.role.value).inc()
    auth_tokens_issued_total.labels(role=user.role.value).inc()

    log_action(
        db=db,
        user=user,
        action="login_success",
        entity_type="User",
        entity_id=user.id,
        meta={
            "identifier": identifier,
            "role": user.role.value,
            "station_id": user.station_id,
            "client_ip": client_ip
        }
    )

    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=900  # 15 minutes in seconds
    )


# ---------- Refresh Token ----------

@router.post("/refresh", response_model=Token)
@rate_limit_auth()
def refresh_access_token(
    token_data: TokenRefresh,
    request: Request = None,
    db: Session = Depends(get_db),
):
    """
    Refresh an access token using a valid refresh token.
    """
    refresh_token = token_data.refresh_token
    
    # Verify refresh token
    payload = security.verify_refresh_token(refresh_token)
    if not payload:
        raise AuthenticationError(
            detail="Invalid or expired refresh token",
            metadata={"error": "invalid_refresh_token"}
        )
    
    identifier = payload.get("sub")
    if not identifier:
        raise AuthenticationError(
            detail="Invalid token payload",
            metadata={"error": "invalid_token_payload"}
        )
    
    # Check if refresh token exists in database and is not revoked
    db_refresh_token = (
        db.query(models.RefreshToken)
        .filter(
            models.RefreshToken.token == refresh_token,
            models.RefreshToken.revoked == False,
            models.RefreshToken.expires_at > datetime.utcnow()
        )
        .first()
    )
    
    if not db_refresh_token:
        raise AuthenticationError(
            detail="Refresh token not found or revoked",
            metadata={"error": "token_revoked_or_expired"}
        )
    
    # Get user
    user = (
        db.query(models.User)
        .filter(
            (models.User.username == identifier)
            | (models.User.email == identifier)
            | (models.User.phone == identifier)
        )
        .first()
    )
    
    if not user or not user.is_active:
        raise AuthenticationError(
            detail="User not found or inactive",
            metadata={"error": "user_inactive"}
        )
    
    # Revoke old refresh token (token rotation)
    db_refresh_token.revoked = True
    db_refresh_token.revoked_at = datetime.utcnow()
    
    # Create new access token
    new_access_token = security.create_access_token(
        data={"sub": identifier, "role": user.role.value},
        expires_delta=timedelta(minutes=15)
    )
    
    # Create new refresh token
    new_refresh_token = security.create_refresh_token(
        data={"sub": identifier, "role": user.role.value}
    )
    
    # Store new refresh token
    client_ip = "unknown"
    try:
        if request and hasattr(request, "client") and request.client:
            client_ip = request.client.host
    except Exception:
        pass
    
    new_db_refresh_token = models.RefreshToken(
        user_id=user.id,
        token=new_refresh_token,
        expires_at=datetime.utcnow() + timedelta(days=7),
        user_agent=request.headers.get("user-agent", "") if request else None,
        ip_address=client_ip
    )
    db.add(new_db_refresh_token)
    db.commit()
    
    # Log token refresh
    log_action(
        db=db,
        user=user,
        action="token_refreshed",
        entity_type="User",
        entity_id=user.id,
        meta={
            "client_ip": client_ip
        }
    )
    
    return Token(
        access_token=new_access_token,
        refresh_token=new_refresh_token,
        token_type="bearer",
        expires_in=900
    )


# ---------- Logout (Revoke Refresh Token) ----------

@router.post("/logout")
@rate_limit_auth()
def logout(
    token_data: TokenRefresh,
    request: Request = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Logout by revoking the refresh token.
    """
    refresh_token = token_data.refresh_token
    
    # Revoke refresh token
    db_refresh_token = (
        db.query(models.RefreshToken)
        .filter(
            models.RefreshToken.token == refresh_token,
            models.RefreshToken.user_id == current_user.id,
            models.RefreshToken.revoked == False
        )
        .first()
    )
    
    if db_refresh_token:
        db_refresh_token.revoked = True
        db_refresh_token.revoked_at = datetime.utcnow()
        db.commit()
        
        log_action(
            db=db,
            user=current_user,
            action="logout",
            entity_type="User",
            entity_id=current_user.id
        )
    
    return {"message": "Successfully logged out"}


# ---------- Current User ----------

@router.get("/me", response_model=UserOut)
def get_me(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Eagerly load station relationship to get station name
    from sqlalchemy.orm import joinedload
    user_with_station = db.query(models.User).options(joinedload(models.User.station)).filter(models.User.id == current_user.id).first()
    
    # Build response with station name
    response_data = {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "phone": current_user.phone,
        "address": current_user.address,
        "role": current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role),
        "station_id": current_user.station_id,
        "station_name": user_with_station.station.name if user_with_station and user_with_station.station else None,
        "badge_number": current_user.badge_number,
        "email_verified": getattr(current_user, "email_verified", False),
        "phone_verified": getattr(current_user, "phone_verified", False),
    }
    return UserOut(**response_data)
