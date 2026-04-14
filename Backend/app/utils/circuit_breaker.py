# app/utils/circuit_breaker.py
"""
Circuit breaker pattern for external service calls.

Prevents cascading failures by stopping requests to failing services
and allowing them to recover.
"""

from enum import Enum
from datetime import datetime, timedelta
from typing import Optional, Callable, Any
import logging
import asyncio

logger = logging.getLogger("crime_tracer.circuit_breaker")


class CircuitState(Enum):
    CLOSED = "closed"  # Normal operation
    OPEN = "open"  # Failing, reject requests
    HALF_OPEN = "half_open"  # Testing if service recovered


class CircuitBreaker:
    """
    Circuit breaker for external service calls.
    
    Configuration:
    - failure_threshold: Number of failures before opening circuit
    - timeout_seconds: Time to wait before attempting half-open
    - success_threshold: Number of successes needed to close circuit
    """
    
    def __init__(
        self,
        name: str,
        failure_threshold: int = 5,
        timeout_seconds: int = 60,
        success_threshold: int = 2
    ):
        self.name = name
        self.failure_threshold = failure_threshold
        self.timeout_seconds = timeout_seconds
        self.success_threshold = success_threshold
        
        self.state = CircuitState.CLOSED
        self.failure_count = 0
        self.success_count = 0
        self.last_failure_time: Optional[datetime] = None
        self.last_success_time: Optional[datetime] = None
    
    def call(self, func: Callable, *args, **kwargs) -> Any:
        """
        Execute function with circuit breaker protection.
        
        Raises:
            ExternalServiceError if circuit is open
        """
        # Check circuit state
        if self.state == CircuitState.OPEN:
            # Check if timeout has passed
            if self.last_failure_time and \
               datetime.utcnow() - self.last_failure_time > timedelta(seconds=self.timeout_seconds):
                logger.info(f"Circuit breaker {self.name} transitioning to HALF_OPEN")
                self.state = CircuitState.HALF_OPEN
                self.success_count = 0
            else:
                from .exceptions import ExternalServiceError
                raise ExternalServiceError(
                    service=self.name,
                    detail=f"Circuit breaker is OPEN. Service unavailable.",
                    metadata={
                        "circuit_state": self.state.value,
                        "last_failure": self.last_failure_time.isoformat() if self.last_failure_time else None
                    }
                )
        
        # Attempt call
        try:
            result = func(*args, **kwargs)
            
            # Success
            self._record_success()
            return result
            
        except Exception as e:
            # Failure
            self._record_failure()
            raise
    
    async def call_async(self, func: Callable, *args, **kwargs) -> Any:
        """Async version of call."""
        if self.state == CircuitState.OPEN:
            if self.last_failure_time and \
               datetime.utcnow() - self.last_failure_time > timedelta(seconds=self.timeout_seconds):
                logger.info(f"Circuit breaker {self.name} transitioning to HALF_OPEN")
                self.state = CircuitState.HALF_OPEN
                self.success_count = 0
            else:
                from .exceptions import ExternalServiceError
                raise ExternalServiceError(
                    service=self.name,
                    detail=f"Circuit breaker is OPEN. Service unavailable.",
                    metadata={
                        "circuit_state": self.state.value,
                        "last_failure": self.last_failure_time.isoformat() if self.last_failure_time else None
                    }
                )
        
        try:
            result = await func(*args, **kwargs)
            self._record_success()
            return result
        except Exception as e:
            self._record_failure()
            raise
    
    def _record_success(self):
        """Record successful call."""
        self.last_success_time = datetime.utcnow()
        
        if self.state == CircuitState.HALF_OPEN:
            self.success_count += 1
            if self.success_count >= self.success_threshold:
                logger.info(f"Circuit breaker {self.name} transitioning to CLOSED")
                self.state = CircuitState.CLOSED
                self.failure_count = 0
                self.success_count = 0
        elif self.state == CircuitState.CLOSED:
            # Reset failure count on success
            self.failure_count = 0
    
    def _record_failure(self):
        """Record failed call."""
        self.last_failure_time = datetime.utcnow()
        self.failure_count += 1
        
        if self.failure_count >= self.failure_threshold:
            logger.warning(
                f"Circuit breaker {self.name} opening after {self.failure_count} failures"
            )
            self.state = CircuitState.OPEN
            self.success_count = 0


# Global circuit breakers for external services
grok_circuit_breaker = CircuitBreaker("grok_api", failure_threshold=5, timeout_seconds=60)
ml_service_circuit_breaker = CircuitBreaker("ml_service", failure_threshold=3, timeout_seconds=30)
s3_circuit_breaker = CircuitBreaker("s3", failure_threshold=5, timeout_seconds=60)
