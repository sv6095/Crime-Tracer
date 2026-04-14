# app/investigation.py
"""
Investigation Diary API Router
Handles personal diary entries and evidence uploads for investigators
"""
import logging
import base64
import hashlib
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy import and_

logger = logging.getLogger("crime_tracer.investigation")

from .db import get_db
from . import models, schemas
from .deps import get_cop, get_admin, get_cop_or_admin
from .services.change_tracker import get_change_tracker
from .services.encryption import get_encryption_service
from .services.storage import store_base64_file

router = APIRouter()


@router.post("/{case_id}/diary", response_model=schemas.DiaryEntryOut)
def create_diary_entry(
    case_id: int,
    entry: schemas.DiaryEntryCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_cop),
):
    """Create a new diary entry for a case."""
    # Verify case exists
    case = db.query(models.Complaint).filter(models.Complaint.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    # Check access - assigned officers, same station cops, or admins
    if user.role != models.UserRole.ADMIN:
        # Check if Case exists and user is assigned
        case_obj = db.query(models.Case).filter(models.Case.complaint_id == case_id).first()
        if case_obj and case_obj.assigned_officer_id == user.id:
            # User is assigned, allow access
            pass
        elif case.station_id == user.station_id:
            # Same station, allow access for viewing/creating diary
            pass
        else:
            raise HTTPException(status_code=403, detail="Not authorized to access this case")
    
    # Encrypt content if encryption is enabled
    encryption_service = get_encryption_service()
    should_encrypt = entry.encrypted if entry.encrypted is not None else True
    content_to_store = encryption_service.encrypt(entry.content) if should_encrypt else entry.content
    
    # Create diary entry
    diary_entry = models.InvestigationDiary(
        case_id=case_id,
        investigator_id=user.id,
        entry_type=entry.entry_type,
        content=content_to_store,
        encrypted=should_encrypt,
    )
    
    db.add(diary_entry)
    db.commit()
    db.refresh(diary_entry)
    
    # Log change to audit trail
    change_tracker = get_change_tracker(db)
    change_tracker.log_change(
        case_id=case_id,
        user=user,
        section='personal_diary',
        field_changed=f'diary_entry_{diary_entry.id}',
        change_type='INSERT',
        new_value=entry.content[:100] if len(entry.content) > 100 else entry.content,  # Truncate for audit
        details=f"Created {entry.entry_type} entry",
        request=request,
    )
    
    # Decrypt content for response if needed
    content_for_response = diary_entry.content
    if diary_entry.encrypted:
        try:
            content_for_response = encryption_service.decrypt(diary_entry.content)
        except Exception:
            content_for_response = "[Decryption Error]"
    
    return schemas.DiaryEntryOut(
        id=diary_entry.id,
        case_id=diary_entry.case_id,
        investigator_id=diary_entry.investigator_id,
        investigator_name=user.name,
        entry_type=diary_entry.entry_type,
        content=content_for_response,
        encrypted=diary_entry.encrypted,
        created_at=diary_entry.created_at,
        updated_at=diary_entry.updated_at,
    )


@router.get("/{case_id}/diary", response_model=List[schemas.DiaryEntryOut])
def list_diary_entries(
    case_id: int,
    entry_type: Optional[str] = None,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_cop),
):
    """List diary entries for a case."""
    # Verify case exists
    case = db.query(models.Complaint).filter(models.Complaint.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    # Check access - assigned officers, same station cops, or admins
    if user.role != models.UserRole.ADMIN:
        case_obj = db.query(models.Case).filter(models.Case.complaint_id == case_id).first()
        if case_obj and case_obj.assigned_officer_id == user.id:
            # User is assigned, allow access
            pass
        elif case.station_id == user.station_id:
            # Same station, allow access
            pass
        else:
            raise HTTPException(status_code=403, detail="Not authorized to access this case")
    
    # Query diary entries
    query = (
        db.query(models.InvestigationDiary)
        .filter(
            and_(
                models.InvestigationDiary.case_id == case_id,
                models.InvestigationDiary.deleted_at.is_(None),
            )
        )
    )
    
    if entry_type:
        query = query.filter(models.InvestigationDiary.entry_type == entry_type)
    
    entries = query.order_by(models.InvestigationDiary.created_at.desc()).all()
    
    # Get investigator names
    investigator_ids = {e.investigator_id for e in entries}
    investigators = {
        u.id: u.name
        for u in db.query(models.User)
        .filter(models.User.id.in_(investigator_ids))
        .all()
    }
    
    # Decrypt entries if needed
    encryption_service = get_encryption_service()
    
    result = []
    for e in entries:
        content = e.content
        if e.encrypted:
            try:
                content = encryption_service.decrypt(e.content)
            except Exception as ex:
                logger.warning(f"Failed to decrypt diary entry {e.id}: {ex}")
                content = "[Decryption Error]"
        
        result.append(
            schemas.DiaryEntryOut(
                id=e.id,
                case_id=e.case_id,
                investigator_id=e.investigator_id,
                investigator_name=investigators.get(e.investigator_id, "Unknown"),
                entry_type=e.entry_type,
                content=content,
                encrypted=e.encrypted,
                created_at=e.created_at,
                updated_at=e.updated_at,
            )
        )
    
    return result


@router.put("/{case_id}/diary/{entry_id}", response_model=schemas.DiaryEntryOut)
def update_diary_entry(
    case_id: int,
    entry_id: int,
    entry: schemas.DiaryEntryUpdate,
    request: Request,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_cop),
):
    """Update a diary entry."""
    diary_entry = (
        db.query(models.InvestigationDiary)
        .filter(
            and_(
                models.InvestigationDiary.id == entry_id,
                models.InvestigationDiary.case_id == case_id,
                models.InvestigationDiary.deleted_at.is_(None),
            )
        )
        .first()
    )
    
    if not diary_entry:
        raise HTTPException(status_code=404, detail="Diary entry not found")
    
    # Check ownership or admin
    if diary_entry.investigator_id != user.id and user.role != models.UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized to modify this entry")
    
    # Store old value for audit (decrypt if needed)
    encryption_service = get_encryption_service()
    old_content = diary_entry.content
    if diary_entry.encrypted:
        try:
            old_content = encryption_service.decrypt(old_content)
        except Exception:
            old_content = "[Decryption Error]"
    
    # Update entry
    if entry.content is not None:
        # Encrypt new content if encryption is enabled
        content_to_store = encryption_service.encrypt(entry.content) if diary_entry.encrypted else entry.content
        diary_entry.content = content_to_store
    if entry.entry_type is not None:
        diary_entry.entry_type = entry.entry_type
    diary_entry.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(diary_entry)
    
    # Log change to audit trail
    change_tracker = get_change_tracker(db)
    change_tracker.log_change(
        case_id=case_id,
        user=user,
        section='personal_diary',
        field_changed=f'diary_entry_{entry_id}',
        change_type='UPDATE',
        old_value=old_content[:100] if len(old_content) > 100 else old_content,
        new_value=diary_entry.content[:100] if len(diary_entry.content) > 100 else diary_entry.content,
        details=f"Updated {diary_entry.entry_type} entry",
        request=request,
    )
    
    investigator = db.query(models.User).filter(models.User.id == diary_entry.investigator_id).first()
    
    # Decrypt content if needed
    content = diary_entry.content
    if diary_entry.encrypted:
        try:
            content = encryption_service.decrypt(diary_entry.content)
        except Exception:
            content = "[Decryption Error]"
    
    return schemas.DiaryEntryOut(
        id=diary_entry.id,
        case_id=diary_entry.case_id,
        investigator_id=diary_entry.investigator_id,
        investigator_name=investigator.name if investigator else "Unknown",
        entry_type=diary_entry.entry_type,
        content=content,
        encrypted=diary_entry.encrypted,
        created_at=diary_entry.created_at,
        updated_at=diary_entry.updated_at,
    )


