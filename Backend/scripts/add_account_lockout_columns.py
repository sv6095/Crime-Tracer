#!/usr/bin/env python
"""
Script to add account lockout and 2FA columns to existing users table.

This script adds the new columns that were added to the User model:
- failed_login_attempts
- locked_until
- last_failed_login
- two_factor_enabled
- two_factor_secret

Run this script if you have an existing database that needs to be updated.
"""

import sys
import os
from pathlib import Path

# Add Backend to path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from sqlalchemy import create_engine, text, inspect
from app.config import settings
from app.db import engine

def add_columns():
    """Add new columns to users table."""
    print("Adding account lockout and 2FA columns to users table...")
    
    try:
        with engine.connect() as conn:
            # Check if columns already exist
            try:
                inspector = inspect(engine)
                columns = [col['name'] for col in inspector.get_columns('users')]
            except Exception:
                columns = []
            
            added_count = 0
            
            # Add columns if they don't exist
            if 'failed_login_attempts' not in columns:
                try:
                    print("Adding failed_login_attempts column...")
                    conn.execute(text("ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER DEFAULT 0"))
                    conn.commit()
                    added_count += 1
                except Exception as e:
                    if "duplicate column" not in str(e).lower():
                        print(f"Warning: {e}")
            
            if 'locked_until' not in columns:
                try:
                    print("Adding locked_until column...")
                    conn.execute(text("ALTER TABLE users ADD COLUMN locked_until DATETIME"))
                    conn.commit()
                    added_count += 1
                except Exception as e:
                    if "duplicate column" not in str(e).lower():
                        print(f"Warning: {e}")
            
            if 'last_failed_login' not in columns:
                try:
                    print("Adding last_failed_login column...")
                    conn.execute(text("ALTER TABLE users ADD COLUMN last_failed_login DATETIME"))
                    conn.commit()
                    added_count += 1
                except Exception as e:
                    if "duplicate column" not in str(e).lower():
                        print(f"Warning: {e}")
            
            if 'two_factor_enabled' not in columns:
                try:
                    print("Adding two_factor_enabled column...")
                    conn.execute(text("ALTER TABLE users ADD COLUMN two_factor_enabled BOOLEAN DEFAULT 0"))
                    conn.commit()
                    added_count += 1
                except Exception as e:
                    if "duplicate column" not in str(e).lower():
                        print(f"Warning: {e}")
            
            if 'two_factor_secret' not in columns:
                try:
                    print("Adding two_factor_secret column...")
                    conn.execute(text("ALTER TABLE users ADD COLUMN two_factor_secret VARCHAR(255)"))
                    conn.commit()
                    added_count += 1
                except Exception as e:
                    if "duplicate column" not in str(e).lower():
                        print(f"Warning: {e}")
            
            if added_count > 0:
                print(f"[SUCCESS] Added {added_count} column(s) successfully!")
            else:
                print("[INFO] All columns already exist. Database is up to date.")
            
    except Exception as e:
        print(f"[ERROR] Error adding columns: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    add_columns()
