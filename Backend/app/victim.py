# app/victim.py
from datetime import datetime, timedelta
from typing import List, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from .db import get_db
from . import models, schemas
from .deps import get_victim
from .services import storage, grok_client, bns_generator, audit
from .constants import ComplaintState
from .cases import _add_timeline

router = APIRouter()

# --- simple in-memory rate limiting for tracking (dev-friendly, single-process) ---
_RATE_LIMIT_WINDOW = 60  # seconds
_RATE_LIMIT_MAX = 10     # max requests per window per victim
_rate_state: Dict[int, List[datetime]] = {}


def _check_rate_limit(victim_id: int):
    now = datetime.utcnow()
    entries = _rate_state.get(victim_id, [])
    # drop old entries
    entries = [t for t in entries if (now - t).total_seconds() <= _RATE_LIMIT_WINDOW]
    if len(entries) >= _RATE_LIMIT_MAX:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many tracking requests, please try again later.",
        )
    entries.append(now)
    _rate_state[victim_id] = entries


# ---------- Profile ----------

@router.get("/profile", response_model=schemas.VictimProfileOut)
def get_profile(
    db: Session = Depends(get_db),
    victim: models.User = Depends(get_victim),
):
    return schemas.VictimProfileOut(
        id=victim.id,
        name=victim.name,
        email=victim.email,
        phone=victim.phone,
        address=victim.address,
        station_id=victim.station_id,
        emergency_contact_name=victim.emergency_contact_name,
        emergency_contact_phone=victim.emergency_contact_phone,
        email_verified=getattr(victim, "email_verified", False),
        phone_verified=getattr(victim, "phone_verified", False),
    )


@router.put("/profile", response_model=schemas.VictimProfileOut)
def update_profile(
    payload: schemas.VictimProfileUpdate,
    db: Session = Depends(get_db),
    victim: models.User = Depends(get_victim),
):
    victim.name = payload.name or victim.name
    victim.email = payload.email
    victim.phone = payload.phone or victim.phone
    victim.address = payload.address
    victim.station_id = payload.station_id
    victim.emergency_contact_name = payload.emergency_contact_name
    victim.emergency_contact_phone = payload.emergency_contact_phone
    victim.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(victim)

    audit.log_action(
        db,
        victim,
        action="victim_profile_updated",
        entity_type="user",
        entity_id=victim.id,
    )

    return schemas.VictimProfileOut(
        id=victim.id,
        name=victim.name,
        email=victim.email,
        phone=victim.phone,
        address=victim.address,
        station_id=victim.station_id,
        emergency_contact_name=victim.emergency_contact_name,
        emergency_contact_phone=victim.emergency_contact_phone,
        email_verified=getattr(victim, "email_verified", False),
        phone_verified=getattr(victim, "phone_verified", False),
    )


# ---------- Contact Verification (OTP result → DB flags) ----------

@router.post("/verify-phone")
def verify_phone_victim(
    db: Session = Depends(get_db),
    victim: models.User = Depends(get_victim),
):
    """
    Mark the current victim's phone as verified.

    The actual OTP comparison is done on the frontend for this hackathon build.
    This endpoint ONLY flips the phone_verified flag in the database.
    """
    if not victim.phone:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Phone number is not set for this user.",
        )

    victim.phone_verified = True
    victim.updated_at = datetime.utcnow()
    db.add(victim)
    db.commit()
    db.refresh(victim)

    audit.log_action(
        db,
        victim,
        action="victim_phone_verified",
        entity_type="user",
        entity_id=victim.id,
        meta={"phone": victim.phone},
    )

    return {"status": "ok", "phone_verified": True}


@router.post("/verify-email")
def verify_email_victim(
    db: Session = Depends(get_db),
    victim: models.User = Depends(get_victim),
):
    """
    Mark the current victim's email as verified.

    OTP UX is handled client-side; we only persist the final verified state.
    """
    if not victim.email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is not set for this user.",
        )

    victim.email_verified = True
    victim.updated_at = datetime.utcnow()
    db.add(victim)
    db.commit()
    db.refresh(victim)

    audit.log_action(
        db,
        victim,
        action="victim_email_verified",
        entity_type="user",
        entity_id=victim.id,
        meta={"email": victim.email},
    )

    return {"status": "ok", "email_verified": True}


# ---------- Complaint Create ----------