@router.delete("/{case_id}/diary/{entry_id}")
def delete_diary_entry(
    case_id: int,
    entry_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_cop),
):
    """Soft delete a diary entry."""
    diary_entry = (
        db.query(models.InvestigationDiary)
        .filter(
            and_(
                models.InvestigationDiary.id == entry_id,
                models.InvestigationDiary.case_id == case_id,
                models.InvestigationDiary.deleted_at.is_(None),
            )
        )
        .first()
    )
    
    if not diary_entry:
        raise HTTPException(status_code=404, detail="Diary entry not found")
    
    # Check ownership or admin
    if diary_entry.investigator_id != user.id and user.role != models.UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized to delete this entry")
    
    # Soft delete
    diary_entry.deleted_at = datetime.utcnow()
    db.commit()
    
    # Decrypt content for audit trail
    encryption_service = get_encryption_service()
    old_content_for_audit = diary_entry.content
    if diary_entry.encrypted:
        try:
            old_content_for_audit = encryption_service.decrypt(diary_entry.content)
        except Exception:
            old_content_for_audit = "[Decryption Error]"
    
    # Log change to audit trail
    change_tracker = get_change_tracker(db)
    change_tracker.log_change(
        case_id=case_id,
        user=user,
        section='personal_diary',
        field_changed=f'diary_entry_{entry_id}',
        change_type='DELETE',
        old_value=old_content_for_audit[:100] if len(old_content_for_audit) > 100 else old_content_for_audit,
        details=f"Deleted {diary_entry.entry_type} entry",
        request=request,
    )
    
    return {"success": True, "message": "Diary entry deleted"}


