# app/utils/password_validator.py
"""
Password strength validation for Crime Tracer.

Enforces password requirements:
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one digit
- At least one special character
"""

import re
from typing import Tuple, List


# Password requirements
MIN_LENGTH = 8
REQUIRE_UPPERCASE = True
REQUIRE_LOWERCASE = True
REQUIRE_DIGIT = True
REQUIRE_SPECIAL = True

# Common weak passwords to reject
COMMON_PASSWORDS = {
    "password", "password123", "12345678", "qwerty123",
    "admin123", "letmein", "welcome123", "monkey123"
}


def validate_password_strength(password: str) -> Tuple[bool, List[str]]:
    """
    Validate password strength.
    
    Returns:
        (is_valid, list_of_errors)
    """
    errors = []
    
    # Check length
    if len(password) < MIN_LENGTH:
        errors.append(f"Password must be at least {MIN_LENGTH} characters long")
    
    # Check for common passwords
    if password.lower() in COMMON_PASSWORDS:
        errors.append("Password is too common. Please choose a stronger password")
    
    # Check requirements
    if REQUIRE_UPPERCASE and not re.search(r'[A-Z]', password):
        errors.append("Password must contain at least one uppercase letter")
    
    if REQUIRE_LOWERCASE and not re.search(r'[a-z]', password):
        errors.append("Password must contain at least one lowercase letter")
    
    if REQUIRE_DIGIT and not re.search(r'\d', password):
        errors.append("Password must contain at least one digit")
    
    if REQUIRE_SPECIAL and not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
        errors.append("Password must contain at least one special character (!@#$%^&*(),.?\":{}|<>)")
    
    # Check for common patterns
    if re.search(r'(.)\1{3,}', password):
        errors.append("Password contains too many repeated characters")
    
    # Check for sequential characters
    if re.search(r'(012|123|234|345|456|567|678|789|890|abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz)', password.lower()):
        errors.append("Password contains sequential characters")
    
    return len(errors) == 0, errors


def get_password_strength_score(password: str) -> int:
    """
    Calculate password strength score (0-100).
    
    Returns:
        Score from 0 (weak) to 100 (strong)
    """
    score = 0
    
    # Length scoring (0-25 points)
    if len(password) >= 8:
        score += 10
    if len(password) >= 12:
        score += 10
    if len(password) >= 16:
        score += 5
    
    # Character variety (0-40 points)
    if re.search(r'[a-z]', password):
        score += 10
    if re.search(r'[A-Z]', password):
        score += 10
    if re.search(r'\d', password):
        score += 10
    if re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
        score += 10
    
    # Complexity (0-35 points)
    unique_chars = len(set(password))
    if unique_chars >= len(password) * 0.7:
        score += 15
    if len(password) >= 12 and unique_chars >= 8:
        score += 10
    if not re.search(r'(.)\1{2,}', password):
        score += 10
    
    return min(100, score)
