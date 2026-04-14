#!/usr/bin/env python
"""
Script to run tests with proper configuration.

Usage:
    python scripts/run_tests.py                    # Run all tests
    python scripts/run_tests.py test_auth_security.py  # Run specific test file
    python scripts/run_tests.py --coverage         # Run with coverage
"""

import sys
import os
import subprocess
from pathlib import Path

# Get the Backend directory
backend_dir = Path(__file__).resolve().parent.parent
os.chdir(backend_dir)

def main():
    """Run pytest with appropriate arguments."""
    # Set test environment
    os.environ.setdefault("ENV", "test")
    os.environ.setdefault("SECRET_KEY", "test-secret-key-for-testing-only")
    os.environ.setdefault("SQLALCHEMY_DATABASE_URL", "sqlite:///:memory:")
    
    # Build pytest command
    pytest_args = ["python", "-m", "pytest", "-v"]
    
    # Add coverage if requested
    if "--coverage" in sys.argv:
        pytest_args.extend(["--cov=app", "--cov-report=html", "--cov-report=term-missing"])
        sys.argv.remove("--coverage")
    
    # Add any additional arguments
    if len(sys.argv) > 1:
        pytest_args.extend(sys.argv[1:])
    
    # Run pytest
    result = subprocess.run(pytest_args)
    sys.exit(result.returncode)

if __name__ == "__main__":
    main()
