"""
Pytest configuration and shared fixtures.
"""

import pytest
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

from app.main import app
from app.db import Base
from app.config import settings


@pytest.fixture(scope="session")
def test_db_url():
    """Get test database URL."""
    # Use in-memory SQLite for tests
    return "sqlite:///:memory:"


@pytest.fixture(scope="function")
def db_session(test_db_url):
    """Create a database session for testing."""
    engine = create_engine(test_db_url, connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client(db_session):
    """Create a test client."""
    return TestClient(app)


# Set test environment variables
os.environ.setdefault("ENV", "test")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-testing-only")
os.environ.setdefault("SQLALCHEMY_DATABASE_URL", "sqlite:///:memory:")
