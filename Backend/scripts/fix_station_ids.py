
import sqlite3

DB_PATH = "d:/Hack Crate/Backend/crime_tracer_v2.db"

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

print("=== CHECKING FOR STATION MISMATCHES ===\n")

# Get all unique station IDs from users table
cursor.execute("SELECT DISTINCT station_id FROM users WHERE station_id IS NOT NULL ORDER BY station_id")
user_stations = [row[0] for row in cursor.fetchall()]

# Get all station IDs from stations table
cursor.execute("SELECT id FROM stations ORDER BY id")
valid_stations = [row[0] for row in cursor.fetchall()]

print("Station IDs referenced by users:")
for s in user_stations:
    exists = s in valid_stations
    status = "✓ EXISTS" if exists else "✗ MISSING"
    print(f"  {status}: {s}")

print("\n" + "="*60)
print("\n=== FIXING MISMATCHES ===\n")

# Common fixes
fixes = {
    "ka-suratkal-police-station": "surathkal-police-station",
    "ka-mulki-police-station": "mulki-police-station",
}

for old_id, new_id in fixes.items():
    # Check if old_id exists in users
    cursor.execute("SELECT COUNT(*) FROM users WHERE station_id = ?", (old_id,))
    count = cursor.fetchone()[0]
    
    if count > 0:
        print(f"Found {count} users with station_id '{old_id}'")
        print(f"  → Updating to '{new_id}'")
        cursor.execute("UPDATE users SET station_id = ? WHERE station_id = ?", (new_id, old_id))

# Check complaints too
cursor.execute("SELECT DISTINCT station_id FROM complaints WHERE station_id IS NOT NULL ORDER BY station_id")
complaint_stations = [row[0] for row in cursor.fetchall()]

print("\n" + "="*60)
print("\nStation IDs referenced by complaints:")
for s in complaint_stations:
    exists = s in valid_stations
    status = "✓ EXISTS" if exists else "✗ NEEDS FIX"
    print(f"  {status}: {s}")
    
    # Auto-fix common patterns
    if not exists:
        # Try removing "ka-" prefix
        if s.startswith("ka-"):
            potential_fix = s[3:]  # Remove "ka-"
            if potential_fix in valid_stations:
                cursor.execute("SELECT COUNT(*) FROM complaints WHERE station_id = ?", (s,))
                count = cursor.fetchone()[0]
                print(f"    → Updating {count} complaints to '{potential_fix}'")
                cursor.execute("UPDATE complaints SET station_id = ? WHERE station_id = ?", (potential_fix, s))

conn.commit()
print("\n✓ All fixes applied!")
conn.close()
