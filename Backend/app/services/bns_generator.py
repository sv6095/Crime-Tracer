# app/services/bns_generator.py
"""
Thin wrapper around Grok-based BNS generator.

Kept as a separate module so the rest of the code can keep importing
`generate_bns_sections` from here, but the logic is powered by Grok.
"""

from typing import List, Dict

from .grok_client import generate_bns_sections as _grok_bns


def generate_bns_sections(
    crime_type: str, description: str, location_text: str = ""
) -> List[Dict]:
    """
    Delegate to Grok-powered generator.
    Falls back to safe defaults if Grok is unavailable.
    """
    return _grok_bns(crime_type, description, location_text)
