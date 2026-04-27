"""
SIEM Service — Alerts Router
Alert listing, detail, and status management.
"""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc
from sqlalchemy.orm import Session

from core.database import get_db
from core.models import Alert, AppUser
from core.schemas import AlertOut, AlertListResponse, AlertStatusUpdate
from security.auth import get_current_admin

router = APIRouter(prefix="/alerts", tags=["alerts"])

# ── import the WS push helper (lazy, set by main.py) ─────────────────────────
_ws_broadcast = None

def set_ws_broadcast(fn):
    global _ws_broadcast
    _ws_broadcast = fn


def _build_alert_out(alert: Alert, username: str | None = None) -> AlertOut:
    return AlertOut(
        id=str(alert.id),
        alert_type=alert.alert_type,
        severity=alert.severity,
        user_id=str(alert.user_id),
        username=username,
        description=alert.description,
        evidence=alert.evidence or {},
        status=alert.status,
        created_at=alert.created_at,
        resolved_at=alert.resolved_at,
    )


@router.get("", response_model=AlertListResponse)
def list_alerts(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    status: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    _admin: dict = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Paginated alert listing. IT_ADMIN only."""
    query = db.query(Alert)

    if status:
        query = query.filter(Alert.status == status.upper())
    if severity:
        query = query.filter(Alert.severity == severity.upper())

    total = query.count()
    rows = (
        query
        .order_by(desc(Alert.created_at))
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

    alerts = [
        _build_alert_out(r, usernames.get(str(r.user_id)))
        for r in rows
    ]

    return AlertListResponse(alerts=alerts, total=total)


@router.get("/{alert_id}", response_model=AlertOut)
def get_alert(
    alert_id: str,
    _admin: dict = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Get a single alert by ID."""
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    user = db.query(AppUser).filter(AppUser.id == alert.user_id).first()
    return _build_alert_out(alert, user.username if user else None)


@router.patch("/{alert_id}/status", response_model=AlertOut)
def update_alert_status(
    alert_id: str,
    body: AlertStatusUpdate,
    _admin: dict = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Update alert status (acknowledge, resolve, dismiss). IT_ADMIN only."""
    valid_statuses = {"OPEN", "ACKNOWLEDGED", "RESOLVED", "DISMISSED"}
    if body.status.upper() not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")

    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    alert.status = body.status.upper()
    if alert.status == "RESOLVED":
        alert.resolved_at = datetime.utcnow()

    db.commit()
    db.refresh(alert)

    user = db.query(AppUser).filter(AppUser.id == alert.user_id).first()
    out = _build_alert_out(alert, user.username if user else None)

    # Push update via WebSocket
    if _ws_broadcast:
        import asyncio
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                loop.create_task(_ws_broadcast({
                    "type": "alert_updated",
                    "data": out.model_dump(mode="json"),
                }))
        except Exception:
            pass

    return out
