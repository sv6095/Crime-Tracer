# app/services/otp.py
import logging
import random
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from .. import models
from . import audit

logger = logging.getLogger("crime_tracer.otp")


def _generate_numeric_otp(length: int = 6) -> str:
    return "".join(random.choice("0123456789") for _ in range(length))


def issue_otp(
    db: Session,
    user: models.User,
    channel: models.OtpChannel,
    target_value: str,
    expiry_minutes: int = 10,
) -> models.OtpCode:
    (
        db.query(models.OtpCode)
        .filter(
            models.OtpCode.user_id == user.id,
            models.OtpCode.channel == channel,
            models.OtpCode.target_value == target_value,
            models.OtpCode.used.is_(False),
        )
        .update({"used": True})
    )

    code = _generate_numeric_otp()
    now = datetime.utcnow()
    expires_at = now + timedelta(minutes=expiry_minutes)

    otp = models.OtpCode(
        user_id=user.id,
        channel=channel,
        target_value=target_value,
        code=code,
        created_at=now,
        expires_at=expires_at,
        used=False,
    )
    db.add(otp)
    db.commit()
    db.refresh(otp)

    logger.info("Issued OTP for user_id=%s channel=%s target=%s expires_at=%s", user.id, channel.value, target_value, expires_at.isoformat())

    audit.log_action(
        db=db,
        user=user,
        action="otp_issued",
        entity_type="otp",
        entity_id=otp.id,
        meta={"channel": channel.value, "target_value": target_value, "expires_at": expires_at.isoformat()},
    )

    return otp


def verify_otp(
    db: Session,
    user: models.User,
    channel: models.OtpChannel,
    target_value: str,
    code: str,
) -> bool:
    now = datetime.utcnow()

    otp = (
        db.query(models.OtpCode)
        .filter(
            models.OtpCode.user_id == user.id,
            models.OtpCode.channel == channel,
            models.OtpCode.target_value == target_value,
            models.OtpCode.used.is_(False),
            models.OtpCode.expires_at >= now,
        )
        .order_by(models.OtpCode.created_at.desc())
        .first()
    )

    if not otp or otp.code != code:
        audit.log_action(db=db, user=user, action="otp_verification_failed", entity_type="otp", entity_id=None if not otp else otp.id, meta={"channel": channel.value, "target_value": target_value})
        logger.info("OTP verification failed for user_id=%s target=%s", user.id, target_value)
        return False

    otp.used = True
    db.commit()

    audit.log_action(db=db, user=user, action="otp_verification_success", entity_type="otp", entity_id=otp.id, meta={"channel": channel.value, "target_value": target_value})
    logger.info("OTP verification success for user_id=%s target=%s", user.id, target_value)
    return True
