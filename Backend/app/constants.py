"""
Authoritative constants for Crime Tracer Mangalore.

This file MUST NOT import from application modules.
Other modules may import from here.
"""

from enum import Enum


# =========================
# USER / ROLE CONSTANTS
# =========================

class Role(str, Enum):
    VICTIM = "VICTIM"
    COP = "COP"
    ADMIN = "ADMIN"


# =========================
# COMPLAINT / CASE STATES
# =========================

class ComplaintState(str, Enum):
    """
    Complaint lifecycle states.

    NOTE:
    - CLOSED = resolved + confirmed / auto-confirmed
    - ARCHIVED = rejected / invalid / administratively closed
    """

    FILED = "FILED"                         # created by victim
    STATION_POOL = "STATION_POOL"           # visible to station cops
    UNDER_INVESTIGATION = "UNDER_INVESTIGATION"
    RESOLVED_PENDING_CONFIRMATION = "RESOLVED_PENDING_CONFIRMATION"
    CLOSED = "CLOSED"
    ARCHIVED = "ARCHIVED"


# =========================
# ACTOR TYPES (for logs)
# =========================

class ActorType(str, Enum):
    VICTIM = "victim"
    COP = "cop"
    ADMIN = "admin"
    SYSTEM = "system"


# =========================
# AI / ML FLAGS
# =========================

class MLStatus(str, Enum):
    OK = "OK"
    DEGRADED = "DEGRADED"
    UNAVAILABLE = "UNAVAILABLE"


# =========================
# SYSTEM CONSTANTS
# =========================

# Complaint rejection rules
DEFAULT_REJECTION_QUORUM = 5

# Victim confirmation window (hours)
VICTIM_CONFIRMATION_WINDOW_HOURS = 24

# Rate limits (used later by utils/rate_limiter.py)
TRACKING_RATE_LIMIT_WINDOW_SEC = 60
TRACKING_RATE_LIMIT_MAX = 10
