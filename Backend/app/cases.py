# app/cases.py
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from .db import get_db
from . import models, schemas
from .deps import get_cop, get_admin
from .services import audit
from .constants import ComplaintState, DEFAULT_REJECTION_QUORUM, VICTIM_CONFIRMATION_WINDOW_HOURS
from .state_machine import validate_transition

router = APIRouter()


# -------------------------------------------------
# Helpers
# -------------------------------------------------

def _complaint_for_cop(complaint_id: str, db: Session, cop: models.User) -> models.Complaint:
    complaint = (
        db.query(models.Complaint)
        .filter(models.Complaint.complaint_id == complaint_id)
        .first()
    )
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    if complaint.station_id != cop.station_id:
        raise HTTPException(status_code=403, detail="Not allowed for this station")

    return complaint


def _add_timeline(db, complaint, from_state, to_state, actor, reason=None, meta=None):
    """Add an entry to the immutable complaint timeline."""
    timeline_entry = models.ComplaintTimeline(
        complaint_id=complaint.id,
        from_state=from_state,
        to_state=to_state,
        actor_role=actor.role.value.lower() if hasattr(actor, 'role') and hasattr(actor.role, 'value') else str(actor.role).lower(),
        actor_id=actor.id if hasattr(actor, 'id') else None,
        reason=reason,
        meta=meta or {},
    )
    db.add(timeline_entry)
    db.flush()  # Ensure the entry is persisted


# -------------------------------------------------
# Lists
# -------------------------------------------------

@router.get("/unassigned", response_model=List[schemas.CaseListItem])
def list_unassigned(
    db: Session = Depends(get_db),
    cop: models.User = Depends(get_cop),
):
    complaints = (
        db.query(models.Complaint)
        .filter(
            models.Complaint.station_id == cop.station_id,
            models.Complaint.state == ComplaintState.STATION_POOL,
        )
        .order_by(models.Complaint.created_at.asc())
        .all()
    )

    return [
        schemas.CaseListItem(
            complaint_id=c.complaint_id,
            status=c.status.value,
            state=c.state,
            crime_type=c.crime_type,
            created_at=c.created_at,
            station_id=c.station_id,
        )
        for c in complaints
    ]


@router.get("/station-complaints", response_model=List[schemas.CaseDetailOut])
def list_station_complaints(
    status_filter: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
    cop: models.User = Depends(get_cop),
):
    print(f"DEBUG: list_station_complaints called")
    print(f"  Cop ID: {cop.id}, Username: {cop.username}, Name: {cop.name}")
    print(f"  Cop Station: {cop.station_id}")
    print(f"  Status Filter: {status_filter}")
    
    query = db.query(models.Complaint).filter(models.Complaint.station_id == cop.station_id)

    if status_filter and status_filter.lower() != "all":
        # Map frontend "Filed" to "NOT_ASSIGNED"
        if status_filter == "Filed":
             # Backend uses NOT_ASSIGNED for 'Filed'
             query = query.filter(models.Complaint.status == models.ComplaintStatus.NOT_ASSIGNED)
             print(f"  Filtering by status: NOT_ASSIGNED")
        elif status_filter == "Assigned":
             # "Assigned" usually implies INVESTIGATING or just assigned in general. 
             # Frontend logic usually tabs "assigned" separately. This filter might be strict.
             query = query.filter(models.Complaint.status == models.ComplaintStatus.INVESTIGATING)
             print(f"  Filtering by status: INVESTIGATING")
        else:
             # Try exact match for Resolved, Closed, etc.
             try:
                 # Ensure upper case matching for Enum
                 s_enum = models.ComplaintStatus(status_filter.upper())
                 query = query.filter(models.Complaint.status == s_enum)
                 print(f"  Filtering by status: {s_enum}")
             except Exception:
                 pass

    complaints = query.order_by(models.Complaint.created_at.desc()).offset(offset).limit(limit).all()
    print(f"DEBUG: Found {len(complaints)} complaints")
    for cp in complaints:
        print(f"DEBUG: Complaint {cp.complaint_id} | Status: {cp.status}")

    out = []
    for c in complaints:
        cop_name = c.case.assigned_officer.name if (c.case and c.case.assigned_officer) else None
        cop_id = c.case.assigned_officer_id if c.case else None
        
        # Build pydantic object
        out.append(schemas.CaseDetailOut(
            id=c.id,  # Include integer ID
            complaint_id=c.complaint_id,
            crime_type=c.crime_type,
            description=c.description,
            status=c.status.value,
            created_at=c.created_at,
            updated_at=c.updated_at,
            victim_name=c.victim.name if c.victim else "Unknown",
            victim_phone=c.victim.phone if c.victim else None,
            assigned_cop_name=cop_name,
            assigned_police_id=cop_id,
            location_text=c.location_text,
            location_lat=c.location_lat,
            location_lng=c.location_lng,
            predicted_severity=c.predicted_severity,
            bns_sections=c.bns_sections,
            llm_summary=c.summary,
            officer_summary=c.officer_summary,  # Police case brief
            precautions=c.precautions,
            evidence=[schemas.EvidenceOut.model_validate(e) for e in c.evidence] if c.evidence else []
        ))
    return out


