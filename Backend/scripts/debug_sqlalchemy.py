
import sys
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Add app to path
sys.path.append("d:/Hack Crate/Backend")

from app import models

DB_URL = "sqlite:///d:/Hack Crate/Backend/crime_tracer_v2.db"

def test_query():
    engine = create_engine(DB_URL)
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()

    station_id = "ka-suratkal-police-station"
    status_filter = "Filed"

    print(f"Querying for Station: {station_id}, Filter: {status_filter}")

    query = db.query(models.Complaint).filter(models.Complaint.station_id == station_id)

    if status_filter == "Filed":
        print("Applying 'Filed' filter (status == NOT_ASSIGNED)")
        # query = query.filter(models.Complaint.status == models.ComplaintStatus.NOT_ASSIGNED)
    
    complaints = query.order_by(models.Complaint.created_at.desc()).all()

    print(f"Found {len(complaints)} complaints.")
    for c in complaints:
        print(f"ID: {c.complaint_id}, Status: {c.status}")

    db.close()

if __name__ == "__main__":
    test_query()