@router.post("/complaints", response_model=schemas.ComplaintSummary)
async def create_complaint(
    payload: schemas.ComplaintCreate,
    db: Session = Depends(get_db),
    victim: models.User = Depends(get_victim),
):
    """
    Create a new complaint for the logged-in victim.

    Station resolution:
    - First try Station.id == payload.station_id
    - If not found, fall back to Station.name == payload.station_id
      (useful when frontend sends a station name instead of DB id).
    """

    # 🔒 Enforce verified phone + email before allowing complaint creation
    if not victim.phone or not victim.email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Phone and email must be set and verified before filing a complaint.",
        )

    if not getattr(victim, "phone_verified", False) or not getattr(
        victim, "email_verified", False
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Phone and email must be verified via OTP before filing a complaint.",
        )

    # validate / resolve station
    station = (
        db.query(models.Station)
        .filter(models.Station.id == payload.station_id)
        .first()
    )

    if not station:
        # fallback: maybe frontend sent station name instead of id
        station = (
            db.query(models.Station)
            .filter(models.Station.name == payload.station_id)
            .first()
        )

    if not station:
        raise HTTPException(status_code=404, detail="Station not found")

    # server-side validation: crime_type & description non-empty
    if not payload.crime_type or not payload.description:
        raise HTTPException(
            status_code=400,
            detail="Crime type and description are required",
        )

    # location validation: at least text OR (lat,lng) - not enforced yet, but kept for future
    has_text = bool(payload.location_text and payload.location_text.strip())
    has_geo = bool(payload.location_lat and payload.location_lng)
    _ = (has_text, has_geo)  # placeholder to avoid lints

    # create complaint ID
    now = datetime.utcnow()
    base = now.strftime("CTM-%Y%m%d-")
    last_id = (
        db.query(models.Complaint.id)
        .order_by(models.Complaint.id.desc())
        .first()
    )
    next_seq = (last_id[0] + 1) if last_id else 1
    complaint_id = f"{base}{next_seq:06d}"

    complaint = models.Complaint(
        complaint_id=complaint_id,
        victim_id=victim.id,
        station_id=station.id,
        crime_type=payload.crime_type,
        description=payload.description,
        location_text=payload.location_text,
        location_lat=payload.location_lat,
        location_lng=payload.location_lng,
        location_accuracy=payload.location_accuracy,
        status=models.ComplaintStatus.NOT_ASSIGNED,
        state=ComplaintState.FILED,
        created_at=now,
        updated_at=now,
    )
    db.add(complaint)
    db.flush()  # get complaint.id

    # Link temporary uploads to complaint
    if payload.upload_ids:
        for upload_id in payload.upload_ids:
            temp_upload = (
                db.query(models.TemporaryUpload)
                .filter(models.TemporaryUpload.id == upload_id)
                .first()
            )
            if temp_upload:
                ev = models.Evidence(
                    complaint_id=complaint.id,
                    file_name=temp_upload.file_name,
                    content_type=temp_upload.content_type,
                    storage_type=temp_upload.storage_type,
                    storage_path=temp_upload.storage_path,
                    sha256=temp_upload.sha256,
                    uploaded_by_id=victim.id,
                )
                db.add(ev)
                temp_upload.complaint_id = complaint.id

    # Direct evidence upload (base64) - for backward compatibility
    for e in payload.evidence or []:
        storage_type, path, sha = storage.store_base64_file(
            file_name=e.file_name,
            content_type=e.content_type,
            data_base64=e.data_base64,
        )
        ev = models.Evidence(
            complaint_id=complaint.id,
            file_name=e.file_name,
            content_type=e.content_type,
            storage_type=storage_type,
            storage_path=path,
            sha256=sha,
            uploaded_by_id=victim.id,
        )
        db.add(ev)

    # Set complaint state to STATION_POOL (ready for cop assignment)
    # Add timeline entry for the transition from FILED to STATION_POOL
    complaint.state = models.ComplaintState.STATION_POOL
    
    _add_timeline(
        db,
        complaint,
        ComplaintState.FILED,  # from FILED
        ComplaintState.STATION_POOL,  # to STATION_POOL
        victim,
        "Complaint created by victim",
    )

    # case record
    case = models.Case(
        complaint_id=complaint.id,
        rejection_count=0,
        last_status=complaint.status,
        last_state=models.ComplaintState.STATION_POOL,  # Start in STATION_POOL so cops can accept
        last_update=now,
    )
    db.add(case)

    # history (legacy - kept for backward compatibility)
    hist = models.ComplaintStatusHistory(
        complaint_id=complaint.id,
        status=complaint.status,
        changed_by_id=victim.id,
        reason="Complaint created by victim",
    )
    db.add(hist)

    # LLM summary + BNS + precautions
    try:
        # 1. BNS Suggestions
        bns_sections = grok_client.generate_bns_sections(
            crime_type=complaint.crime_type, 
            description=complaint.description,
            location_text=complaint.location_text or ""
        )
        
        # 2. Precautions
        precautions_data = grok_client.generate_precautions(
             crime_type=complaint.crime_type,
             complaint_text=complaint.description
        )
        
        # 3. Victim Summary
        summary_result = grok_client.summarize_complaint(complaint)
        
        # 4. Officer Summary (case brief for police)
        officer_summary_result = grok_client.generate_officer_summary(
            crime_type=complaint.crime_type,
            description=complaint.description,
            location=complaint.location_text or ""
        )

        complaint.bns_sections = bns_sections
        complaint.precautions = precautions_data.get("precautions")
        complaint.summary = summary_result.get("summary_text")
        complaint.officer_summary = officer_summary_result.get("officer_summary")
        
        # 5. Severity
        complaint.predicted_severity = grok_client.predict_severity(
            description=complaint.description, 
            crime_type=complaint.crime_type
        )
    except Exception:
        # don't break core flow if LLM fails
        pass

    db.commit()
    db.refresh(complaint)

    audit.log_action(
        db,
        victim,
        action="complaint_created",
        entity_type="complaint",
        entity_id=complaint.id,
        meta={"complaint_id": complaint.complaint_id},
    )

    return schemas.ComplaintSummary(
        complaint_id=complaint.complaint_id,
        crime_type=complaint.crime_type,
        description=complaint.description,
        status=complaint.status.value,
        station_name=station.name,
        created_at=complaint.created_at,
    )


