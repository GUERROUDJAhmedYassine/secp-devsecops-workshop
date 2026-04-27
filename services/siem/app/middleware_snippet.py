"""
═══════════════════════════════════════════════════════════════════════
 SIEM Middleware Snippet — Copy into Any Service
═══════════════════════════════════════════════════════════════════════

 This file provides two approaches for emitting SIEM events:

 1. SYNC (SQLAlchemy + psycopg2) — for auth, mail, files services
 2. ASYNC (asyncpg) — for messaging service

 Copy the appropriate version into your service's `siem.py` or
 `siem/emitter.py` file. Both write to the same siem.events table.

 ── Usage (Sync — auth/mail/files) ──────────────────────────────────

    from siem import siem_emit
    siem_emit(db, "LOGIN_SUCCESS", "INFO",
              user_id=str(user.id),
              source_ip=request.client.host,
              payload={"method": "password"})

 ── Usage (Async — messaging) ──────────────────────────────────────

    from siem.emitter import emit
    await emit(event_type="MESSAGE_SENT", severity="INFO",
               service="messaging", user_id=user_id,
               source_ip=None, payload={"to": recipient})

═══════════════════════════════════════════════════════════════════════
"""

# ═══════════════════════════════════════════════════════════════════
# APPROACH 1: SYNC (SQLAlchemy) — for auth, mail, files services
# Copy this into your service as `app/siem.py`
# ═══════════════════════════════════════════════════════════════════

SYNC_TEMPLATE = '''
"""
{SERVICE_NAME} Service — SIEM Integration
All events emitted by the {service_name} service go through this module.
Events are written directly to siem.events in PostgreSQL.
"""
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime
from typing import Optional
import json


def siem_emit(
    db:         Session,
    event_type: str,
    severity:   str,
    service:    str = "{service_name}",
    user_id:    Optional[str] = None,
    source_ip:  Optional[str] = None,
    payload:    Optional[dict] = None,
) -> None:
    """
    Write a structured event to siem.events.
    Never raises — a SIEM failure must not break the main operation.
    Severity levels: INFO | LOW | MEDIUM | HIGH | CRITICAL
    """
    try:
        db.execute(
            text("""
                INSERT INTO siem.events
                    (event_type, severity, service, user_id, source_ip, payload, created_at)
                VALUES
                    (:event_type, :severity, :service, :user_id, :source_ip, :payload, :created_at)
            """),
            {{
                "event_type": event_type,
                "severity":   severity,
                "service":    service,
                "user_id":    user_id,
                "source_ip":  source_ip,
                "payload":    json.dumps(payload or {{}}),
                "created_at": datetime.utcnow(),
            }}
        )
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"[SIEM][{service_name}] Failed to emit {{event_type}}: {{e}}")


# ── Event type constants ──────────────────────────────────────────
# Customize these for your service
{EVENT_CONSTANTS}
'''

# ═══════════════════════════════════════════════════════════════════
# APPROACH 2: ASYNC (asyncpg) — for messaging service
# Copy this into your service as `app/siem/emitter.py`
# ═══════════════════════════════════════════════════════════════════

ASYNC_TEMPLATE = '''
import logging
import json
import asyncio
from typing import Optional
from core.database import db

logger = logging.getLogger(__name__)

async def _write_to_db(event_type, severity, service, user_id, source_ip, payload):
    query = """
        INSERT INTO siem.events (event_type, severity, service, user_id, source_ip, payload)
        VALUES ($1, $2, $3, $4, $5, $6::jsonb)
    """
    try:
        if db.pool is not None:
            payload_str = json.dumps(payload)
            await db.pool.execute(query, event_type, severity, service,
                                  user_id, source_ip, payload_str)
    except Exception as e:
        logger.error(f"Failed to emit SIEM event silently: {e}")

async def emit(event_type, severity, service, user_id, source_ip, payload):
    """Emits security events in the background without blocking."""
    asyncio.create_task(
        _write_to_db(event_type, severity, service, user_id, source_ip, payload)
    )
'''

# ═══════════════════════════════════════════════════════════════════
# STANDARD EVENT TYPES — Use these across all services
# ═══════════════════════════════════════════════════════════════════

STANDARD_EVENTS = {
    "auth": [
        "LOGIN_SUCCESS",
        "LOGIN_FAILED",
        "LOGOUT",
        "TOKEN_REFRESH",
        "PASSWORD_CHANGED",
        "ACCOUNT_LOCKED",
        "ACCOUNT_SUSPENDED",
        "ACCOUNT_CREATED",
        "ROLE_CHANGED",
    ],
    "mail": [
        "EMAIL_SENT",
        "EMAIL_REJECTED",
        "EMAIL_DELETED",
        "EXTERNAL_RELAY_ATTEMPT",
        "ATTACHMENT_TOO_LARGE",
        "SUSPICIOUS_EMAIL_CONTENT",
        "MASS_EMAIL_BURST",
        "UNAUTHORIZED_EMAIL_ACCESS",
    ],
    "messaging": [
        "MESSAGE_SENT",
        "MESSAGE_READ",
        "MASS_MESSAGE_BURST",
        "ROOM_CREATED",
        "ROOM_JOINED",
    ],
    "files": [
        "FILE_UPLOADED",
        "FILE_DOWNLOAD",
        "FILE_DELETED",
        "UNAUTHORIZED_FILE_ACCESS",
        "UPLOAD_SIZE_EXCEEDED",
    ],
}