@router.get("/admin/all-complaints", response_model=List[schemas.CaseDetailOut])
def list_all_complaints_admin(
    status_filter: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_admin),
):
    """
    Admin endpoint to fetch all complaints across all stations with cop assignments.
    """
    query = db.query(models.Complaint)

    if status_filter and status_filter.lower() != "all":
        if status_filter == "Filed":
            query = query.filter(models.Complaint.status == models.ComplaintStatus.NOT_ASSIGNED)
        elif status_filter == "Assigned":
            query = query.filter(models.Complaint.status == models.ComplaintStatus.INVESTIGATING)
        else:
            try:
                s_enum = models.ComplaintStatus(status_filter.upper())
                query = query.filter(models.Complaint.status == s_enum)
            except Exception:
                pass

    complaints = query.order_by(models.Complaint.created_at.desc()).offset(offset).limit(limit).all()

    out = []
    for c in complaints:
        cop_name = c.case.assigned_officer.name if (c.case and c.case.assigned_officer) else None
        cop_id = c.case.assigned_officer_id if c.case else None
        cop_station = c.case.assigned_officer.station.name if (c.case and c.case.assigned_officer and c.case.assigned_officer.station) else None
        
        out.append(schemas.CaseDetailOut(
            id=c.id,  # Include integer ID
            complaint_id=c.complaint_id,
            crime_type=c.crime_type,
            description=c.description,
            status=c.status.value,
            created_at=c.created_at,
            updated_at=c.updated_at,
            victim_name=c.victim.name if c.victim else "Unknown",
            victim_phone=c.victim.phone if c.victim else None,
            station_name=c.station.name if c.station else None,
            assigned_cop_name=cop_name,
            assigned_cop_station=cop_station,
            assigned_police_id=cop_id,
            location_text=c.location_text,
            location_lat=c.location_lat,
            location_lng=c.location_lng,
            predicted_severity=c.predicted_severity,
            bns_sections=c.bns_sections,
            llm_summary=c.summary,
            officer_summary=c.officer_summary,
            precautions=c.precautions,
            evidence=[schemas.EvidenceOut.model_validate(e) for e in c.evidence] if c.evidence else [],
        ))
    return out


@router.get("/my", response_model=List[schemas.CaseListItem])
def list_my_cases(
    db: Session = Depends(get_db),
    cop: models.User = Depends(get_cop),
):
    cases = (
        db.query(models.Case)
        .join(models.Complaint)
        .filter(models.Case.assigned_officer_id == cop.id)
        .order_by(models.Case.last_update.desc())
        .all()
    )

    return [
        schemas.CaseListItem(
            complaint_id=case.complaint.complaint_id,
            status=case.complaint.status.value,
            state=case.complaint.state,
            crime_type=case.complaint.crime_type,
            created_at=case.complaint.created_at,
            station_id=case.complaint.station_id,
        )
        for case in cases
    ]


