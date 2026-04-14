# app/services/audit.py
from typing import Optional, Dict, Any
import logging
from sqlalchemy.orm import Session
from .. import models

logger = logging.getLogger("crime_tracer.audit")

def log_action(db: Session, user: Optional[models.User], action: str, entity_type: Optional[str] = None, entity_id: Optional[int] = None, meta: Optional[Dict[str, Any]] = None):
    try:
        log = models.AuditLog(user_id=user.id if user else None, action=action, entity_type=entity_type, entity_id=entity_id, meta=meta or {})
        db.add(log)
        db.commit()
    except Exception:
        try:
            db.rollback()
        except Exception:
            pass
        logger.exception("Audit logging failed")
