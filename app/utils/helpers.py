"""
Reusable helper utilities used across the application.
"""

import uuid
from datetime import datetime, timedelta, timezone


def new_uuid() -> str:
    """Generate a UUID-4 string."""
    return str(uuid.uuid4())


def utc_now() -> datetime:
    """Return the current UTC datetime (timezone-aware)."""
    return datetime.now(timezone.utc)


def minutes_from_now(minutes: int) -> datetime:
    """Return a UTC datetime *minutes* from now."""
    return datetime.now(timezone.utc) + timedelta(minutes=minutes)


def clamp(value: int | float, lo: int | float, hi: int | float) -> int | float:
    """Clamp *value* between *lo* and *hi* inclusive."""
    return max(lo, min(value, hi))


def truncate(text: str, max_length: int = 500, suffix: str = "...") -> str:
    """Truncate *text* to *max_length* characters, appending *suffix* if cut."""
    if len(text) <= max_length:
        return text
    return text[: max_length - len(suffix)] + suffix
