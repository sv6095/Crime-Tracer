# app/utils/exceptions.py
"""
Custom exception classes for Crime Tracer API.

Provides standardized error responses with error codes and user-friendly messages.
"""

from typing import Optional, Dict, Any
from fastapi import HTTPException, status


class CrimeTracerException(HTTPException):
    """Base exception class for Crime Tracer API."""
    
    def __init__(
        self,
        status_code: int,
        error_code: str,
        detail: str,
        error_type: str = "error",
        metadata: Optional[Dict[str, Any]] = None
    ):
        self.error_code = error_code
        self.error_type = error_type
        self.metadata = metadata or {}
        super().__init__(status_code=status_code, detail=detail)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert exception to dictionary for JSON response."""
        return {
            "error": {
                "code": self.error_code,
                "type": self.error_type,
                "message": self.detail,
                "metadata": self.metadata
            }
        }


class AuthenticationError(CrimeTracerException):
    """Authentication-related errors."""
    
    def __init__(self, detail: str = "Authentication failed", metadata: Optional[Dict[str, Any]] = None):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            error_code="AUTH_FAILED",
            detail=detail,
            error_type="authentication",
            metadata=metadata
        )


class AuthorizationError(CrimeTracerException):
    """Authorization-related errors."""
    
    def __init__(self, detail: str = "Access denied", metadata: Optional[Dict[str, Any]] = None):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            error_code="ACCESS_DENIED",
            detail=detail,
            error_type="authorization",
            metadata=metadata
        )


class AccountLockedError(CrimeTracerException):
    """Account locked due to too many failed login attempts."""
    
    def __init__(self, locked_until: Optional[str] = None, metadata: Optional[Dict[str, Any]] = None):
        detail = "Account temporarily locked due to too many failed login attempts"
        if locked_until:
            detail += f". Account will be unlocked at {locked_until}"
        super().__init__(
            status_code=status.HTTP_423_LOCKED,
            error_code="ACCOUNT_LOCKED",
            detail=detail,
            error_type="account_lockout",
            metadata=metadata or {}
        )


class ValidationError(CrimeTracerException):
    """Input validation errors."""
    
    def __init__(self, detail: str, field: Optional[str] = None, metadata: Optional[Dict[str, Any]] = None):
        meta = metadata or {}
        if field:
            meta["field"] = field
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            error_code="VALIDATION_ERROR",
            detail=detail,
            error_type="validation",
            metadata=meta
        )


class NotFoundError(CrimeTracerException):
    """Resource not found errors."""
    
    def __init__(self, resource_type: str = "Resource", resource_id: Optional[str] = None):
        detail = f"{resource_type} not found"
        metadata = {"resource_type": resource_type}
        if resource_id:
            metadata["resource_id"] = resource_id
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            error_code="NOT_FOUND",
            detail=detail,
            error_type="not_found",
            metadata=metadata
        )


class ExternalServiceError(CrimeTracerException):
    """External service errors (Grok API, ML Service, S3, etc.)."""
    
    def __init__(self, service: str, detail: str = "External service unavailable", metadata: Optional[Dict[str, Any]] = None):
        meta = metadata or {}
        meta["service"] = service
        super().__init__(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            error_code="EXTERNAL_SERVICE_ERROR",
            detail=detail,
            error_type="external_service",
            metadata=meta
        )


class RateLimitError(CrimeTracerException):
    """Rate limit exceeded errors."""
    
    def __init__(self, retry_after: Optional[int] = None, metadata: Optional[Dict[str, Any]] = None):
        detail = "Rate limit exceeded. Please try again later."
        meta = metadata or {}
        if retry_after:
            meta["retry_after"] = retry_after
        super().__init__(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            error_code="RATE_LIMIT_EXCEEDED",
            detail=detail,
            error_type="rate_limit",
            metadata=meta
        )


class DatabaseError(CrimeTracerException):
    """Database operation errors."""
    
    def __init__(self, detail: str = "Database operation failed", metadata: Optional[Dict[str, Any]] = None):
        super().__init__(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            error_code="DATABASE_ERROR",
            detail=detail,
            error_type="database",
            metadata=metadata
        )
