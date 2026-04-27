"""
SIEM Service — Pydantic Schemas
Request/response models for the SIEM REST API.
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel


# ── Events ────────────────────────────────────────────────────────────────────

class EventOut(BaseModel):
    id: int
    event_type: str
    severity: str
    service: str
    user_id: Optional[str] = None
    username: Optional[str] = None
    source_ip: Optional[str] = None
    payload: dict = {}
    created_at: datetime

    class Config:
        from_attributes = True


class EventListResponse(BaseModel):
    events: list[EventOut]
    total: int


# ── Alerts ────────────────────────────────────────────────────────────────────

class AlertOut(BaseModel):
    id: str
    alert_type: str
    severity: str
    user_id: str
    username: Optional[str] = None
    description: str
    evidence: dict = {}
    status: str = "OPEN"
    created_at: datetime
    resolved_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AlertListResponse(BaseModel):
    alerts: list[AlertOut]
    total: int


class AlertStatusUpdate(BaseModel):
    status: str      # OPEN | ACKNOWLEDGED | RESOLVED | DISMISSED
    note: Optional[str] = None


# ── Baselines ─────────────────────────────────────────────────────────────────

class BaselineOut(BaseModel):
    user_id: str
    username: Optional[str] = None
    avg_login_hour: float
    known_ips: list[str] = []
    avg_messages_day: float
    avg_files_day: float
    avg_emails_day: float
    confidence: float
    tx_count: int
    last_updated: datetime

    class Config:
        from_attributes = True


# ── Ingest (for the middleware POST) ──────────────────────────────────────────

class EventIngest(BaseModel):
    event_type: str
    severity: str
    service: str
    user_id: Optional[str] = None
    source_ip: Optional[str] = None
    payload: dict = {}