# ---------- Track Complaint ----------

@router.get("/complaints/by-id/{complaint_id}", response_model=schemas.ComplaintDetail)
def get_complaint_by_id(
    complaint_id: str,
    db: Session = Depends(get_db),
    victim: models.User = Depends(get_victim),
):
    _check_rate_limit(victim.id)

    complaint = (
        db.query(models.Complaint)
        .filter(models.Complaint.complaint_id == complaint_id)
        .first()
    )
    if not complaint or complaint.victim_id != victim.id:
        raise HTTPException(status_code=404, detail="Complaint not found")

    # Build timeline with actor names - sorted by created_at ascending
    timeline_entries = []
    sorted_timeline = sorted(complaint.timeline, key=lambda x: x.created_at)
    for entry in sorted_timeline:
        actor_name = "System"
        if entry.actor_id:
            actor = db.query(models.User).filter(models.User.id == entry.actor_id).first()
            if actor:
                actor_name = actor.name
        
        # Map ComplaintState to ComplaintStatus for display
        state_to_status_map = {
            "FILED": "NOT_ASSIGNED",
            "STATION_POOL": "NOT_ASSIGNED",
            "UNDER_INVESTIGATION": "INVESTIGATING",
            "RESOLVED_PENDING_CONFIRMATION": "RESOLVED",
            "CLOSED": "CLOSED",
            "ARCHIVED": "REJECTED",
        }
        
        to_state_value = entry.to_state.value if hasattr(entry.to_state, 'value') else str(entry.to_state)
        status_display = state_to_status_map.get(to_state_value, to_state_value)
        
        timeline_entries.append({
            "from_state": entry.from_state.value if entry.from_state and hasattr(entry.from_state, 'value') else (str(entry.from_state) if entry.from_state else "Initial"),
            "to_state": to_state_value,
            "status": status_display,  # Mapped status for frontend display
            "reason": entry.reason,
            "created_at": entry.created_at,
            "updated_by": actor_name,
        })
    
    # Also include history entries for backward compatibility - sorted by changed_at ascending
    history_entries = []
    sorted_history = sorted(complaint.history, key=lambda x: x.changed_at)
    for entry in sorted_history:
        history_entries.append({
            "status": entry.status.value if hasattr(entry.status, 'value') else str(entry.status),
            "reason": entry.reason,
            "created_at": entry.changed_at,
            "updated_by": entry.updated_by or "System",
        })
    
    # Create the response with both timeline and history
    detail = schemas.ComplaintDetail.model_validate(complaint)
    detail.timeline = timeline_entries
    detail.history = history_entries
    
    return detail


