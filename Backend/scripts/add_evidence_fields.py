#!/usr/bin/env python3
"""
Add new fields to evidence table for evidence upload system.
Run this script to add: evidence_type, text_content, deleted_at, recording_duration, recording_format
"""
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import create_engine, text
from app.config import settings
from app.db import engine

def add_evidence_fields():
    """Add new columns to evidence table."""
    with engine.connect() as conn:
        try:
            # Check if columns already exist
            result = conn.execute(text("PRAGMA table_info(evidence)"))
            columns = [row[1] for row in result]
            
            if 'evidence_type' not in columns:
                conn.execute(text("ALTER TABLE evidence ADD COLUMN evidence_type VARCHAR(50)"))
                print("[OK] Added evidence_type column")
            else:
                print("[SKIP] evidence_type column already exists")
            
            if 'text_content' not in columns:
                conn.execute(text("ALTER TABLE evidence ADD COLUMN text_content TEXT"))
                print("[OK] Added text_content column")
            else:
                print("[SKIP] text_content column already exists")
            
            if 'deleted_at' not in columns:
                conn.execute(text("ALTER TABLE evidence ADD COLUMN deleted_at DATETIME"))
                print("[OK] Added deleted_at column")
            else:
                print("[SKIP] deleted_at column already exists")
            
            if 'recording_duration' not in columns:
                conn.execute(text("ALTER TABLE evidence ADD COLUMN recording_duration INTEGER"))
                print("[OK] Added recording_duration column")
            else:
                print("[SKIP] recording_duration column already exists")
            
            if 'recording_format' not in columns:
                conn.execute(text("ALTER TABLE evidence ADD COLUMN recording_format VARCHAR(50)"))
                print("[OK] Added recording_format column")
            else:
                print("[SKIP] recording_format column already exists")
            
            conn.commit()
            print("\n[SUCCESS] All evidence fields added successfully!")
            
        except Exception as e:
            print(f"[ERROR] Error: {e}")
            conn.rollback()
            raise

if __name__ == "__main__":
    print("Adding new fields to evidence table...")
    add_evidence_fields()
