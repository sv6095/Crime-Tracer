from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from sqlalchemy.orm import Session
import uuid
import os
from . import schemas, crud, models
from .db import get_db
from .deps import get_current_user
from ..utils import ensure_upload_dir
from .services.grok_client import generate_precautions

router = APIRouter(prefix="/complaints", tags=["complaints"])

@router.post("", response_model=schemas.VictimComplaintOut)
def create_complaint(comp_in: schemas.VictimComplaintCreate, db: Session = Depends(get_db)):
    exist = crud.get_complaint(db, comp_in.complaint_id)
    if exist:
        raise HTTPException(status_code=400, detail="Complaint exists")
    obj = crud.create_complaint(db, comp_in)
    # create case row
    case_id = str(uuid.uuid4())
    crud.create_case(db, schemas.CaseCreate(case_id=case_id, complaint_id=comp_in.complaint_id))
    return obj

@router.get("", response_model=list[schemas.VictimComplaintOut])
def list_complaints(skip:int=0, limit:int=100, db: Session = Depends(get_db)):
    return crud.list_complaints(db, skip, limit)

@router.get("/{complaint_id}", response_model=schemas.VictimComplaintOut)
def get_complaint(complaint_id: str, db: Session = Depends(get_db)):
    c = crud.get_complaint(db, complaint_id)
    if not c:
        raise HTTPException(status_code=404, detail="Not found")
    return c

@router.post("/{complaint_id}/upload")
def upload_evidence(complaint_id: str, file: UploadFile = File(...)):
    # simple local store
    d = ensure_upload_dir()
    filename = f"{complaint_id}_{uuid.uuid4().hex}_{file.filename}"
    path = os.path.join(d, filename)
    with open(path, "wb") as f:
        f.write(file.file.read())
    # In production, return pre-signed S3 URL instead and store metadata in DB
    return {"uploaded": True, "path": path}

@router.post("/precautions")
def precautions(req: schemas.PredictRequest):
    out = generate_precautions(req.crime_type or "unknown", req.complaint_text or "")
    return {"precautions": out.get("precautions"), "raw": out.get("raw")}