@router.get("/{complaint_id}", response_model=schemas.CaseDetailOut)
def get_complaint_by_id(
    complaint_id: str,
    db: Session = Depends(get_db),
    cop: models.User = Depends(get_cop),
):
    """Get complaint details by complaint_id for police officers."""
    complaint = (
        db.query(models.Complaint)
        .filter(models.Complaint.complaint_id == complaint_id)
        .first()
    )
    
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
    
    # Check access - must be from same station or admin
    if cop.role != models.UserRole.ADMIN:
        if complaint.station_id != cop.station_id:
            raise HTTPException(status_code=403, detail="Not authorized to access this complaint")
    
    # Get assigned officer info
    cop_name = None
    cop_id = None
    cop_station = None
    if complaint.case and complaint.case.assigned_officer:
        cop_name = complaint.case.assigned_officer.name
        cop_id = complaint.case.assigned_officer_id
        if complaint.case.assigned_officer.station:
            cop_station = complaint.case.assigned_officer.station.name
    
    # Allow viewing case details for all cases from same station
    # Investigation platform features (diary, changes, patterns) are restricted to assigned cases
    # This is handled at the frontend level
    
    return schemas.CaseDetailOut(
        id=complaint.id,  # Include integer ID for investigation platform
        complaint_id=complaint.complaint_id,
        crime_type=complaint.crime_type,
        description=complaint.description,
        status=complaint.status.value,
        created_at=complaint.created_at,
        updated_at=complaint.updated_at,
        victim_name=complaint.victim.name if complaint.victim else "Unknown",
        victim_phone=complaint.victim.phone if complaint.victim else None,
        station_name=complaint.station.name if complaint.station else None,
        assigned_cop_name=cop_name,
        assigned_cop_station=cop_station,
        assigned_police_id=cop_id,
        location_text=complaint.location_text,
        location_lat=complaint.location_lat,
        location_lng=complaint.location_lng,
        predicted_severity=complaint.predicted_severity,
        bns_sections=complaint.bns_sections,
        llm_summary=complaint.summary,
        officer_summary=complaint.officer_summary,
        precautions=complaint.precautions,
        evidence=[schemas.EvidenceOut.model_validate(e) for e in complaint.evidence] if complaint.evidence else [],
    )


# -------------------------------------------------
# Assign / Reject (ATOMIC)
# -------------------------------------------------

@router.post("/assign", response_model=Dict[str, Any])
def assign_case_to_self(
    payload: schemas.AssignCaseRequest,
    db: Session = Depends(get_db),
    cop: models.User = Depends(get_cop),
):
    complaint = _complaint_for_cop(payload.complaint_id, db, cop)
    case = db.query(models.Case).filter_by(complaint_id=complaint.id).first()

    if case.assigned_officer_id is not None:
        raise HTTPException(status_code=400, detail="Already assigned")

    try:
        print(f"DEBUG: Attempting transition from {complaint.state} to UNDER_INVESTIGATION")
        validate_transition(complaint.state, ComplaintState.UNDER_INVESTIGATION)
    except ValueError as e:
        print(f"DEBUG: Transition validation failed: {e}")
        raise HTTPException(status_code=400, detail=str(e))

    now = datetime.utcnow()

    case.assigned_officer_id = cop.id
    case.last_state = ComplaintState.UNDER_INVESTIGATION
    case.last_update = now

    _add_timeline(
        db,
        complaint,
        complaint.state,
        ComplaintState.UNDER_INVESTIGATION,
        cop,
        "Case accepted by officer",
    )

    complaint.state = ComplaintState.UNDER_INVESTIGATION
    complaint.status = models.ComplaintStatus.INVESTIGATING
    complaint.updated_at = now

    db.commit()

    audit.log_action(
        db,
        cop,
        "case_assigned",
        "complaint",
        complaint.id,
        {"complaint_id": complaint.complaint_id},
    )

    return {"status": complaint.status.value}


