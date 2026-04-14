# app/db.py
"""
Database setup for Crime Tracer Mangalore.

- Creates SQLAlchemy engine using settings.SQLALCHEMY_DATABASE_URL
- Provides SessionLocal and get_db dependency
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from .config import settings

DATABASE_URL = settings.SQLALCHEMY_DATABASE_URL

# sqlite needs special connect args; others don't
connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
