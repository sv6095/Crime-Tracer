
import sqlite3

DB_PATH = "d:/Hack Crate/Backend/crime_tracer_v2.db"

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

print("=== CHECKING COP APPROVAL STATUS ===\n")

cursor.execute("""
    SELECT username, name, station_id, is_active, pending_approval
    FROM users
    WHERE role = 'COP'
    ORDER BY created_at DESC
    LIMIT 5
""")

cops = cursor.fetchall()

for cop in cops:
    print(f"Username: {cop[0]}")
    print(f"Name: {cop[1]}")
    print(f"Station: {cop[2]}")
    print(f"Active: {cop[3]}")
    print(f"Pending Approval: {cop[4]}")
    
    if cop[4]:  # pending_approval = True
        print("  ⚠️  THIS COP NEEDS ADMIN APPROVAL!")
        print("  → Updating to approved...")
        cursor.execute("UPDATE users SET pending_approval = 0 WHERE username = ?", (cop[0],))
        conn.commit()
        print("  ✓ Approved!")
    else:
        print("  ✓ Already approved")
    
    print("-" * 50)

conn.close()
print("\n✓ All cops checked and approved if needed")
