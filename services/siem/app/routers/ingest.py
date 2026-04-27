"""
SIEM Service — Ingest Router
HTTP endpoint for services to emit events.
This provides an alternative to the direct SQL insert approach
used by auth/mail/messaging services.
"""
from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
import json

from core.database import get_db
from core.schemas import EventIngest

router = APIRouter(prefix="/ingest", tags=["ingest"])


@router.post("", status_code=201)
def ingest_event(
    body: EventIngest,
    db: Session = Depends(get_db),
):
    """
    Receive a security event from any service.
    No JWT required — this is an internal service-to-service endpoint.
    In production, this should be locked to the backend Docker network.
    """
    db.execute(
        text("""
            INSERT INTO siem.events
                (event_type, severity, service, user_id, source_ip, payload, created_at)
            VALUES
                (:event_type, :severity, :service, :user_id, :source_ip, :payload, :created_at)
        """),
        {
            "event_type": body.event_type,
            "severity":   body.severity,
            "service":    body.service,
            "user_id":    body.user_id,
            "source_ip":  body.source_ip,
            "payload":    json.dumps(body.payload),
            "created_at": datetime.utcnow(),
        }
    )
    db.commit()
    return {"status": "ingested"}
