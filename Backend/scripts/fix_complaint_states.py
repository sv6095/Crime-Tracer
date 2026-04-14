
import sqlite3

DB_PATH = "d:/Hack Crate/Backend/crime_tracer_v2.db"

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

print("=== MOVING FILED COMPLAINTS TO STATION_POOL ===\n")

# Find all FILED complaints
cursor.execute("""
    SELECT complaint_id, station_id, status, state
    FROM complaints
    WHERE state = 'FILED'
""")

complaints = cursor.fetchall()
print(f"Found {len(complaints)} complaints in FILED state")

for c in complaints:
    print(f"  {c[0]}: {c[2]} / {c[3]} → STATION_POOL")
    cursor.execute("""
        UPDATE complaints
        SET state = 'STATION_POOL'
        WHERE complaint_id = ?
    """, (c[0],))

conn.commit()
print(f"\n✓ Updated {len(complaints)} complaints to STATION_POOL state")
conn.close()
