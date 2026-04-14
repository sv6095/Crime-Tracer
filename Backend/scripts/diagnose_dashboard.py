
import sqlite3

DB_PATH = "d:/Hack Crate/Backend/crime_tracer_v2.db"

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

print("=== CURRENT STATE ===\n")

# 1. Check the complaint
cursor.execute("""
    SELECT complaint_id, station_id, status, state
    FROM complaints 
    WHERE complaint_id = 'CTM-20251222-000004'
""")
complaint = cursor.fetchone()

if complaint:
    print(f"Complaint: {complaint[0]}")
    print(f"  Station: {complaint[1]}")
    print(f"  Status: {complaint[2]}")
    print(f"  State: {complaint[3]}")
    
    comp_station = complaint[1]
    comp_status = complaint[2]
    
    # 2. Check ALL cops and their stations
    print("\n=== ALL COPS ===")
    cursor.execute("""
        SELECT username, name, station_id, is_active, pending_approval
        FROM users 
        WHERE role = 'COP'
        ORDER BY username
    """)
    cops = cursor.fetchall()
    
    for cop in cops:
        match = "✓ MATCH" if cop[2] == comp_station else "✗ different"
        active = "ACTIVE" if cop[3] else "INACTIVE"
        pending = "PENDING" if cop[4] else "APPROVED"
        print(f"  {cop[0]}: station={cop[2]} [{active}, {pending}] {match}")
    
    # 3. Check what the API query would return
    print(f"\n=== SIMULATING API QUERY ===")
    print(f"Looking for complaints where:")
    print(f"  - station_id = '{comp_station}'")
    print(f"  - status = 'NOT_ASSIGNED' (for 'Filed' filter)")
    
    cursor.execute("""
        SELECT complaint_id, status, state
        FROM complaints
        WHERE station_id = ? AND status = 'NOT_ASSIGNED'
        ORDER BY created_at DESC
    """, (comp_station,))
    
    results = cursor.fetchall()
    print(f"\nResults: {len(results)} complaints")
    for r in results:
        print(f"  - {r[0]}: status={r[1]}, state={r[2]}")
    
    # 4. Check if there are cops at this station who are ACTIVE and APPROVED
    cursor.execute("""
        SELECT COUNT(*)
        FROM users
        WHERE role = 'COP' 
        AND station_id = ?
        AND is_active = 1
        AND pending_approval = 0
    """, (comp_station,))
    
    active_cops = cursor.fetchone()[0]
    print(f"\n=== STATION READINESS ===")
    print(f"Active & Approved cops at {comp_station}: {active_cops}")
    
else:
    print("Complaint not found!")

conn.close()
