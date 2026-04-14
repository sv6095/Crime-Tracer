
import sqlite3
import os

DB_PATH = "d:/Hack Crate/Backend/crime_tracer_v2.db"

def migrate():
    if not os.path.exists(DB_PATH):
        print(f"Database not found at {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        print("Attempting to add 'victim_confirmation_deadline' column to 'complaints' table...")
        # SQLite supports limited ALTER TABLE. ADD COLUMN is supported.
        cursor.execute("ALTER TABLE complaints ADD COLUMN victim_confirmation_deadline DATETIME DEFAULT NULL")
        conn.commit()
        print("Success: Column added.")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e):
            print("Column already exists.")
        else:
            print(f"Error: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
