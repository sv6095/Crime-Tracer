# app/routers/cop_profile.py
from typing import List, Dict, Any
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .db import get_db
from . import models
from .deps import get_cop
from .schemas import TransferRequestCreate
from .services import audit

router = APIRouter()


@router.get("/me/transfer-requests", response_model=List[Dict[str, Any]])
def list_my_transfer_requests(
    db: Session = Depends(get_db),
    cop: models.User = Depends(get_cop),
):
    reqs = (
        db.query(models.CopTransferRequest)
        .filter(models.CopTransferRequest.cop_id == cop.id)
        .order_by(models.CopTransferRequest.created_at.desc())
        .all()
    )

    out: List[Dict[str, Any]] = []
    for r in reqs:
        out.append(
            {
                "id": r.id,
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


@router.post("/me/transfer-requests", response_model=Dict[str, Any])
def create_transfer_request(
    payload: TransferRequestCreate,
    db: Session = Depends(get_db),
    cop: models.User = Depends(get_cop),
):
    if not cop.station_id:
        raise HTTPException(
            status_code=400,
            detail="You are not currently assigned to any station",
        )

    if payload.to_station_id == cop.station_id:
        raise HTTPException(
            status_code=400,
            detail="Target station must be different from current station",
        )

    # Check target station exists
    to_station = (
        db.query(models.Station)
        .filter(models.Station.id == payload.to_station_id)
        .first()
    )
    if not to_station:
        raise HTTPException(status_code=404, detail="Target station not found")

    # Only one pending transfer at a time
    existing_pending = (
        db.query(models.CopTransferRequest)
        .filter(
            models.CopTransferRequest.cop_id == cop.id,
            models.CopTransferRequest.status == "pending",
        )
        .first()
    )
    if existing_pending:
        raise HTTPException(
            status_code=400,
            detail="You already have a pending transfer request",
        )

    req = models.CopTransferRequest(
        cop_id=cop.id,
        from_station_id=cop.station_id,
        to_station_id=payload.to_station_id,
        status="pending",
        created_at=datetime.utcnow(),
    )
    db.add(req)
    db.commit()
    db.refresh(req)

    audit.log_action(
        db,
        cop,
        action="transfer_request_created",
        entity_type="cop_transfer_request",
        entity_id=req.id,
        meta={
            "from_station_id": req.from_station_id,
            "to_station_id": req.to_station_id,
        },
    )

    return {
        "id": req.id,
        "status": req.status,
        "from_station_id": req.from_station_id,
        "to_station_id": req.to_station_id,
    }
