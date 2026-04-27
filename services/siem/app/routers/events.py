"""
SIEM Service — Events Router
Paginated event log with filtering.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from datetime import datetime
from typing import Optional

from core.database import get_db
from core.models import SiemEvent, AppUser
from core.schemas import EventOut, EventListResponse
from security.auth import get_current_admin

router = APIRouter(prefix="/events", tags=["events"])


@router.get("", response_model=EventListResponse)
def list_events(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    severity: Optional[str] = Query(None),
    event_type: Optional[str] = Query(None),
    service: Optional[str] = Query(None),
    user_id: Optional[str] = Query(None),
    _admin: dict = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Paginated, filterable event log. IT_ADMIN only."""
    query = db.query(SiemEvent)

    if severity:
        query = query.filter(SiemEvent.severity == severity.upper())
    if event_type:
        query = query.filter(SiemEvent.event_type == event_type)
    if service:
        query = query.filter(SiemEvent.service == service)
    if user_id:
        query = query.filter(SiemEvent.user_id == user_id)

    total = query.count()
    rows = (
        query
        .order_by(desc(SiemEvent.created_at))
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    # Resolve usernames
    user_ids = {r.user_id for r in rows if r.user_id}
    usernames = {}
    if user_ids:
        users = db.query(AppUser).filter(AppUser.id.in_(user_ids)).all()
        usernames = {str(u.id): u.username for u in users}

    events = []
    for r in rows:
        uid = str(r.user_id) if r.user_id else None
        events.append(EventOut(
            id=r.id,
            event_type=r.event_type,
            severity=r.severity,
            service=r.service,
            user_id=uid,
            username=usernames.get(uid) if uid else None,
            source_ip=str(r.source_ip) if r.source_ip else None,
            payload=r.payload or {},
            created_at=r.created_at,
        ))

    return EventListResponse(events=events, total=total)
