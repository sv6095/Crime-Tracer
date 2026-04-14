
import sqlite3

DB_PATH = "d:/Hack Crate/Backend/crime_tracer_v2.db"

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

# Get the complaint details
cursor.execute("SELECT complaint_id, station_id, status, state FROM complaints WHERE complaint_id = 'CTM-20251222-000004'")
complaint = cursor.fetchone()

if complaint:
    print(f"Complaint ID: {complaint[0]}")
    print(f"Station ID: '{complaint[1]}'")
    print(f"Station ID (repr): {repr(complaint[1])}")
    print(f"Station ID (bytes): {complaint[1].encode('utf-8')}")
    print(f"Status: {complaint[2]}")
    print(f"State: {complaint[3]}")
    
    # Check if there are ANY complaints for this station
    cursor.execute("SELECT COUNT(*) FROM complaints WHERE station_id = ?", (complaint[1],))
    count = cursor.fetchone()[0]
    print(f"\nTotal complaints for this station: {count}")
    
    # Check the cop's station
    cursor.execute("SELECT username, station_id FROM users WHERE username = 'eathen'")
    cop = cursor.fetchone()
    if cop:
        print(f"\nCop username: {cop[0]}")
        print(f"Cop station: '{cop[1]}'")
        print(f"Cop station (repr): {repr(cop[1])}")
        print(f"Cop station (bytes): {cop[1].encode('utf-8')}")
        print(f"\nStations match: {cop[1] == complaint[1]}")
else:
    print("Complaint not found")

conn.close()
