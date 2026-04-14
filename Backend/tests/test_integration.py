"""
Integration tests for the complete authentication flow.

Tests:
- Full registration and login flow
- Token refresh flow
- Account lockout flow
- Error handling in real scenarios
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app import models
from app.db import SessionLocal, engine
from app.models import Base
from app.security import get_password_hash
from app.services.account_lockout import MAX_FAILED_ATTEMPTS


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
    """Create a test client."""
    return TestClient(app)


class TestCompleteAuthFlow:
    """Test complete authentication flows."""
    
    def test_complete_registration_login_refresh_flow(self, client: TestClient):
        """Test complete flow: register -> login -> refresh -> logout."""
        # 1. Register
        register_response = client.post("/api/auth/victim/register", json={
            "name": "Integration Test User",
            "email": "integration@test.com",
            "phone": "9876543210",
            "password": "StrongPass123!"
        })
        
        assert register_response.status_code == 200
        user_id = register_response.json()["id"]
        
        # 2. Login
        login_response = client.post(
            "/api/auth/token",
            data={
                "username": "integration@test.com",
                "password": "StrongPass123!"
            }
        )
        
        assert login_response.status_code == 200
        login_data = login_response.json()
        assert "access_token" in login_data
        assert "refresh_token" in login_data
        
        access_token = login_data["access_token"]
        refresh_token = login_data["refresh_token"]
        
        # 3. Use access token to get current user
        me_response = client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        
        assert me_response.status_code == 200
        assert me_response.json()["email"] == "integration@test.com"
        
        # 4. Refresh token
        refresh_response = client.post(
            "/api/auth/refresh",
            json={"refresh_token": refresh_token}
        )
        
        assert refresh_response.status_code == 200
        refresh_data = refresh_response.json()
        assert "access_token" in refresh_data
        assert "refresh_token" in refresh_data
        # New tokens should be different
        assert refresh_data["access_token"] != access_token
        assert refresh_data["refresh_token"] != refresh_token
        
        # 5. Logout
        logout_response = client.post(
            "/api/auth/logout",
            json={"refresh_token": refresh_data["refresh_token"]},
            headers={"Authorization": f"Bearer {refresh_data['access_token']}"}
        )
        
        assert logout_response.status_code == 200
        
        # 6. Verify refresh token is revoked
        revoked_refresh_response = client.post(
            "/api/auth/refresh",
            json={"refresh_token": refresh_data["refresh_token"]}
        )
        
        assert revoked_refresh_response.status_code == 401
    
    def test_account_lockout_flow(self, client: TestClient, db: Session):
        """Test complete account lockout flow."""
        # Create user
        user = models.User(
            name="Lockout Test User",
            email="lockout@test.com",
            password_hash=get_password_hash("TestPass123!"),
            role=models.UserRole.VICTIM,
            is_active=True
        )
        db.add(user)
        db.commit()
        
        # Attempt login with wrong password multiple times
        for i in range(MAX_FAILED_ATTEMPTS):
            response = client.post(
                "/api/auth/token",
                data={
                    "username": "lockout@test.com",
                    "password": "WrongPassword123!"
                }
            )
            
            if i < MAX_FAILED_ATTEMPTS - 1:
                # Should fail but not be locked yet
                assert response.status_code == 401
                error_msg = response.json().get("error", {}).get("message", "")
                assert "attempt" in error_msg.lower() or "invalid" in error_msg.lower()
            else:
                # Last attempt should lock account
                assert response.status_code == 423
                assert "locked" in response.json().get("error", {}).get("message", "").lower()
        
        # Verify account is locked in database
        db.refresh(user)
        assert user.failed_login_attempts >= MAX_FAILED_ATTEMPTS
        assert user.locked_until is not None
        
        # Try correct password - should still be locked
        response = client.post(
            "/api/auth/token",
            data={
                "username": "lockout@test.com",
                "password": "TestPass123!"
            }
        )
        
        assert response.status_code == 423
    
    def test_password_validation_in_registration(self, client: TestClient):
        """Test password validation during registration."""
        weak_passwords = [
            "short",  # Too short
            "nouppercase123!",  # No uppercase
            "NOLOWERCASE123!",  # No lowercase
            "NoDigits!",  # No digits
            "NoSpecial123",  # No special characters
            "password123",  # Common password
        ]
        
        for weak_password in weak_passwords:
            response = client.post("/api/auth/victim/register", json={
                "name": "Test User",
                "email": f"test{weak_password}@example.com",
                "phone": "1234567890",
                "password": weak_password
            })
            
            assert response.status_code == 400, f"Password '{weak_password}' should be rejected"
            assert "password" in response.json().get("error", {}).get("message", "").lower()
    
    def test_error_response_format(self, client: TestClient):
        """Test that error responses follow standardized format."""
        # Test with invalid endpoint
        response = client.get("/api/nonexistent")
        
        assert response.status_code == 404
        
        # Test with validation error
        response = client.post("/api/auth/victim/register", json={
            "name": "",
            "password": "weak"
        })
        
        assert response.status_code in [400, 422]
        # Response should have error structure
        response_data = response.json()
        assert "error" in response_data or "detail" in response_data
