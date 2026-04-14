"""
Authoritative complaint / case state machine.

ALL transitions must be validated through this module.
"""

from typing import Dict, List
from .constants import ComplaintState


# =========================
# ALLOWED TRANSITIONS
# =========================

ALLOWED_TRANSITIONS: Dict[ComplaintState, List[ComplaintState]] = {
    ComplaintState.FILED: [
        ComplaintState.STATION_POOL,
    ],

    ComplaintState.STATION_POOL: [
        ComplaintState.UNDER_INVESTIGATION,
        ComplaintState.ARCHIVED,  # rejected by quorum
    ],

    ComplaintState.UNDER_INVESTIGATION: [
        ComplaintState.RESOLVED_PENDING_CONFIRMATION,
        ComplaintState.CLOSED,  # officer can close case directly
        ComplaintState.STATION_POOL,  # transferred
    ],

    ComplaintState.RESOLVED_PENDING_CONFIRMATION: [
        ComplaintState.CLOSED,                 # victim confirmed / auto-close
        ComplaintState.UNDER_INVESTIGATION,    # victim rejected
    ],

    # terminal states
    ComplaintState.CLOSED: [],
    ComplaintState.ARCHIVED: [],
}


# =========================
# VALIDATION API
# =========================

def validate_transition(
    current: ComplaintState,
    target: ComplaintState,
):
    """
    Raises ValueError if transition is illegal.
    """
    allowed = ALLOWED_TRANSITIONS.get(current, [])
    if target not in allowed:
        raise ValueError(
            f"Illegal transition: {current.value} → {target.value}"
        )


def is_terminal(state: ComplaintState) -> bool:
    return state in (ComplaintState.CLOSED, ComplaintState.ARCHIVED)
