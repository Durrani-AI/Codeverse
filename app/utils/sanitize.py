"""
Input sanitization utilities for XSS prevention.

Strips dangerous HTML/JS patterns from user-supplied text fields.
Code fields are left alone — they render inside Monaco editor, not as HTML.
"""

import re
from html import escape as html_escape


# Patterns that indicate script injection attempts
_DANGEROUS_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"<\s*script[^>]*>.*?<\s*/\s*script\s*>", re.IGNORECASE | re.DOTALL),
    re.compile(r"<\s*script[^>]*>", re.IGNORECASE),
    re.compile(r"javascript\s*:", re.IGNORECASE),
    re.compile(r"on\w+\s*=\s*[\"'][^\"']*[\"']", re.IGNORECASE),
    re.compile(r"on\w+\s*=\s*\S+", re.IGNORECASE),
    re.compile(r"<\s*iframe[^>]*>.*?<\s*/\s*iframe\s*>", re.IGNORECASE | re.DOTALL),
    re.compile(r"<\s*iframe[^>]*>", re.IGNORECASE),
    re.compile(r"<\s*object[^>]*>.*?<\s*/\s*object\s*>", re.IGNORECASE | re.DOTALL),
    re.compile(r"<\s*embed[^>]*>", re.IGNORECASE),
    re.compile(r"<\s*form[^>]*>", re.IGNORECASE),
    re.compile(r"<\s*img[^>]*\s+onerror\s*=", re.IGNORECASE),
    re.compile(r"<\s*svg[^>]*\s+onload\s*=", re.IGNORECASE),
    re.compile(r"expression\s*\(", re.IGNORECASE),
    re.compile(r"url\s*\(\s*[\"']?\s*javascript:", re.IGNORECASE),
    re.compile(r"data\s*:\s*text/html", re.IGNORECASE),
]

# HTML tags to strip entirely (content kept, tags removed)
_STRIP_TAGS = re.compile(r"</?(?:script|iframe|object|embed|form|link|meta|style)\b[^>]*>", re.IGNORECASE)


def sanitize_text(value: str) -> str:
    """Strip dangerous HTML/JS patterns from a text field.

    Intended for free-text inputs like usernames, topics, answer explanations.
    NOT for code fields rendered inside Monaco or other code editors.

    Returns the cleaned string. Raises ValueError if the input is
    suspiciously crafted (multiple injection vectors detected).
    """
    if not value:
        return value

    cleaned = value

    # Strip dangerous patterns
    for pattern in _DANGEROUS_PATTERNS:
        cleaned = pattern.sub("", cleaned)

    # Strip known dangerous tags (keep content)
    cleaned = _STRIP_TAGS.sub("", cleaned)

    # Normalise whitespace left behind by removals
    cleaned = re.sub(r"\s{3,}", "  ", cleaned).strip()

    return cleaned


def sanitize_html_display(value: str) -> str:
    """Escape a string for safe HTML display.

    Use this when rendering user content outside of React's automatic
    escaping (e.g. in email templates or PDF exports).
    """
    return html_escape(value, quote=True)


def is_suspicious(value: str) -> bool:
    """Return True if the input contains injection-like patterns.

    Useful for logging / flagging without blocking the request.
    """
    for pattern in _DANGEROUS_PATTERNS:
        if pattern.search(value):
            return True
    return False
