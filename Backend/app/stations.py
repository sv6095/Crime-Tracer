# app/routers/stations.py
from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .db import get_db
from . import models
from .schemas import StationOut

router = APIRouter()


@router.get("/", response_model=List[StationOut])
def list_stations(db: Session = Depends(get_db)):
    stations = db.query(models.Station).order_by(models.Station.name.asc()).all()
    return stations
