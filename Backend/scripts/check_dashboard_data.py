
import sqlite3

DB_PATH = "d:/Hack Crate/Backend/crime_tracer_v2.db"

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

print("=== DIAGNOSTIC CHECK ===\n")

# 1. Check most recent cop login
cursor.execute("""
    SELECT id, username, name, station_id, is_active, pending_approval
    FROM users
    WHERE role = 'COP'
    ORDER BY id DESC
    LIMIT 3
""")

print("Recent Cops:")
cops = cursor.fetchall()
for cop in cops:
    print(f"  ID: {cop[0]}, Username: {cop[1]}, Name: {cop[2]}")
    print(f"  Station: {cop[3]}")
    print(f"  Active: {cop[4]}, Pending: {cop[5]}")
    
    # Check complaints at this station
    if cop[3]:
        cursor.execute("""
            SELECT complaint_id, status, state
            FROM complaints
            WHERE station_id = ?
            ORDER BY created_at DESC
        """, (cop[3],))
        
        comps = cursor.fetchall()
        print(f"  Complaints at {cop[3]}: {len(comps)}")
        for c in comps:
            print(f"    - {c[0]}: status={c[1]}, state={c[2]}")
    print()

# 2. Check all complaints by station
print("\n=== ALL COMPLAINTS BY STATION ===")
cursor.execute("""
    SELECT station_id, COUNT(*) as count
    FROM complaints
    GROUP BY station_id
    ORDER BY count DESC
""")

for row in cursor.fetchall():
    print(f"  {row[0]}: {row[1]} complaints")

conn.close()
