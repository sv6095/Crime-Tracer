"""
Tests for authentication and security features.

Tests:
- Account lockout mechanism
- Password strength validation
- Token refresh mechanism
- Failed login tracking
"""

import pytest
import sys
import os
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.main import app
from app import models
from app.db import SessionLocal, engine
from app.models import Base
from app.security import get_password_hash, create_access_token, create_refresh_token, verify_refresh_token
from app.services.account_lockout import (
    check_account_lockout,
    record_failed_login,
    reset_failed_attempts,
    get_remaining_attempts,
    MAX_FAILED_ATTEMPTS,
    LOCKOUT_DURATION_MINUTES
)
from app.utils.password_validator import validate_password_strength, get_password_strength_score


@pytest.fixture(scope="function")
def db():
    """Create a fresh database for each test."""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client(db):
    """Create a test client with database override."""
    from app.db import get_db
    def override_get_db():
        yield db
    
    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def test_user(db: Session):
    """Create a test user."""
    user = models.User(
        name="Test User",
        email="test@example.com",
        phone="1234567890",
        password_hash=get_password_hash("TestPass123!"),
        role=models.UserRole.VICTIM,
        is_active=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def client_with_db(db):
    """Create a test client with database dependency override."""
    from app.db import get_db
    app.dependency_overrides[get_db] = lambda: db
    yield TestClient(app)
    app.dependency_overrides.clear()


class TestPasswordValidation:
    """Test password strength validation."""
    
    def test_weak_password_too_short(self):
        """Test that passwords shorter than 8 characters are rejected."""
        is_valid, errors = validate_password_strength("Short1!")
        assert not is_valid
        assert any("8 characters" in err for err in errors)
    
    def test_weak_password_no_uppercase(self):
        """Test that passwords without uppercase are rejected."""
        is_valid, errors = validate_password_strength("lowercase123!")
        assert not is_valid
        assert any("uppercase" in err.lower() for err in errors)
    
    def test_weak_password_no_lowercase(self):
        """Test that passwords without lowercase are rejected."""
        is_valid, errors = validate_password_strength("UPPERCASE123!")
        assert not is_valid
        assert any("lowercase" in err.lower() for err in errors)
    
    def test_weak_password_no_digit(self):
        """Test that passwords without digits are rejected."""
        is_valid, errors = validate_password_strength("NoDigits!")
        assert not is_valid
        assert any("digit" in err.lower() for err in errors)
    
    def test_weak_password_no_special(self):
        """Test that passwords without special characters are rejected."""
        is_valid, errors = validate_password_strength("NoSpecial123")
        assert not is_valid
        assert any("special" in err.lower() for err in errors)
    
    def test_common_password_rejected(self):
        """Test that common passwords are rejected."""
        is_valid, errors = validate_password_strength("password123")
        assert not is_valid
        assert any("common" in err.lower() for err in errors)
    
    def test_strong_password_accepted(self):
        """Test that strong passwords are accepted."""
        is_valid, errors = validate_password_strength("StrongPass123!")
        assert is_valid
        assert len(errors) == 0
    
    def test_password_strength_score(self):
        """Test password strength scoring."""
        weak_score = get_password_strength_score("weak")
        strong_score = get_password_strength_score("VeryStrongPassword123!@#")
        
        assert weak_score < strong_score
        assert strong_score >= 70  # Strong passwords should score high


class TestAccountLockout:
    """Test account lockout mechanism."""
    
    def test_initial_state_no_lockout(self, db: Session, test_user: models.User):
        """Test that new users are not locked."""
        is_locked, unlock_time = check_account_lockout(test_user)
        assert not is_locked
        assert unlock_time is None
        assert test_user.failed_login_attempts == 0
    
    def test_failed_login_increments_counter(self, db: Session, test_user: models.User):
        """Test that failed login increments the counter."""
        initial_attempts = test_user.failed_login_attempts
        
        record_failed_login(db, test_user)
        
        assert test_user.failed_login_attempts == initial_attempts + 1
        assert get_remaining_attempts(test_user) == MAX_FAILED_ATTEMPTS - 1
    
    def test_account_locks_after_max_attempts(self, db: Session, test_user: models.User):
        """Test that account locks after maximum failed attempts."""
        # Record max attempts
        for _ in range(MAX_FAILED_ATTEMPTS):
            record_failed_login(db, test_user)
        
        is_locked, unlock_time = check_account_lockout(test_user)
        assert is_locked
        assert unlock_time is not None
        assert test_user.locked_until is not None
    
    def test_lockout_expires_after_duration(self, db: Session, test_user: models.User):
        """Test that lockout expires after the duration."""
        # Lock the account
        for _ in range(MAX_FAILED_ATTEMPTS):
            record_failed_login(db, test_user)
        
        # Manually set lockout to expired time
        test_user.locked_until = datetime.utcnow() - timedelta(minutes=1)
        db.commit()
        
        is_locked, unlock_time = check_account_lockout(test_user)
        assert not is_locked
        assert test_user.failed_login_attempts == 0
        assert test_user.locked_until is None
    
    def test_successful_login_resets_attempts(self, db: Session, test_user: models.User):
        """Test that successful login resets failed attempts."""
        # Record some failed attempts
        record_failed_login(db, test_user)
        record_failed_login(db, test_user)
        
        assert test_user.failed_login_attempts == 2
        
        reset_failed_attempts(db, test_user)
        
        assert test_user.failed_login_attempts == 0
        assert test_user.locked_until is None
    
    def test_remaining_attempts_calculation(self, db: Session, test_user: models.User):
        """Test remaining attempts calculation."""
        assert get_remaining_attempts(test_user) == MAX_FAILED_ATTEMPTS
        
        record_failed_login(db, test_user)
        assert get_remaining_attempts(test_user) == MAX_FAILED_ATTEMPTS - 1
        
        # Lock account
        for _ in range(MAX_FAILED_ATTEMPTS - 1):
            record_failed_login(db, test_user)
        assert get_remaining_attempts(test_user) == 0


class TestTokenRefresh:
    """Test token refresh mechanism."""
    
    def test_create_refresh_token(self):
        """Test creating a refresh token."""
        data = {"sub": "test@example.com", "role": "victim"}
        token = create_refresh_token(data)
        
        assert token is not None
        assert len(token) > 0
    
    def test_verify_refresh_token_valid(self):
        """Test verifying a valid refresh token."""
        data = {"sub": "test@example.com", "role": "victim"}
        token = create_refresh_token(data)
        
        payload = verify_refresh_token(token)
        assert payload is not None
        assert payload.get("sub") == "test@example.com"
        assert payload.get("type") == "refresh"
    
    def test_verify_refresh_token_invalid(self):
        """Test verifying an invalid refresh token."""
        # Create an access token (not a refresh token)
        data = {"sub": "test@example.com", "role": "victim"}
        access_token = create_access_token(data)
        
        # Try to verify as refresh token
        payload = verify_refresh_token(access_token)
        assert payload is None  # Should fail because it's not a refresh token
    
    def test_refresh_token_expires(self):
        """Test that refresh tokens expire."""
        data = {"sub": "test@example.com", "role": "victim"}
        # Create token with very short expiration
        token = create_refresh_token(data, expires_delta=timedelta(seconds=-1))
        
        payload = verify_refresh_token(token)
        assert payload is None  # Should be expired


class TestAuthenticationEndpoints:
    """Test authentication API endpoints."""
    
    def test_register_with_weak_password(self, client: TestClient):
        """Test that registration rejects weak passwords."""
        response = client.post("/api/auth/victim/register", json={
            "name": "Test User",
            "email": "test@example.com",
            "phone": "1234567890",
            "password": "weak"  # Too weak
        })
        
        assert response.status_code == 400
        assert "password" in response.json().get("error", {}).get("message", "").lower()
    
    def test_register_with_strong_password(self, client: TestClient):
        """Test that registration accepts strong passwords."""
        response = client.post("/api/auth/victim/register", json={
            "name": "Test User",
            "email": "test@example.com",
            "phone": "1234567890",
            "password": "StrongPass123!"
        })
        
        assert response.status_code == 200
        assert "id" in response.json()
    
    def test_login_returns_refresh_token(self, client: TestClient, db: Session):
        """Test that login returns both access and refresh tokens."""
        # Create test user
        from app.security import get_password_hash
        test_user = models.User(
            name="Test User",
            email="test@example.com",
            phone="1234567890",
            password_hash=get_password_hash("TestPass123!"),
            role=models.UserRole.VICTIM,
            is_active=True
        )
        db.add(test_user)
        db.commit()
        
        response = client.post(
            "/api/auth/token",
            data={
                "username": test_user.email,
                "password": "TestPass123!"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"
        assert "expires_in" in data
    
    def test_login_fails_after_max_attempts(self, client: TestClient, test_user: models.User):
        """Test that login fails after maximum attempts."""
        # Attempt login with wrong password multiple times
        for _ in range(MAX_FAILED_ATTEMPTS):
            response = client.post(
                "/api/auth/token",
                data={
                    "username": test_user.email,
                    "password": "WrongPassword123!"
                }
            )
            assert response.status_code == 401
        
        # Next attempt should be locked
        response = client.post(
            "/api/auth/token",
            data={
                "username": test_user.email,
                "password": "WrongPassword123!"
            }
        )
        
        assert response.status_code == 423  # Locked
        assert "locked" in response.json().get("error", {}).get("message", "").lower()
    
    def test_refresh_token_endpoint(self, client: TestClient, db: Session):
        """Test the refresh token endpoint."""
        # Create test user
        from app.security import get_password_hash
        test_user = models.User(
            name="Test User",
            email="refresh@example.com",
            phone="1234567890",
            password_hash=get_password_hash("TestPass123!"),
            role=models.UserRole.VICTIM,
            is_active=True
        )
        db.add(test_user)
        db.commit()
        
        # First, login to get tokens
        login_response = client.post(
            "/api/auth/token",
            data={
                "username": test_user.email,
                "password": "TestPass123!"
            }
        )
        
        assert login_response.status_code == 200
        refresh_token = login_response.json()["refresh_token"]
        
        # Use refresh token to get new access token
        refresh_response = client.post(
            "/api/auth/refresh",
            json={"refresh_token": refresh_token}
        )
        
        assert refresh_response.status_code == 200
        data = refresh_response.json()
        assert "access_token" in data
        assert "refresh_token" in data  # Should get new refresh token (rotation)
        assert data["access_token"] != login_response.json()["access_token"]
    
    def test_logout_revokes_token(self, client: TestClient, db: Session):
        """Test that logout revokes refresh token."""
        # Create test user
        from app.security import get_password_hash
        test_user = models.User(
            name="Test User",
            email="logout@example.com",
            phone="1234567890",
            password_hash=get_password_hash("TestPass123!"),
            role=models.UserRole.VICTIM,
            is_active=True
        )
        db.add(test_user)
        db.commit()
        
        # Login
        login_response = client.post(
            "/api/auth/token",
            data={
                "username": test_user.email,
                "password": "TestPass123!"
            }
        )
        
        assert login_response.status_code == 200
        refresh_token = login_response.json()["refresh_token"]
        access_token = login_response.json()["access_token"]
        
        # Logout
        logout_response = client.post(
            "/api/auth/logout",
            json={"refresh_token": refresh_token},
            headers={"Authorization": f"Bearer {access_token}"}
        )
        
        assert logout_response.status_code == 200
        
        # Try to use revoked refresh token
        refresh_response = client.post(
            "/api/auth/refresh",
            json={"refresh_token": refresh_token}
        )
        
        assert refresh_response.status_code == 401
