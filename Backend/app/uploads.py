# app/routers/uploads.py
from typing import Dict, Optional
from datetime import datetime, timedelta
import base64

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Request
from sqlalchemy.orm import Session

from .db import get_db
from . import models
from .deps import get_current_user, get_current_user_optional
from .services.storage import store_base64_file
from .utils.rate_limiter import rate_limit_upload

router = APIRouter()


@router.post("/evidence/{complaint_id}", response_model=Dict)
@rate_limit_upload()
async def upload_evidence_file(
    complaint_id: str,
    file: UploadFile = File(...),
    request: Request = None,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """
    Upload a single evidence file for a complaint using multipart/form-data.

    - Uses the S3 + local fallback pipeline from app/services/storage.py
    - Attaches Evidence row to the complaint
    - `from_role` is inferred from the authenticated user (victim/cop/admin)
    """
    complaint = (
        db.query(models.Complaint)
        .filter(models.Complaint.complaint_id == complaint_id)
        .first()
    )
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    # Victim can only upload to their own complaints
    if user.role == models.UserRole.VICTIM and complaint.victim_id != user.id:
        raise HTTPException(
            status_code=403,
            detail="You can only upload evidence for your own complaints",
        )

    # Cops can only upload for their station
    if user.role == models.UserRole.COP and complaint.station_id != user.station_id:
        raise HTTPException(
            status_code=403,
            detail="You cannot upload evidence for other stations' complaints",
        )

    # Read bytes and encode to base64 for storage helper
    raw_bytes = await file.read()
    
    # Validate file size before processing
    if len(raw_bytes) > 10 * 1024 * 1024:  # 10MB limit
        raise HTTPException(status_code=413, detail="File size exceeds 10MB limit")
    
    if len(raw_bytes) == 0:
        raise HTTPException(status_code=400, detail="File is empty")
    
    data_base64 = base64.b64encode(raw_bytes).decode("ascii")

    try:
        storage_type, path_or_key, sha256 = store_base64_file(
            file.filename or "unknown",
            file.content_type or "application/octet-stream",
            data_base64,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    evidence = models.Evidence(
        complaint_id=complaint.id,
        file_name=file.filename,
        content_type=file.content_type or "application/octet-stream",
        storage_type=storage_type,
        storage_path=path_or_key,
        sha256=sha256,
        uploaded_by_id=user.id,
    )
    db.add(evidence)
    db.commit()
    db.refresh(evidence)

    return {
        "id": evidence.id,
        "file_name": evidence.file_name,
        "content_type": evidence.content_type,
        "storage_type": evidence.storage_type.value,
        "storage_path": evidence.storage_path,
        "sha256": evidence.sha256,
    }


@router.post("/photo", response_model=Dict)
async def upload_photo(
    file: UploadFile = File(...),
    request: Request = None,
    db: Session = Depends(get_db),
    user: Optional[models.User] = Depends(get_current_user_optional),
):
    """
    Upload a photo file (for use in complaint creation).
    Stores file metadata in temporary_uploads table and returns upload ID.
    """
    # Read bytes and encode to base64 for storage helper
    raw_bytes = await file.read()
    
    # Validate file size
    if len(raw_bytes) > 10 * 1024 * 1024:  # 10MB limit
        raise HTTPException(status_code=413, detail="File size exceeds 10MB limit")
    
    if len(raw_bytes) == 0:
        raise HTTPException(status_code=400, detail="File is empty")
    
    data_base64 = base64.b64encode(raw_bytes).decode("ascii")

    try:
        storage_type, path_or_key, sha256 = store_base64_file(
            file.filename or "photo.jpg",
            file.content_type or "image/jpeg",
            data_base64,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Store in temporary_uploads table
    temp_upload = models.TemporaryUpload(
        file_name=file.filename or "photo.jpg",
        content_type=file.content_type or "image/jpeg",
        storage_type=storage_type,
        storage_path=path_or_key,
        sha256=sha256,
        uploaded_by_id=user.id if user else None,
        expires_at=datetime.utcnow() + timedelta(days=7),  # Expires in 7 days if not linked
    )
    db.add(temp_upload)
    db.commit()
    db.refresh(temp_upload)

    return {
        "file_id": str(temp_upload.id),  # Return ID for frontend
        "file_name": temp_upload.file_name,
        "content_type": temp_upload.content_type,
        "storage_type": temp_upload.storage_type.value,
        "storage_path": temp_upload.storage_path,
        "sha256": temp_upload.sha256,
        "url": temp_upload.storage_path,
    }


@router.post("/attachment", response_model=Dict)
async def upload_attachment(
    file: UploadFile = File(...),
    request: Request = None,
    db: Session = Depends(get_db),
    user: Optional[models.User] = Depends(get_current_user_optional),
):
    """
    Upload an attachment file (PDF, DOCX, CSV, etc.) for use in complaint creation.
    Stores file metadata in temporary_uploads table and returns upload ID.
    """
    # Read bytes and encode to base64 for storage helper
    raw_bytes = await file.read()
    
    # Validate file size
    if len(raw_bytes) > 10 * 1024 * 1024:  # 10MB limit
        raise HTTPException(status_code=413, detail="File size exceeds 10MB limit")
    
    if len(raw_bytes) == 0:
        raise HTTPException(status_code=400, detail="File is empty")
    
    data_base64 = base64.b64encode(raw_bytes).decode("ascii")

    try:
        storage_type, path_or_key, sha256 = store_base64_file(
            file.filename or "attachment",
            file.content_type or "application/octet-stream",
            data_base64,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Store in temporary_uploads table
    temp_upload = models.TemporaryUpload(
        file_name=file.filename or "attachment",
        content_type=file.content_type or "application/octet-stream",
        storage_type=storage_type,
        storage_path=path_or_key,
        sha256=sha256,
        uploaded_by_id=user.id if user else None,
        expires_at=datetime.utcnow() + timedelta(days=7),  # Expires in 7 days if not linked
    )
    db.add(temp_upload)
    db.commit()
    db.refresh(temp_upload)

    return {
        "file_id": str(temp_upload.id),  # Return ID for frontend
        "file_name": temp_upload.file_name,
        "content_type": temp_upload.content_type,
        "storage_type": temp_upload.storage_type.value,
        "storage_path": temp_upload.storage_path,
        "sha256": temp_upload.sha256,
        "url": temp_upload.storage_path,
    }