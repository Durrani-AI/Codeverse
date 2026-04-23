"""
Email service abstraction.

In development, emails are logged to console with clickable links.
In production, swap this with SendGrid / SES / SMTP integration.
"""

import logging
from typing import Optional

from app.config import settings

logger = logging.getLogger(__name__)

# Base URL for frontend links in emails
_FRONTEND_URL = "https://ai-codeverse.vercel.app"
if settings.DEBUG:
    _FRONTEND_URL = "http://localhost:3000"


async def send_password_reset_email(email: str, token: str) -> None:
    """Send a password reset link.

    In development, logs the link to console.
    In production, integrate with an email provider.
    """
    reset_url = f"{_FRONTEND_URL}/reset-password?token={token}"

    logger.info(
        "\n"
        "═══════════════════════════════════════════════\n"
        " PASSWORD RESET REQUESTED\n"
        "═══════════════════════════════════════════════\n"
        " Email: %s\n"
        " Reset URL: %s\n"
        " Expires: 1 hour\n"
        "═══════════════════════════════════════════════",
        email,
        reset_url,
    )

    # TODO: In production, send actual email via SendGrid / SES / SMTP
    # Example with SendGrid:
    # import sendgrid
    # sg = sendgrid.SendGridAPIClient(api_key=settings.SENDGRID_API_KEY)
    # message = Mail(
    #     from_email="noreply@codeverse.dev",
    #     to_emails=email,
    #     subject="Reset Your Codeverse Password",
    #     html_content=f"<a href='{reset_url}'>Reset Password</a>",
    # )
    # sg.send(message)


async def send_verification_email(email: str, token: str) -> None:
    """Send an email verification link.

    In development, logs the link to console.
    In production, integrate with an email provider.
    """
    verify_url = f"{_FRONTEND_URL}/verify-email?token={token}"

    logger.info(
        "\n"
        "═══════════════════════════════════════════════\n"
        " EMAIL VERIFICATION\n"
        "═══════════════════════════════════════════════\n"
        " Email: %s\n"
        " Verify URL: %s\n"
        " Expires: 24 hours\n"
        "═══════════════════════════════════════════════",
        email,
        verify_url,
    )
