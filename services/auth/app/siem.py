from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import text


def siem_emit(
    db: Session,
    event_type: str,
    severity: str,
    user_id: str | None = None,
    source_ip: str | None = None,
    payload: dict | None = None,
):
    """
    Write a structured event directly to siem.events.
    Called from every auth endpoint — this is how the detection
    engine gets its data.
    """
    db.execute(
        text("""
            INSERT INTO siem.events
                (event_type, severity, service, user_id, source_ip, payload, created_at)
            VALUES
                (:event_type, :severity, 'auth', :user_id, :source_ip, :payload, :created_at)
        """),
        {
            "event_type": event_type,
            "severity":   severity,
            "user_id":    user_id,
            "source_ip":  source_ip,
            "payload":    __import__("json").dumps(payload or {}),
            "created_at": datetime.utcnow(),
        }
    )
    db.commit()
