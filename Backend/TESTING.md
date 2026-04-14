# Testing Guide

## Quick Start

Run all tests:
```bash
cd Backend
python scripts/run_tests.py
```

Run with coverage:
```bash
python scripts/run_tests.py --coverage
```

## Test Structure

### Unit Tests
- `test_auth_security.py` - Authentication and security features
- `test_error_handling.py` - Error handling and resilience patterns
- `test_database_migrations.py` - Database migration system
- `test_firebase_service.py` - Firebase service layer

### Integration Tests
- `test_integration.py` - End-to-end authentication flows
- `test_crime_tracer_full_flow.py` - Complete application flow

## Test Coverage

### ✅ Covered Features

**Authentication & Security:**
- Password strength validation (8+ tests)
- Account lockout mechanism (6+ tests)
- Token refresh flow (4+ tests)
- Failed login tracking
- Registration and login endpoints

**Error Handling:**
- Custom exception classes (6+ tests)
- Circuit breaker pattern (5+ tests)
- Retry logic (4+ tests)
- Standardized error responses

**Database:**
- Alembic configuration (4+ tests)
- Schema validation (5+ tests)
- Migration scripts (2+ tests)

**Firebase:**
- Service initialization (3+ tests)
- Fallback mechanism (2+ tests)
- Error handling (3+ tests)

**Integration:**
- Complete auth flows
- Account lockout scenarios
- Error response formats

## Running Specific Tests

### Run a single test file
```bash
python scripts/run_tests.py tests/test_auth_security.py
```

### Run a specific test class
```bash
python scripts/run_tests.py tests/test_auth_security.py::TestPasswordValidation
```

### Run a specific test
```bash
python scripts/run_tests.py tests/test_auth_security.py::TestPasswordValidation::test_strong_password_accepted
```

### Run with markers
```bash
# Run only unit tests
python -m pytest -m unit

# Run only integration tests
python -m pytest -m integration

# Skip slow tests
python -m pytest -m "not slow"
```

## Test Environment

Tests use:
- **Database**: In-memory SQLite (`sqlite:///:memory:`)
- **Environment**: `ENV=test`
- **Isolation**: Fresh database for each test
- **Fixtures**: Shared test fixtures in `conftest.py`

## Writing New Tests

### Example Test Structure

```python
import pytest
from fastapi.testclient import TestClient

def test_feature_name(client: TestClient, db: Session):
    """Test description."""
    # Arrange
    # Act
    response = client.get("/api/endpoint")
    # Assert
    assert response.status_code == 200
```

### Using Fixtures

```python
def test_with_user(client: TestClient, test_user: models.User):
    """Test that uses a test user fixture."""
    response = client.get(f"/api/users/{test_user.id}")
    assert response.status_code == 200
```

## Continuous Integration

Tests run automatically via GitHub Actions:
- On every pull request
- On pushes to main branch
- See `.github/workflows/backend-tests.yml`

## Test Results

View coverage reports:
- HTML: `htmlcov/index.html`
- Terminal: Shown after test run
- XML: `coverage.xml` (for CI)

## Troubleshooting

### Import Errors
- Ensure you're in the `Backend` directory
- Check that `app` module is importable
- Verify virtual environment is activated

### Database Errors
- Tests use in-memory SQLite, no setup needed
- Each test gets a fresh database
- Check `conftest.py` for database fixtures

### Firebase Tests Failing
- Firebase tests use mocks (Firebase not required)
- Check that mocks are properly configured
- Service should fallback to SQLite gracefully
