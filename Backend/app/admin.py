# app/admin.py
from datetime import datetime
from typing import List, Dict, Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from .db import get_db
from . import models
from .deps import get_admin
from .schemas import CopApprovalOut, CopApproveRequest, TransferRequestUpdate
from .services import audit

router = APIRouter()


# ---------- Cop Approvals ----------

@router.get("/cops/pending", response_model=List[CopApprovalOut])
def list_pending_cops(
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_admin),
):
    cops = (
        db.query(models.User)
        .filter(
            models.User.role == models.UserRole.COP,
            models.User.pending_approval == True,  # noqa
        )
        .all()
    )

    out: List[CopApprovalOut] = []
    for c in cops:
        out.append(
            CopApprovalOut(
                id=c.id,
                name=c.name,
                username=c.username or "",
                badge_number=c.badge_number,
                station=c.station.name if c.station else None,
            )
        )
    return out


@router.post("/cops/approve", response_model=Dict[str, Any])
def approve_or_reject_cop(
    payload: CopApproveRequest,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_admin),
):
    user = db.query(models.User).filter(models.User.id == payload.user_id).first()
    if not user or user.role != models.UserRole.COP:
        raise HTTPException(status_code=404, detail="Cop not found")

    if payload.approve:
        user.pending_approval = False
        user.is_active = True
        action = "approved"
    else:
        user.pending_approval = False
        user.is_active = False
        action = "rejected"

    db.commit()

    audit.log_action(
        db,
        admin,
        action="cop_approval_decided",
        entity_type="user",
        entity_id=user.id,
        meta={"result": action},
    )

    return {"user_id": user.id, "action": action}


# ---------- Transfers ----------

@router.get("/cops/transfers/pending", response_model=List[Dict[str, Any]])
def list_pending_transfers(
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_admin),
):
    reqs = (
        db.query(models.CopTransferRequest)
        .filter(models.CopTransferRequest.status == "pending")
        .all()
    )

    out: List[Dict[str, Any]] = []
    for r in reqs:
        out.append(
            {
                "id": r.id,
                "cop_id": r.cop_id,
                "cop_name": r.cop.name if r.cop else None,
                "from_station_id": r.from_station_id,
                "from_station_name": r.from_station.name if r.from_station else None,
                "to_station_id": r.to_station_id,
                "to_station_name": r.to_station.name if r.to_station else None,
                "status": r.status,
                "created_at": r.created_at,
                "decided_at": r.decided_at,
            }
        )
    return out


@router.post("/cops/transfers/decide", response_model=Dict[str, Any])
def decide_transfer(
    payload: TransferRequestUpdate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_admin),
):
    req = (
        db.query(models.CopTransferRequest)
        .filter(models.CopTransferRequest.id == payload.request_id)
        .first()
    )
    if not req:
        raise HTTPException(status_code=404, detail="Transfer request not found")

    if req.status != "pending":
        raise HTTPException(status_code=400, detail="Request already decided")

    cop = db.query(models.User).filter(models.User.id == req.cop_id).first()
    if not cop or cop.role != models.UserRole.COP:
        raise HTTPException(status_code=404, detail="Cop not found")

    if payload.approve:
        cop.station_id = req.to_station_id
        req.status = "approved"
        action = "approved"
    else:
        req.status = "rejected"
        action = "rejected"

    req.decided_at = datetime.utcnow()
    db.commit()

    audit.log_action(
        db,
        admin,
        action="transfer_decided",
        entity_type="cop_transfer_request",
        entity_id=req.id,
        meta={"result": action},
    )

    return {"request_id": req.id, "action": action}


# ---------- Admin-level Stats ----------

@router.get("/complaints/summary")
def complaints_summary(
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_admin),
):
    total = db.query(func.count(models.Complaint.id)).scalar() or 0
    status_rows = (
        db.query(models.Complaint.status, func.count(models.Complaint.id))
        .group_by(models.Complaint.status)
        .all()
    )
    by_status = {status.value: count for status, count in status_rows}

    station_rows = (
        db.query(models.Complaint.station_id, func.count(models.Complaint.id))
        .group_by(models.Complaint.station_id)
        .all()
    )
    by_station = {sid: count for sid, count in station_rows}

    return {
        "total": total,
        "by_status": by_status,
        "by_station": by_station,
    }

# ---------- User Management ----------

@router.get("/users", response_model=List[CopApprovalOut])
def list_all_users(
    limit: int = 100,
    offset: int = 0,
    approved: bool = None,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_admin),
):
    query = db.query(models.User)
    
    if approved is not None:
        if approved:
            query = query.filter(models.User.pending_approval == False, models.User.is_active == True)
        else:
            query = query.filter(models.User.pending_approval == True)
            
    users = query.offset(offset).limit(limit).all()
    
    out: List[CopApprovalOut] = []
    for u in users:
        out.append(CopApprovalOut(
            id=u.id,
            name=u.name,
            username=u.username or "",
            badge_number=u.badge_number,
            station=u.station.name if u.station else None,
            # Add implicit roles/etc if needed but schema restricts
        ))
    return out