@router.post("/reject", response_model=Dict[str, Any])
def reject_case(
    payload: schemas.RejectCaseRequest,
    db: Session = Depends(get_db),
    cop: models.User = Depends(get_cop),
):
    complaint = _complaint_for_cop(payload.complaint_id, db, cop)
    case = db.query(models.Case).filter_by(complaint_id=complaint.id).first()

    if case.assigned_officer_id is not None:
        raise HTTPException(status_code=400, detail="Already assigned")

    case.rejection_count += 1
    case.last_update = datetime.utcnow()

    _add_timeline(
        db,
        complaint,
        complaint.state,
        complaint.state,
        cop,
        payload.reason or "Rejected by officer",
        {"rejection_count": case.rejection_count},
    )

    auto_archived = False
    if case.rejection_count >= DEFAULT_REJECTION_QUORUM:
        validate_transition(complaint.state, ComplaintState.ARCHIVED)

        _add_timeline(
            db,
            complaint,
            complaint.state,
            ComplaintState.ARCHIVED,
            cop,
            "Auto-archived after rejection quorum",
        )

        complaint.state = ComplaintState.ARCHIVED
        complaint.status = models.ComplaintStatus.REJECTED
        complaint.archived_at = datetime.utcnow()
        auto_archived = True

    db.commit()

    return {
        "rejection_count": case.rejection_count,
        "auto_archived": auto_archived,
        "status": complaint.status.value,
    }


# -------------------------------------------------
# Status Updates
# -------------------------------------------------

@router.post("/status", response_model=Dict[str, Any])
def update_status(
    payload: schemas.StatusUpdateRequest,
    db: Session = Depends(get_db),
    cop: models.User = Depends(get_cop),
):
    complaint = _complaint_for_cop(payload.complaint_id, db, cop)
    case = db.query(models.Case).filter_by(complaint_id=complaint.id).first()

    # Create Case record if it doesn't exist (for assigned complaints)
    if not case:
        if complaint.status == models.ComplaintStatus.INVESTIGATING:
            # Case record doesn't exist but complaint is INVESTIGATING - create it
            case = models.Case(
                complaint_id=complaint.id,
                assigned_officer_id=cop.id,
                last_state=complaint.state,
            )
            db.add(case)
            db.flush()  # Flush to get the case ID
        else:
            # For non-INVESTIGATING complaints, check station access
            if complaint.station_id != cop.station_id and cop.role != models.UserRole.ADMIN:
                raise HTTPException(status_code=403, detail="Not authorized to update this case")
    
    # Check if case is assigned to this cop (if case exists and has assignment)
    if case and case.assigned_officer_id and case.assigned_officer_id != cop.id:
        raise HTTPException(status_code=403, detail="Not assigned to you")

    frontend_status = payload.new_status
    target_state = None
    
    # Map frontend status string to Backend State Enum
    if frontend_status == "Investigating":
        target_state = ComplaintState.UNDER_INVESTIGATION
    elif frontend_status == "Resolved":
        target_state = ComplaintState.RESOLVED_PENDING_CONFIRMATION
    elif frontend_status == "Closed":
        target_state = ComplaintState.CLOSED
    elif frontend_status == "Archived":
        target_state = ComplaintState.ARCHIVED
    else:
        # Fallback – try to match enum name directly? 
        # Or just Error out.
        try:
             target_state = ComplaintState(frontend_status)
        except ValueError:
             raise HTTPException(status_code=400, detail=f"Invalid status: {frontend_status}")

    if not target_state:
        raise HTTPException(status_code=400, detail="Invalid target state")

    validate_transition(complaint.state, target_state)

    now = datetime.utcnow()

    _add_timeline(
        db,
        complaint,
        complaint.state,
        target_state,
        cop,
        payload.reason or "Status updated by officer",
    )

    complaint.state = target_state
    complaint.updated_at = now

    if target_state == ComplaintState.RESOLVED_PENDING_CONFIRMATION:
        complaint.status = models.ComplaintStatus.RESOLVED
        complaint.resolved_at = now
        complaint.victim_confirmation_deadline = now + timedelta(hours=VICTIM_CONFIRMATION_WINDOW_HOURS)
    elif target_state == ComplaintState.CLOSED:
        complaint.status = models.ComplaintStatus.CLOSED
        complaint.closed_at = now

    # Update Case record if it exists, otherwise create it
    if case:
        case.last_state = target_state
        case.last_update = now
    else:
        # Create Case record if it doesn't exist (shouldn't happen but handle gracefully)
        case = models.Case(
            complaint_id=complaint.id,
            assigned_officer_id=cop.id if complaint.status == models.ComplaintStatus.INVESTIGATING else None,
            last_state=target_state,
        )
        db.add(case)

    db.commit()

    return {"state": complaint.state.value}
