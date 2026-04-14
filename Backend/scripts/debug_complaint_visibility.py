
import sqlite3

DB_PATH = "d:/Hack Crate/Backend/crime_tracer_v2.db"

def inspect():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    

    # 1. Check the specific complaint
    print("\n--- Complaint CTM-20251222-000004 ---")
    cursor.execute("SELECT complaint_id, station_id, status FROM complaints WHERE complaint_id = 'CTM-20251222-000004'")
    complaint = cursor.fetchone()
    if not complaint:
        print("NOT FOUND")
        return
    
    print(f"Complaint Station: {repr(complaint[1])}")
    print(f"Complaint Status:  {repr(complaint[2])}")
    
    comp_station = complaint[1]

    # Check Cop 'eathen'
    cursor.execute("SELECT name, station_id FROM users WHERE username='eathen' OR name LIKE '%eathen%'")
    cops = cursor.fetchall()
    print("\n--- Cops matching 'eathen' ---")
    for c in cops:
        print(f"Cop: {c[0]}, Station: {repr(c[1])}")
        if c[1] == comp_station:
            print(">>> MATCH: Cop is in same station.")
        else:
            print(">>> MISMATCH: Cop is in different station.")


    conn.close()

if __name__ == "__main__":
    inspect()
