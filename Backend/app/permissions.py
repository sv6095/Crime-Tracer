"""
Centralized permission checks.

These helpers enforce:
- role correctness
- admin hard-gating
- archived cop blocking
- future extensibility (without duplicating logic)
"""

from fastapi import HTTPException, status
from .constants import Role


def require_role(user, required: Role):
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    if user.role != required:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"{required.value} role required",
        )

    return user


def ensure_active_user(user):
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive",
        )
    return user


def ensure_cop_approved(user):
    """
    Hard gate for cops.
    """
    if user.role != Role.COP:
        return user

    if user.pending_approval:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cop account pending admin approval",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cop account archived or inactive",
        )

    return user


def ensure_admin(user):
    ensure_active_user(user)
    require_role(user, Role.ADMIN)
    return user
