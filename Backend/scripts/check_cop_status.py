
import sqlite3

DB_PATH = "d:/Hack Crate/Backend/crime_tracer_v2.db"

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

# Find the cop that's likely logged in (most recent or named 'eathen')
cursor.execute("""
    SELECT id, username, name, station_id, is_active, pending_approval
    FROM users
    WHERE role = 'COP'
    ORDER BY created_at DESC
    LIMIT 5
""")

print("=== RECENT COPS ===")
cops = cursor.fetchall()
for cop in cops:
    status = []
    if not cop[4]:
        status.append("INACTIVE")
    if cop[5]:
        status.append("PENDING_APPROVAL")
    if not status:
        status.append("ACTIVE & APPROVED")
    
    print(f"\n{cop[1]} ({cop[2]})")
    print(f"  ID: {cop[0]}")
    print(f"  Station: {cop[3]}")
    print(f"  Status: {', '.join(status)}")
    
    # Check complaints at this cop's station
    if cop[3]:
        cursor.execute("""
            SELECT COUNT(*)
            FROM complaints
            WHERE station_id = ? AND status = 'NOT_ASSIGNED'
        """, (cop[3],))
        count = cursor.fetchone()[0]
        print(f"  Available complaints: {count}")

conn.close()
