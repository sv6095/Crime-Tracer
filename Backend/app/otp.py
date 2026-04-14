# app/otp.py
"""
OTP router for phone/email verification.

Endpoints:
- POST /api/otp/send
- POST /api/otp/verify

Used by the File Complaint flow (and can be reused elsewhere).
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .db import get_db
from . import models, schemas
from .deps import get_victim
from .services import otp as otp_service

router = APIRouter()


@router.post("/send", response_model=schemas.StatusMessage)
def send_otp(
    payload: schemas.OtpSendRequest,
    db: Session = Depends(get_db),
    victim: models.User = Depends(get_victim),
):
    """
    Issue an OTP for either phone or email for the current victim.
    This also enforces uniqueness of phone/email across users.
    """
    channel_raw = payload.channel.lower()
    if channel_raw not in ("phone", "email"):
        raise HTTPException(status_code=400, detail="Invalid channel")

    # Normalise target
    target = payload.value.strip()
    if not target:
        raise HTTPException(status_code=400, detail="Target value is required")

    # Enforce uniqueness similar to /victim/register
    if channel_raw == "email":
        existing = (
            db.query(models.User)
            .filter(models.User.email == target, models.User.id != victim.id)
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=400,
                detail="Email already in use by another account",
            )
        channel = models.OtpChannel.EMAIL
    else:
        existing = (
            db.query(models.User)
            .filter(models.User.phone == target, models.User.id != victim.id)
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=400,
                detail="Phone already in use by another account",
            )
        channel = models.OtpChannel.PHONE

    otp_service.issue_otp(db=db, user=victim, channel=channel, target_value=target)

    # In a real deployment, SMS/email sending happens inside issue_otp / infra service
    return schemas.StatusMessage(
        success=True,
        message=f"OTP sent to {channel_raw}. It will expire soon.",
        data=None,
    )


@router.post("/verify", response_model=schemas.OtpStatusOut)
def verify_otp(
    payload: schemas.OtpVerifyRequest,
    db: Session = Depends(get_db),
    victim: models.User = Depends(get_victim),
):
    """
    Verify the OTP for phone/email and mark the user's contact as verified.
    Also updates the stored phone/email to the verified value.
    """
    channel_raw = payload.channel.lower()
    if channel_raw not in ("phone", "email"):
        raise HTTPException(status_code=400, detail="Invalid channel")

    target = payload.value.strip()
    if not target or not payload.code.strip():
        raise HTTPException(status_code=400, detail="Value and code are required")

    channel = (
        models.OtpChannel.EMAIL
        if channel_raw == "email"
        else models.OtpChannel.PHONE
    )

    ok = otp_service.verify_otp(
        db=db,
        user=victim,
        channel=channel,
        target_value=target,
        code=payload.code.strip(),
    )

    if not ok:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OTP",
        )

    # Mark as verified + update stored value
    if channel == models.OtpChannel.EMAIL:
        victim.email = target
        victim.email_verified = True
    else:
        victim.phone = target
        victim.phone_verified = True

    db.commit()
    db.refresh(victim)

    return schemas.OtpStatusOut(channel=channel_raw, verified=True)
