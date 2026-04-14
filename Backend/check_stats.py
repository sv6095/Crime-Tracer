from app.db import SessionLocal
from app.models import Station, Complaint
from datetime import datetime, timedelta

db = SessionLocal()

print("--- Stations ---")
stations = db.query(Station).all()
mulki_id = None
for s in stations:
    print(f"ID: {s.id} | Name: {s.name}")
    if "Mulki" in s.name:
        mulki_id = s.id

print(f"\nMulki ID found: {mulki_id}")

print("\n--- Complaints ---")
complaints = db.query(Complaint).all()
print(f"Total Complaints (Global): {len(complaints)}")

if mulki_id:
    print(f"\nChecking Mulki Stats (ID: {mulki_id})")
    
    # Check all time
    c_all = db.query(Complaint).filter(Complaint.station_id == mulki_id).all()
    print(f"Total Mulki Complaints (All Time): {len(c_all)}")
    for c in c_all:
        print(f"  - {c.complaint_id} | Created: {c.created_at} | Status: {c.status}")

    # Check 30 days
    cutoff = datetime.utcnow() - timedelta(days=30)
    print(f"\nCutoff Date (30 days ago): {cutoff}")
    c_recent = db.query(Complaint).filter(Complaint.station_id == mulki_id, Complaint.created_at >= cutoff).all()
    print(f"Total Mulki Complaints (Last 30 Days): {len(c_recent)}")
else:
    print("Mulki Station not found in DB.")

db.close()
