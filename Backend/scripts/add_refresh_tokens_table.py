#!/usr/bin/env python
"""
Script to create refresh_tokens table.

Run this script if you have an existing database that needs the refresh_tokens table.
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
from app.models import Base

def create_refresh_tokens_table():
    """Create refresh_tokens table if it doesn't exist."""
    print("Creating refresh_tokens table...")
    
    try:
        # Check if table already exists
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        
        if 'refresh_tokens' in tables:
            print("[INFO] refresh_tokens table already exists.")
            return
        
        # Create the table using SQLAlchemy metadata
        # This will create all tables, but we only care about refresh_tokens
        Base.metadata.create_all(bind=engine, tables=[Base.metadata.tables['refresh_tokens']])
        print("[SUCCESS] refresh_tokens table created successfully!")
        
    except Exception as e:
        print(f"[ERROR] Error creating refresh_tokens table: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    create_refresh_tokens_table()