# ============================================================
# EVIDENCE UPLOAD ENDPOINTS
# ============================================================

@router.post("/{case_id}/evidence", response_model=schemas.EvidenceOut)
async def upload_evidence(
    case_id: int,
    evidence_type: str = Form(...),
    file: Optional[UploadFile] = File(None),
    text_content: Optional[str] = Form(None),
    file_name: Optional[str] = Form(None),
    content_type: Optional[str] = Form(None),
    recording_duration: Optional[int] = Form(None),
    recording_format: Optional[str] = Form(None),
    request: Request = None,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_cop_or_admin),
):
    """Upload evidence for a case. Supports files (multipart) or text/CSV (form data)."""
    # Verify case exists
    case = db.query(models.Complaint).filter(models.Complaint.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    # Check access - assigned officers, same station cops, or admins
    if user.role != models.UserRole.ADMIN:
        case_obj = db.query(models.Case).filter(models.Case.complaint_id == case_id).first()
        if case_obj and case_obj.assigned_officer_id == user.id:
            pass
        elif case.station_id == user.station_id:
            pass
        else:
            raise HTTPException(status_code=403, detail="Not authorized to access this case")
    
    # Validate evidence_type
    valid_types = ['text', 'csv', 'pdf', 'image', 'video', 'audio', 'live_recording']
    if evidence_type not in valid_types:
        raise HTTPException(status_code=400, detail=f"Invalid evidence_type. Must be one of: {', '.join(valid_types)}")
    
    storage_type = models.StorageType.LOCAL
    storage_path = ""
    sha256_hash = ""
    final_file_name = file_name or "evidence"
    final_content_type = content_type or "text/plain"
    
    # Handle text/CSV evidence (stored directly in DB)
    if evidence_type in ['text', 'csv']:
        if not text_content:
            raise HTTPException(status_code=400, detail="text_content is required for text/csv evidence")
        # Compute hash of text content
        sha256_hash = hashlib.sha256(text_content.encode('utf-8')).hexdigest()
        if evidence_type == 'csv':
            final_content_type = 'text/csv'
            if not final_file_name.endswith('.csv'):
                final_file_name += '.csv'
        else:
            final_content_type = 'text/plain'
            if not final_file_name.endswith('.txt'):
                final_file_name += '.txt'
    
    # Handle file uploads (PDF, images, videos, audio, live recordings)
    elif evidence_type in ['pdf', 'image', 'video', 'audio', 'live_recording']:
        if not file:
            raise HTTPException(status_code=400, detail="File upload is required for this evidence type")
        
        # Read file bytes
        raw_bytes = await file.read()
        if len(raw_bytes) == 0:
            raise HTTPException(status_code=400, detail="File is empty")
        if len(raw_bytes) > 10 * 1024 * 1024:  # 10MB limit
            raise HTTPException(status_code=413, detail="File size exceeds 10MB limit")
        
        # Compute SHA-256 hash
        sha256_hash = hashlib.sha256(raw_bytes).hexdigest()
        
        # Use file's original name/content-type if not provided
        final_file_name = file.filename or final_file_name
        final_content_type = file.content_type or final_content_type
        
        # Store file using storage service
        data_base64 = base64.b64encode(raw_bytes).decode("ascii")
        try:
            storage_type, storage_path, _ = store_base64_file(
                final_file_name,
                final_content_type,
                data_base64,
            )
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
    
    # Create evidence record
    evidence = models.Evidence(
        complaint_id=case_id,
        file_name=final_file_name,
        content_type=final_content_type,
        storage_type=storage_type,
        storage_path=storage_path,
        sha256=sha256_hash,
        uploaded_by_id=user.id,
        evidence_type=evidence_type,
        text_content=text_content if evidence_type in ['text', 'csv'] else None,
        recording_duration=recording_duration,
        recording_format=recording_format,
    )
    
    db.add(evidence)
    db.commit()
    db.refresh(evidence)
    
    # Log change to audit trail
    change_tracker = get_change_tracker(db)
    change_tracker.log_change(
        case_id=case_id,
        user=user,
        section='case_evidences',
        field_changed=f'evidence_{evidence.id}',
        change_type='INSERT',
        new_value=f"{evidence_type}: {final_file_name}",
        details=f"Uploaded {evidence_type} evidence",
        request=request,
    )
    
    def _storage_type_str(st):
        if st is None:
            return "LOCAL"
        return getattr(st, "value", str(st)) if hasattr(st, "value") else str(st)

    return schemas.EvidenceOut(
        id=evidence.id,
        file_name=evidence.file_name,
        content_type=evidence.content_type,
        storage_type=_storage_type_str(evidence.storage_type),
        storage_path=evidence.storage_path,
        sha256=evidence.sha256,
        evidence_type=evidence.evidence_type,
        text_content=evidence.text_content,
        deleted_at=evidence.deleted_at,
        recording_duration=evidence.recording_duration,
        recording_format=evidence.recording_format,
        uploaded_by_id=evidence.uploaded_by_id,
        uploaded_at=evidence.uploaded_at,
    )


@router.get("/{case_id}/evidence", response_model=List[schemas.EvidenceOut])
def list_evidence(
    case_id: int,
    evidence_type: Optional[str] = None,
    include_deleted: bool = False,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_cop_or_admin),
):
    """List evidence for a case."""
    # Verify case exists
    case = db.query(models.Complaint).filter(models.Complaint.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    # Check access
    if user.role != models.UserRole.ADMIN:
        case_obj = db.query(models.Case).filter(models.Case.complaint_id == case_id).first()
        if case_obj and case_obj.assigned_officer_id == user.id:
            pass
        elif case.station_id == user.station_id:
            pass
        else:
            raise HTTPException(status_code=403, detail="Not authorized to access this case")
    
    # Query evidence
    query = db.query(models.Evidence).filter(models.Evidence.complaint_id == case_id)
    
    if not include_deleted or user.role != models.UserRole.ADMIN:
        query = query.filter(models.Evidence.deleted_at.is_(None))
    
    if evidence_type:
        query = query.filter(models.Evidence.evidence_type == evidence_type)
    
    evidence_list = query.order_by(models.Evidence.uploaded_at.desc()).all()

    def _storage_type_str(st):
        if st is None:
            return "LOCAL"
        return getattr(st, "value", str(st)) if hasattr(st, "value") else str(st)

    return [
        schemas.EvidenceOut(
            id=e.id,
            file_name=e.file_name,
            content_type=e.content_type,
            storage_type=_storage_type_str(e.storage_type),
            storage_path=e.storage_path,
            sha256=e.sha256,
            evidence_type=e.evidence_type,
            text_content=e.text_content,
            deleted_at=e.deleted_at,
            recording_duration=e.recording_duration,
            recording_format=e.recording_format,
            uploaded_by_id=e.uploaded_by_id,
            uploaded_at=e.uploaded_at,
        )
        for e in evidence_list
    ]


@router.put("/{case_id}/evidence/{evidence_id}", response_model=schemas.EvidenceOut)
def update_evidence(
    case_id: int,
    evidence_id: int,
    update_data: schemas.EvidenceUpdate,
    request: Request = None,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_cop_or_admin),
):
    """Update evidence metadata."""
    evidence = (
        db.query(models.Evidence)
        .filter(
            and_(
                models.Evidence.id == evidence_id,
                models.Evidence.complaint_id == case_id,
                models.Evidence.deleted_at.is_(None),
            )
        )
        .first()
    )
    
    if not evidence:
        raise HTTPException(status_code=404, detail="Evidence not found")
    
    # Check access
    case = db.query(models.Complaint).filter(models.Complaint.id == case_id).first()
    if user.role != models.UserRole.ADMIN:
        case_obj = db.query(models.Case).filter(models.Case.complaint_id == case_id).first()
        if case_obj and case_obj.assigned_officer_id == user.id:
            pass
        elif case.station_id == user.station_id:
            pass
        else:
            raise HTTPException(status_code=403, detail="Not authorized")
    
    # Store old values for audit
    old_file_name = evidence.file_name
    old_text_content = evidence.text_content
    
    # Update fields
    if update_data.file_name is not None:
        evidence.file_name = update_data.file_name
    if update_data.text_content is not None:
        evidence.text_content = update_data.text_content
    if update_data.forensic_tags is not None:
        evidence.forensic_tags = update_data.forensic_tags
    
    db.commit()
    db.refresh(evidence)
    
    # Log change to audit trail
    change_tracker = get_change_tracker(db)
    change_tracker.log_change(
        case_id=case_id,
        user=user,
        section='case_evidences',
        field_changed=f'evidence_{evidence_id}',
        change_type='UPDATE',
        old_value=f"{old_file_name}: {old_text_content[:50] if old_text_content else ''}",
        new_value=f"{evidence.file_name}: {evidence.text_content[:50] if evidence.text_content else ''}",
        details="Updated evidence metadata",
        request=request,
    )
    
    def _st_str(st):
        if st is None:
            return "LOCAL"
        return getattr(st, "value", str(st)) if hasattr(st, "value") else str(st)

    return schemas.EvidenceOut(
        id=evidence.id,
        file_name=evidence.file_name,
        content_type=evidence.content_type,
        storage_type=_st_str(evidence.storage_type),
        storage_path=evidence.storage_path,
        sha256=evidence.sha256,
        evidence_type=evidence.evidence_type,
        text_content=evidence.text_content,
        deleted_at=evidence.deleted_at,
        recording_duration=evidence.recording_duration,
        recording_format=evidence.recording_format,
        uploaded_by_id=evidence.uploaded_by_id,
        uploaded_at=evidence.uploaded_at,
    )


