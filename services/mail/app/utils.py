"""
Mail Service — Utilities
File handling, email forwarding to MailHog, validation helpers.
"""
import os
import asyncio
import re
import smtplib
import uuid
from email import encoders
from email.mime.base import MIMEBase
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

from config import ALLOWED_DOMAINS, MAILHOG_HOST, MAILHOG_PORT, MAIL_UPLOAD_DIR


# ── Domain Validation ────────────────────────────────────────────────────────

def is_internal_email(email: str) -> bool:
    """
    Returns True only if the email domain is in ALLOWED_DOMAINS.
    Must be called BEFORE any database query to prevent leaking
    information about internal accounts to external addresses.
    """
    domain = email.split('@')[-1].lower()
    return domain in ALLOWED_DOMAINS


# ── Filename Sanitization ────────────────────────────────────────────────────

def sanitize_filename(filename: str) -> str:
    """
    Sanitize an uploaded filename to prevent path traversal attacks.
    - Strips directory components (e.g. ../../etc/passwd → passwd)
    - Replaces special chars with underscore
    - Enforces 255-char limit
    """
    filename = os.path.basename(filename)
    filename = re.sub(r'[^a-zA-Z0-9._-]', '_', filename)
    if len(filename) > 255:
        name, ext = os.path.splitext(filename)
        filename = name[:250] + ext
    return filename or "attachment"


def attachment_display_name(file_path: str) -> str:
    """Recover the user-facing filename from a stored attachment path."""
    filename = os.path.basename(file_path)
    return filename.split("_", 1)[1] if "_" in filename else filename


# ── Suspicious Content Detection ─────────────────────────────────────────────

SUSPICIOUS_PATTERNS = [
    (r'password\s*[=:]\s*\S+',    "credential in body"),
    (r'ssh\s+\S+@\S+',             "ssh command in body"),
    (r'api[_-]?key\s*[=:]\s*\S+', "api key in body"),
    (r'secret\s*[=:]\s*\S+',       "secret in body"),
    (r'token\s*[=:]\s*[A-Za-z0-9+/]{20,}', "token string in body"),
]

def detect_suspicious_content(body: str) -> Optional[str]:
    """
    Scan email body for patterns that may indicate credential exfiltration.
    Returns the description of the first match, or None if clean.
    """
    if not body:
        return None
    for pattern, description in SUSPICIOUS_PATTERNS:
        if re.search(pattern, body, re.IGNORECASE):
            return description
    return None


# ── MailHog Forwarding ───────────────────────────────────────────────────────

async def forward_to_mailhog(
    sender_email:    str,
    recipient_email: str,
    subject:         str,
    body:            str,
    attachment_path: Optional[str] = None
) -> bool:
    """
    Forward to MailHog. Runs sync SMTP in a thread pool to avoid
    blocking FastAPI's async event loop.
    """
    def _send_sync():
        msg = MIMEMultipart()
        msg['From']    = sender_email
        msg['To']      = recipient_email
        msg['Subject'] = subject
        msg.attach(MIMEText(body, 'plain', 'utf-8'))

        if attachment_path and os.path.exists(attachment_path):
            with open(attachment_path, 'rb') as f:
                part = MIMEBase('application', 'octet-stream')
                part.set_payload(f.read())
            encoders.encode_base64(part)
            filename = attachment_display_name(attachment_path)
            part.add_header('Content-Disposition', f'attachment; filename="{filename}"')
            msg.attach(part)

        with smtplib.SMTP(MAILHOG_HOST, MAILHOG_PORT) as server:
            server.send_message(msg)
        return True

    try:
        return await asyncio.to_thread(_send_sync)
    except Exception as e:
        print(f"[MailHog] Forward failed (non-fatal): {e}")
        return False


# ── File Storage ─────────────────────────────────────────────────────────────

def save_attachment(content: bytes, original_filename: str) -> str:
    """
    Save an uploaded attachment to disk.
    Returns the full path where the file was saved.
    The filename is sanitized and prefixed with a UUID to avoid collisions.
    """
    os.makedirs(MAIL_UPLOAD_DIR, exist_ok=True)

    safe_name = sanitize_filename(original_filename)
    file_path = os.path.join(MAIL_UPLOAD_DIR, f"{uuid.uuid4()}_{safe_name}")

    with open(file_path, "wb") as f:
        f.write(content)

    return file_path
