
import sqlite3

DB_PATH = "d:/Hack Crate/Backend/crime_tracer_v2.db"

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

print("=== VERIFICATION ===\n")

# Check the specific complaint
cursor.execute("""
    SELECT c.complaint_id, c.station_id, c.status, s.name 
    FROM complaints c
    JOIN stations s ON c.station_id = s.id
    WHERE c.complaint_id = 'CTM-20251222-000004'
""")
complaint = cursor.fetchone()

if complaint:
    print(f"Complaint: {complaint[0]}")
    print(f"Station ID: {complaint[1]}")
    print(f"Station Name: {complaint[3]}")
    print(f"Status: {complaint[2]}")
    
    # Check cops at this station
    cursor.execute("""
        SELECT u.username, u.name
        FROM users u
        WHERE u.station_id = ? AND u.role = 'COP'
    """, (complaint[1],))
    
    cops = cursor.fetchall()
    print(f"\nCops at {complaint[3]}:")
    for cop in cops:
        print(f"  - {cop[1]} (@{cop[0]})")
    
    if cops:
        print(f"\n✓ Complaint should now be visible to these {len(cops)} cop(s)")
    else:
        print("\n✗ No cops assigned to this station yet")
else:
    print("Complaint not found")

conn.close()