@router.delete("/{case_id}/evidence/{evidence_id}")
def delete_evidence(
    case_id: int,
    evidence_id: int,
    request: Request = None,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_cop_or_admin),
):
    """Soft delete evidence."""
    evidence = (
        db.query(models.Evidence)
        .filter(
            and_(
                models.Evidence.id == evidence_id,
                models.Evidence.complaint_id == case_id,
                models.Evidence.deleted_at.is_(None),
            )
        )
        .first()
    )
    
    if not evidence:
        raise HTTPException(status_code=404, detail="Evidence not found")
    
    # Check access
    case = db.query(models.Complaint).filter(models.Complaint.id == case_id).first()
    if user.role != models.UserRole.ADMIN:
        case_obj = db.query(models.Case).filter(models.Case.complaint_id == case_id).first()
        if case_obj and case_obj.assigned_officer_id == user.id:
            pass
        elif case.station_id == user.station_id:
            pass
        else:
            raise HTTPException(status_code=403, detail="Not authorized")
    
    # Soft delete
    evidence.deleted_at = datetime.utcnow()
    db.commit()
    
    # Log change to audit trail
    change_tracker = get_change_tracker(db)
    change_tracker.log_change(
        case_id=case_id,
        user=user,
        section='case_evidences',
        field_changed=f'evidence_{evidence_id}',
        change_type='DELETE',
        old_value=f"{evidence.evidence_type}: {evidence.file_name}",
        details=f"Deleted {evidence.evidence_type} evidence",
        request=request,
    )
    
    return {"success": True, "message": "Evidence deleted"}


@router.get("/{case_id}/evidence/deleted", response_model=List[schemas.EvidenceChangeOut])
def get_deleted_evidence(
    case_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_cop_or_admin),
):
    """Get deleted evidence from immutable audit trail."""
    # Verify case exists
    case = db.query(models.Complaint).filter(models.Complaint.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    # Check access
    if user.role != models.UserRole.ADMIN:
        case_obj = db.query(models.Case).filter(models.Case.complaint_id == case_id).first()
        if case_obj and case_obj.assigned_officer_id == user.id:
            pass
        elif case.station_id == user.station_id:
            pass
        else:
            raise HTTPException(status_code=403, detail="Not authorized")
    
    # Query deleted evidence from audit trail
    deleted_changes = (
        db.query(models.EvidenceChange)
        .filter(
            and_(
                models.EvidenceChange.case_id == case_id,
                models.EvidenceChange.section_modified == 'case_evidences',
                models.EvidenceChange.change_type == 'DELETE',
            )
        )
        .order_by(models.EvidenceChange.timestamp.desc())
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
        for c in deleted_changes
    ]
