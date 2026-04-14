
import sqlite3

DB_PATH = "d:/Hack Crate/Backend/crime_tracer_v2.db"

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

print("=== ALL STATIONS ===")
cursor.execute("SELECT id, name, city, jurisdiction FROM stations ORDER BY name")
stations = cursor.fetchall()

for s in stations:
    print(f"\nID: {s[0]}")
    print(f"Name: {s[1]}")
    print(f"City: {s[2]}")
    print(f"Jurisdiction: {s[3]}")
    print("-" * 50)

print("\n\n=== STATION USAGE ===")
cursor.execute("""
    SELECT s.id, s.name, COUNT(c.id) as complaint_count
    FROM stations s
    LEFT JOIN complaints c ON s.id = c.station_id
    GROUP BY s.id, s.name
    ORDER BY s.name
""")
usage = cursor.fetchall()

for u in usage:
    print(f"{u[1]}: {u[2]} complaints (ID: {u[0]})")

print("\n\n=== COPS BY STATION ===")
cursor.execute("""
    SELECT s.name, u.username, u.name as cop_name
    FROM users u
    JOIN stations s ON u.station_id = s.id
    WHERE u.role = 'COP'
    ORDER BY s.name, u.name
""")
cops = cursor.fetchall()

current_station = None
for c in cops:
    if c[0] != current_station:
        print(f"\n{c[0]}:")
        current_station = c[0]
    print(f"  - {c[2]} (@{c[1]})")

conn.close()
