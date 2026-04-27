"""
SIEM Service — SQLAlchemy Models
Maps to tables in the siem schema (defined in db/init.sql).
These models do NOT create tables — init.sql does that.
"""
import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Boolean, DateTime, Text, Integer, Float,
    BigInteger, ForeignKey
)
from sqlalchemy.dialects.postgresql import UUID, JSONB, INET, ARRAY
from core.database import Base


class SiemEvent(Base):
    """siem.events — append-only audit log."""
    __tablename__ = "events"
    __table_args__ = {"schema": "siem"}

    id         = Column(BigInteger, primary_key=True, autoincrement=True)
    event_type = Column(String(50),  nullable=False)
    severity   = Column(String(10),  nullable=False)
    service    = Column(String(20),  nullable=False)
    user_id    = Column(UUID(as_uuid=True), nullable=True)
    source_ip  = Column(INET,        nullable=True)
    payload    = Column(JSONB,       nullable=False, server_default="{}")
    created_at = Column(DateTime,    default=datetime.utcnow)


class Alert(Base):
    """siem.alerts — detection engine output."""
    __tablename__ = "alerts"
    __table_args__ = {"schema": "siem"}

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    alert_type  = Column(String(50),  nullable=False)
    severity    = Column(String(10),  nullable=False)
    user_id     = Column(UUID(as_uuid=True), nullable=False)
    description = Column(Text,        nullable=False)
    evidence    = Column(JSONB,       nullable=False, server_default="{}")
    status      = Column(String(15),  default="OPEN")
    created_at  = Column(DateTime,    default=datetime.utcnow)
    resolved_at = Column(DateTime,    nullable=True)


class UserBaseline(Base):
    """siem.user_baselines — per-user behavioral profile."""
    __tablename__ = "user_baselines"
    __table_args__ = {"schema": "siem"}

    user_id          = Column(UUID(as_uuid=True), primary_key=True)
    avg_login_hour   = Column(Float,   default=12.0)
    known_ips        = Column(ARRAY(INET), server_default="{}")
    avg_messages_day = Column(Float,   default=0.0)
    avg_files_day    = Column(Float,   default=0.0)
    avg_emails_day   = Column(Float,   default=0.0)
    confidence       = Column(Float,   default=0.0)
    tx_count         = Column(Integer, default=0)
    last_updated     = Column(DateTime, default=datetime.utcnow)


class AppUser(Base):
    """Read-only mirror of app.users for FK resolution."""
    __tablename__ = "users"
    __table_args__ = {"schema": "app"}

    id            = Column(UUID(as_uuid=True), primary_key=True)
    username      = Column(String(50),  unique=True, nullable=False)
    email         = Column(String(100), unique=True, nullable=False)
    is_active     = Column(Boolean, default=True)
    last_login_at = Column(DateTime, nullable=True)
    created_at    = Column(DateTime, default=datetime.utcnow)
