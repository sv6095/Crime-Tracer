from app.db import SessionLocal
from app import models

db = SessionLocal()

# 1. Find the cop
cop_name_part = "eathen"
cop = db.query(models.User).filter(models.User.name.ilike(f"%{cop_name_part}%")).first()

if not cop:
    print(f"Cop '{cop_name_part}' not found.")
else:
    print(f"Cop Found: {cop.name} (ID: {cop.id})")
    print(f"Cop Station ID: {cop.station_id}")
    
    # 2. Check complaints for this station
    complaints = db.query(models.Complaint).filter(models.Complaint.station_id == cop.station_id).all()
    print(f"Total Complaints for Station '{cop.station_id}': {len(complaints)}")
    
    for c in complaints:
        print(f" - ID: {c.complaint_id}, Status: {c.status}, State: {c.state}, Station: {c.station_id}")

    # 3. Check what frontend "Filed" filter does
    # Frontend sends status="Filed", backend converts to NOT_ASSIGNED
    filtered = db.query(models.Complaint).filter(
        models.Complaint.station_id == cop.station_id,
        models.Complaint.status == models.ComplaintStatus.NOT_ASSIGNED
    ).all()
    print(f"Complaints matching 'Filed' (NOT_ASSIGNED): {len(filtered)}")

db.close()
