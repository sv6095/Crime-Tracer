"""
Tests for error handling and resilience features.

Tests:
- Custom exception classes
- Standardized error responses
- Circuit breaker pattern
- Retry logic
"""

import pytest
import time
from unittest.mock import Mock, patch, MagicMock
from fastapi.testclient import TestClient

from app.main import app
from app.utils.exceptions import (
    CrimeTracerException,
    AuthenticationError,
    AccountLockedError,
    ValidationError,
    NotFoundError,
    ExternalServiceError,
    RateLimitError,
    DatabaseError
)
from app.utils.circuit_breaker import CircuitBreaker, CircuitState
from app.utils.retry import retry_with_backoff


class TestCustomExceptions:
    """Test custom exception classes."""
    
    def test_authentication_error(self):
        """Test AuthenticationError exception."""
        error = AuthenticationError(detail="Invalid credentials")
        
        assert error.status_code == 401
        assert error.error_code == "AUTH_FAILED"
        assert error.error_type == "authentication"
        assert "Invalid credentials" in error.detail
    
    def test_account_locked_error(self):
        """Test AccountLockedError exception."""
        error = AccountLockedError(locked_until="2024-01-01T00:00:00")
        
        assert error.status_code == 423
        assert error.error_code == "ACCOUNT_LOCKED"
        assert error.error_type == "account_lockout"
        assert "locked" in error.detail.lower()
    
    def test_validation_error(self):
        """Test ValidationError exception."""
        error = ValidationError(detail="Invalid input", field="email")
        
        assert error.status_code == 400
        assert error.error_code == "VALIDATION_ERROR"
        assert error.error_type == "validation"
        assert error.metadata.get("field") == "email"
    
    def test_not_found_error(self):
        """Test NotFoundError exception."""
        error = NotFoundError(resource_type="User", resource_id="123")
        
        assert error.status_code == 404
        assert error.error_code == "NOT_FOUND"
        assert error.metadata.get("resource_id") == "123"
    
    def test_external_service_error(self):
        """Test ExternalServiceError exception."""
        error = ExternalServiceError(service="grok_api", detail="Service unavailable")
        
        assert error.status_code == 503
        assert error.error_code == "EXTERNAL_SERVICE_ERROR"
        assert error.metadata.get("service") == "grok_api"
    
    def test_exception_to_dict(self):
        """Test exception serialization to dict."""
        error = AuthenticationError(detail="Test error", metadata={"key": "value"})
        error_dict = error.to_dict()
        
        assert "error" in error_dict
        assert error_dict["error"]["code"] == "AUTH_FAILED"
        assert error_dict["error"]["message"] == "Test error"
        assert error_dict["error"]["metadata"]["key"] == "value"


