"""
SIEM Service — Baselines Router
Behavioral baseline data per user.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from core.database import get_db
from core.models import UserBaseline, AppUser
from core.schemas import BaselineOut
from security.auth import get_current_admin

router = APIRouter(prefix="/baselines", tags=["baselines"])


@router.get("", response_model=list[BaselineOut])
def list_baselines(
    _admin: dict = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """List all user baselines. IT_ADMIN only."""
    rows = db.query(UserBaseline).all()

    user_ids = {r.user_id for r in rows}
    usernames = {}
    if user_ids:
        users = db.query(AppUser).filter(AppUser.id.in_(user_ids)).all()
        usernames = {str(u.id): u.username for u in users}

    return [
        BaselineOut(
            user_id=str(r.user_id),
            username=usernames.get(str(r.user_id)),
            avg_login_hour=r.avg_login_hour,
            known_ips=[str(ip) for ip in (r.known_ips or [])],
            avg_messages_day=r.avg_messages_day,
            avg_files_day=r.avg_files_day,
            avg_emails_day=r.avg_emails_day,
            confidence=r.confidence,
            tx_count=r.tx_count,
            last_updated=r.last_updated,
        )
        for r in rows
    ]


@router.get("/{user_id}", response_model=BaselineOut)
def get_baseline(
    user_id: str,
    _admin: dict = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Get baseline for a specific user."""
    row = db.query(UserBaseline).filter(UserBaseline.user_id == user_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Baseline not found")

    user = db.query(AppUser).filter(AppUser.id == row.user_id).first()

    return BaselineOut(
        user_id=str(row.user_id),
        username=user.username if user else None,
        avg_login_hour=row.avg_login_hour,
        known_ips=[str(ip) for ip in (row.known_ips or [])],
        avg_messages_day=row.avg_messages_day,
        avg_files_day=row.avg_files_day,
        avg_emails_day=row.avg_emails_day,
        confidence=row.confidence,
        tx_count=row.tx_count,
        last_updated=row.last_updated,
    )
