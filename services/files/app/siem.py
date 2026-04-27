"""
SIEM Event Emitter — Middleware Snippet for Files Service
Copy this pattern to any new service to emit events to siem.events.

Usage in your endpoints:
    from siem import siem_emit, FILE_UPLOADED, FILE_DOWNLOAD
    siem_emit(db, FILE_UPLOADED, "INFO", user_id=str(user.id), source_ip=ip,
              payload={"filename": f.filename, "size": f.size})
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
    service:    str = "files",
    user_id:    Optional[str] = None,
    source_ip:  Optional[str] = None,
    payload:    Optional[dict] = None,
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
                    (:event_type, :severity, :service, :user_id, :source_ip, :payload, :created_at)
            """),
            {
                "event_type": event_type,
                "severity":   severity,
                "service":    service,
                "user_id":    user_id,
                "source_ip":  source_ip,
                "payload":    json.dumps(payload or {}),
                "created_at": datetime.utcnow(),
            }
        )
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"[SIEM][{service}] Failed to emit {event_type}: {e}")


# ── Event type constants ──────────────────────────────────────────────────────

FILE_UPLOADED          = "FILE_UPLOADED"
FILE_DOWNLOAD          = "FILE_DOWNLOAD"
FILE_DELETED           = "FILE_DELETED"
UNAUTHORIZED_ACCESS    = "UNAUTHORIZED_FILE_ACCESS"
UPLOAD_SIZE_EXCEEDED   = "UPLOAD_SIZE_EXCEEDED"
