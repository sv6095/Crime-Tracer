# app/audit.py
"""
Audit Trail API Router - Immutable Change Logging
Provides read-only access to evidence changes for Section 65-B compliance
"""
from typing import List, Optional, Dict, Any
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from .db import get_db
from . import models, schemas
from .deps import get_cop, get_admin, get_current_user
from .services.change_tracker import get_change_tracker
from .services.blockchain import get_blockchain_service

router = APIRouter()


@router.get("/{case_id}/changes", response_model=List[schemas.EvidenceChangeOut])
def get_case_changes(
    case_id: int,
    section: Optional[str] = None,
    change_type: Optional[str] = None,
    user_id: Optional[int] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    limit: int = Query(default=100, le=1000),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Get all changes for a case (read-only audit trail)."""
    # Verify case exists
    case = db.query(models.Complaint).filter(models.Complaint.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    # Check access - cops can see their station's cases, admins can see all
    if user.role != models.UserRole.ADMIN:
        if case.station_id != user.station_id:
            raise HTTPException(status_code=403, detail="Not authorized to access this case")
    
    # Query changes
    query = db.query(models.EvidenceChange).filter(
        models.EvidenceChange.case_id == case_id
    )
    
    if section:
        query = query.filter(models.EvidenceChange.section_modified == section)
    
    if change_type:
        query = query.filter(models.EvidenceChange.change_type == change_type)
    
    if user_id:
        query = query.filter(models.EvidenceChange.user_id == user_id)
    
    if start_date:
        query = query.filter(models.EvidenceChange.timestamp >= start_date)
    
    if end_date:
        query = query.filter(models.EvidenceChange.timestamp <= end_date)
    
    changes = (
        query.order_by(models.EvidenceChange.timestamp.desc())
        .limit(limit)
        .offset(offset)
        .all()
    )
    
    return [
        schemas.EvidenceChangeOut(
            id=c.id,
            change_id=c.change_id,
            case_id=c.case_id,
            user_id=c.user_id,
            user_name=c.user_name,
            section_modified=c.section_modified,
            field_changed=c.field_changed,
            change_type=c.change_type,
            old_value=c.old_value,
            new_value=c.new_value,
            details=c.details,
            cryptographic_hash=c.cryptographic_hash,
            timestamp=c.timestamp,
            ip_address=c.ip_address,
            user_agent=c.user_agent,
        )
        for c in changes
    ]


@router.get("/{case_id}/changes/{change_id}", response_model=schemas.EvidenceChangeOut)
def get_change_detail(
    case_id: int,
    change_id: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Get specific change detail."""
    change = (
        db.query(models.EvidenceChange)
        .filter(
            and_(
                models.EvidenceChange.case_id == case_id,
                models.EvidenceChange.change_id == change_id,
            )
        )
        .first()
    )
    
    if not change:
        raise HTTPException(status_code=404, detail="Change not found")
    
    # Check access
    case = db.query(models.Complaint).filter(models.Complaint.id == case_id).first()
    if user.role != models.UserRole.ADMIN:
        if case.station_id != user.station_id:
            raise HTTPException(status_code=403, detail="Not authorized")
    
    return schemas.EvidenceChangeOut(
        id=change.id,
        change_id=change.change_id,
        case_id=change.case_id,
        user_id=change.user_id,
        user_name=change.user_name,
        section_modified=change.section_modified,
        field_changed=change.field_changed,
        change_type=change.change_type,
        old_value=change.old_value,
        new_value=change.new_value,
        details=change.details,
        cryptographic_hash=change.cryptographic_hash,
        timestamp=change.timestamp,
        ip_address=change.ip_address,
        user_agent=change.user_agent,
    )


@router.post("/{case_id}/changes/verify", response_model=schemas.IntegrityVerificationOut)
def verify_integrity(
    case_id: int,
    change_ids: List[str],
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Verify cryptographic integrity of change records."""
    # Check access
    case = db.query(models.Complaint).filter(models.Complaint.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    if user.role != models.UserRole.ADMIN:
        if case.station_id != user.station_id:
            raise HTTPException(status_code=403, detail="Not authorized")
    
    change_tracker = get_change_tracker(db)
    
    results = {}
    all_valid = True
    
    for change_id in change_ids:
        is_valid = change_tracker.verify_integrity(change_id)
        results[change_id] = is_valid
        if not is_valid:
            all_valid = False
    
    return schemas.IntegrityVerificationOut(
        case_id=case_id,
        all_valid=all_valid,
        results=results,
    )


@router.get("/changes", response_model=List[schemas.EvidenceChangeOut])
def get_all_changes(
    case_id: Optional[int] = None,
    section: Optional[str] = None,
    change_type: Optional[str] = None,
    limit: int = Query(default=100, le=1000),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_admin),
):
    """Admin endpoint: Get all changes (filtered)."""
    query = db.query(models.EvidenceChange)
    
    if case_id:
        query = query.filter(models.EvidenceChange.case_id == case_id)
    
    if section:
        query = query.filter(models.EvidenceChange.section_modified == section)
    
    if change_type:
        query = query.filter(models.EvidenceChange.change_type == change_type)
    
    changes = (
        query.order_by(models.EvidenceChange.timestamp.desc())
        .limit(limit)
        .offset(offset)
        .all()
    )
    
    return [
        schemas.EvidenceChangeOut(
            id=c.id,
            change_id=c.change_id,
            case_id=c.case_id,
            user_id=c.user_id,
            user_name=c.user_name,
            section_modified=c.section_modified,
            field_changed=c.field_changed,
            change_type=c.change_type,
            old_value=c.old_value,
            new_value=c.new_value,
            details=c.details,
            cryptographic_hash=c.cryptographic_hash,
            timestamp=c.timestamp,
            ip_address=c.ip_address,
            user_agent=c.user_agent,
        )
        for c in changes
    ]