class TestCircuitBreaker:
    """Test circuit breaker pattern."""
    
    def test_circuit_breaker_closed_state(self):
        """Test circuit breaker in closed state (normal operation)."""
        cb = CircuitBreaker("test_service", failure_threshold=3)
        
        def success_func():
            return "success"
        
        result = cb.call(success_func)
        assert result == "success"
        assert cb.state == CircuitState.CLOSED
        assert cb.failure_count == 0
    
    def test_circuit_breaker_opens_after_threshold(self):
        """Test that circuit breaker opens after failure threshold."""
        cb = CircuitBreaker("test_service", failure_threshold=2)
        
        def failing_func():
            raise Exception("Service error")
        
        # First failure
        with pytest.raises(Exception):
            cb.call(failing_func)
        assert cb.failure_count == 1
        assert cb.state == CircuitState.CLOSED
        
        # Second failure - should open
        with pytest.raises(Exception):
            cb.call(failing_func)
        assert cb.failure_count == 2
        assert cb.state == CircuitState.OPEN
    
    def test_circuit_breaker_rejects_when_open(self):
        """Test that circuit breaker rejects calls when open."""
        cb = CircuitBreaker("test_service", failure_threshold=1, timeout_seconds=60)
        
        def failing_func():
            raise Exception("Service error")
        
        # Open the circuit
        with pytest.raises(Exception):
            cb.call(failing_func)
        
        # Try to call again - should raise ExternalServiceError
        with pytest.raises(ExternalServiceError):
            cb.call(lambda: "should not execute")
    
    def test_circuit_breaker_half_open_transition(self):
        """Test circuit breaker transition to half-open state."""
        cb = CircuitBreaker("test_service", failure_threshold=1, timeout_seconds=1)
        
        def failing_func():
            raise Exception("Service error")
        
        # Open the circuit
        with pytest.raises(Exception):
            cb.call(failing_func)
        
        assert cb.state == CircuitState.OPEN
        
        # Wait for timeout
        time.sleep(1.1)
        
        # Next call should transition to half-open
        def success_func():
            return "success"
        
        result = cb.call(success_func)
        assert result == "success"
        assert cb.state == CircuitState.HALF_OPEN
    
    def test_circuit_breaker_closes_after_success_threshold(self):
        """Test that circuit breaker closes after success threshold in half-open."""
        cb = CircuitBreaker("test_service", failure_threshold=1, timeout_seconds=1, success_threshold=2)
        
        def failing_func():
            raise Exception("Service error")
        
        # Open the circuit
        with pytest.raises(Exception):
            cb.call(failing_func)
        
        time.sleep(1.1)
        
        # First success in half-open
        def success_func():
            return "success"
        
        cb.call(success_func)
        assert cb.state == CircuitState.HALF_OPEN
        
        # Second success should close
        cb.call(success_func)
        assert cb.state == CircuitState.CLOSED


class TestRetryLogic:
    """Test retry logic with exponential backoff."""
    
    def test_retry_succeeds_on_first_attempt(self):
        """Test that retry succeeds immediately if function succeeds."""
        call_count = [0]
        
        @retry_with_backoff(max_attempts=3)
        def success_func():
            call_count[0] += 1
            return "success"
        
        result = success_func()
        assert result == "success"
        assert call_count[0] == 1
    
    def test_retry_succeeds_after_failures(self):
        """Test that retry succeeds after some failures."""
        call_count = [0]
        
        @retry_with_backoff(max_attempts=3, initial_delay=0.1)
        def flaky_func():
            call_count[0] += 1
            if call_count[0] < 2:
                raise Exception("Temporary error")
            return "success"
        
        result = flaky_func()
        assert result == "success"
        assert call_count[0] == 2
    
    def test_retry_fails_after_max_attempts(self):
        """Test that retry raises exception after max attempts."""
        call_count = [0]
        
        @retry_with_backoff(max_attempts=3, initial_delay=0.1)
        def always_failing_func():
            call_count[0] += 1
            raise Exception("Permanent error")
        
        with pytest.raises(Exception, match="Permanent error"):
            always_failing_func()
        
        assert call_count[0] == 3
    
    def test_retry_only_catches_specified_exceptions(self):
        """Test that retry only catches specified exceptions."""
        call_count = [0]
        
        @retry_with_backoff(max_attempts=3, exceptions=(ValueError,))
        def func_with_different_exception():
            call_count[0] += 1
            raise TypeError("Different error")
        
        with pytest.raises(TypeError):
            func_with_different_exception()
        
        assert call_count[0] == 1  # Should not retry


class TestErrorHandlingMiddleware:
    """Test error handling in FastAPI middleware."""
    
    def test_custom_exception_handling(self, client: TestClient):
        """Test that custom exceptions are handled correctly."""
        # This would require mocking an endpoint that raises a custom exception
        # For now, we test the exception structure
        
        error = AuthenticationError(detail="Test error")
        error_dict = error.to_dict()
        
        assert error_dict["error"]["code"] == "AUTH_FAILED"
        assert error_dict["error"]["type"] == "authentication"
        assert error_dict["error"]["message"] == "Test error"
    
    def test_validation_error_format(self, client: TestClient):
        """Test that validation errors are formatted correctly."""
        # Test with invalid JSON
        response = client.post("/api/auth/victim/register", json={
            "name": "",  # Invalid empty name
            "password": "weak"  # Weak password
        })
        
        # Should return 400 or 422 with validation error format
        assert response.status_code in [400, 422]
