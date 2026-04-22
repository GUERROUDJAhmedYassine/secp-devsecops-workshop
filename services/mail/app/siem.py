"""
Mail Service — SIEM Integration
All events emitted by the mail service go through this module.
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
    user_id:    Optional[str] = None,
    source_ip:  Optional[str] = None,
    payload:    Optional[dict] = None
) -> None:
    """
    Write a structured event to siem.events.

    Never raises — a SIEM failure must not break the main operation.
    The append-only trigger on siem.events means this is insert-only.

    Severity levels: INFO | LOW | MEDIUM | HIGH | CRITICAL
    """
    try:
        db.execute(
            text("""
                INSERT INTO siem.events
                    (event_type, severity, service, user_id, source_ip, payload, created_at)
                VALUES
                    (:event_type, :severity, 'mail', :user_id, :source_ip, :payload, :created_at)
            """),
            {
                "event_type": event_type,
                "severity":   severity,
                "user_id":    user_id,
                "source_ip":  source_ip,
                "payload":    json.dumps(payload or {}),
                "created_at": datetime.utcnow(),
            }
        )
        db.commit()
    except Exception as e:
        db.rollback()
        # Log to stdout — visible in docker compose logs
        print(f"[SIEM][mail] Failed to emit {event_type}: {e}")


# ── Event type constants ──────────────────────────────────────────────────────
# Using constants avoids typos across the codebase.

EMAIL_SENT              = "EMAIL_SENT"
EMAIL_REJECTED          = "EMAIL_REJECTED"
EMAIL_DELETED           = "EMAIL_DELETED"
EXTERNAL_RELAY_ATTEMPT  = "EXTERNAL_RELAY_ATTEMPT"
ATTACHMENT_TOO_LARGE    = "ATTACHMENT_TOO_LARGE"
SUSPICIOUS_CONTENT      = "SUSPICIOUS_EMAIL_CONTENT"
MASS_EMAIL_BURST        = "MASS_EMAIL_BURST"
UNAUTHORIZED_ACCESS     = "UNAUTHORIZED_EMAIL_ACCESS"