@router.get(
    "/complaints/by-phone/{phone}",
    response_model=List[schemas.ComplaintDetail],
)
def get_complaints_by_phone(
    phone: str,
    db: Session = Depends(get_db),
    victim: models.User = Depends(get_victim),
):
    _check_rate_limit(victim.id)

    # only allow querying for your own phone number
    if victim.phone and victim.phone != phone:
        raise HTTPException(
            status_code=403,
            detail="Can only query your own phone number",
        )

    q = (
        db.query(models.Complaint)
        .join(models.User, models.User.id == models.Complaint.victim_id)
        .filter(models.User.phone == phone, models.User.id == victim.id)
        .order_by(models.Complaint.created_at.desc())
    )
    complaints = q.all()
    
    # Build timeline for each complaint
    result = []
    for complaint in complaints:
        timeline_entries = []
        sorted_timeline = sorted(complaint.timeline, key=lambda x: x.created_at)
        for entry in sorted_timeline:
            actor_name = "System"
            if entry.actor_id:
                actor = db.query(models.User).filter(models.User.id == entry.actor_id).first()
                if actor:
                    actor_name = actor.name
            
            # Map ComplaintState to ComplaintStatus for display
            state_to_status_map = {
                "FILED": "NOT_ASSIGNED",
                "STATION_POOL": "NOT_ASSIGNED",
                "UNDER_INVESTIGATION": "INVESTIGATING",
                "RESOLVED_PENDING_CONFIRMATION": "RESOLVED",
                "CLOSED": "CLOSED",
                "ARCHIVED": "REJECTED",
            }
            
            to_state_value = entry.to_state.value if hasattr(entry.to_state, 'value') else str(entry.to_state)
            status_display = state_to_status_map.get(to_state_value, to_state_value)
            
            timeline_entries.append({
                "from_state": entry.from_state.value if entry.from_state and hasattr(entry.from_state, 'value') else (str(entry.from_state) if entry.from_state else "Initial"),
                "to_state": to_state_value,
                "status": status_display,  # Mapped status for frontend display
                "reason": entry.reason,
                "created_at": entry.created_at,
                "updated_by": actor_name,
            })
        
        history_entries = []
        for entry in complaint.history:
            history_entries.append({
                "status": entry.status.value if hasattr(entry.status, 'value') else str(entry.status),
                "reason": entry.reason,
                "created_at": entry.changed_at,
                "updated_by": entry.updated_by or "System",
            })
        
        detail = schemas.ComplaintDetail.model_validate(complaint)
        detail.timeline = timeline_entries
        detail.history = history_entries
        result.append(detail)
    
    return result


# ---------- Victim confirm resolved / reopen ----------

@router.post("/complaints/confirm", response_model=Dict[str, Any])
def confirm_resolution(
    payload: schemas.VictimConfirmResolution,
    db: Session = Depends(get_db),
    victim: models.User = Depends(get_victim),
):
    complaint = (
        db.query(models.Complaint)
        .filter(models.Complaint.complaint_id == payload.complaint_id)
        .first()
    )
    if not complaint or complaint.victim_id != victim.id:
        raise HTTPException(status_code=404, detail="Complaint not found")

    if complaint.status != models.ComplaintStatus.RESOLVED:
        raise HTTPException(
            status_code=400,
            detail="Complaint is not in RESOLVED state",
        )

    now = datetime.utcnow()

    if payload.confirm:
        complaint.status = models.ComplaintStatus.CLOSED
        complaint.state = ComplaintState.CLOSED
        complaint.closed_at = now
        reason = "Closed after victim confirmation"
        action = "victim_confirmed_resolved"
    else:
        complaint.status = models.ComplaintStatus.INVESTIGATING
        complaint.state = ComplaintState.UNDER_INVESTIGATION
        reason = "Reopened by victim"
        action = "victim_reopened"

    # Stop the timer
    complaint.victim_confirmation_deadline = None
    complaint.updated_at = now

    hist = models.ComplaintStatusHistory(
        complaint_id=complaint.id,
        status=complaint.status,
        changed_by_id=victim.id,
        reason=reason,
    )
    db.add(hist)

    # Add to timeline using helper function
    _add_timeline(
        db,
        complaint,
        ComplaintState.RESOLVED_PENDING_CONFIRMATION,
        complaint.state,
        victim,
        payload.feedback or reason,
    )

    # Update Case if exists
    if complaint.case:
        complaint.case.last_state = complaint.state
        complaint.case.last_update = now

    db.commit()

    audit.log_action(
        db,
        victim,
        action=action,
        entity_type="complaint",
        entity_id=complaint.id,
        meta={"complaint_id": complaint.complaint_id},
    )

    return {"status": complaint.status.value}


# ---------- Victim complaint summary/stats ----------

@router.get("/complaints/summary", response_model=Dict[str, Any])
def victim_complaints_summary(
    db: Session = Depends(get_db),
    victim: models.User = Depends(get_victim),
):
    total = (
        db.query(func.count(models.Complaint.id))
        .filter(models.Complaint.victim_id == victim.id)
        .scalar()
        or 0
    )

    rows = (
        db.query(models.Complaint.status, func.count(models.Complaint.id))
        .filter(models.Complaint.victim_id == victim.id)
        .group_by(models.Complaint.status)
        .all()
    )

    by_status = {status.value: count for status, count in rows}
    return {"total": total, "by_status": by_status}
