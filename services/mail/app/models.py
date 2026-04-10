"""
Mail Service — SQLAlchemy Models
Maps to tables in the app schema (defined in db/init.sql).
These models do NOT create tables — init.sql does that.
"""
from sqlalchemy import (
    Column, String, Boolean, DateTime, Text,
    ForeignKey
)
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
import uuid

from database import Base


class User(Base):
    """
    Minimal User model — only fields the mail service needs.
    Full user management is in the auth service.
    """
    __tablename__ = "users"
    __table_args__ = {"schema": "app"}

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username   = Column(String(50),  unique=True, nullable=False)
    email      = Column(String(100), unique=True, nullable=False)
    is_active  = Column(Boolean, default=True, nullable=False)


class Email(Base):
    __tablename__ = "emails"
    __table_args__ = {"schema": "app"}

    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sender_id       = Column(UUID(as_uuid=True), ForeignKey("app.users.id"), nullable=False)
    recipient_id    = Column(UUID(as_uuid=True), ForeignKey("app.users.id"), nullable=False)
    subject         = Column(String(500),  nullable=False)
    body            = Column(Text,         nullable=True)
    has_attachment  = Column(Boolean,      default=False, nullable=False)
    attachment_path = Column(Text,         nullable=True)

    is_read    = Column(Boolean,   default=False,           nullable=False)
    is_deleted = Column(Boolean,   default=False,           nullable=False)
    sent_at    = Column(DateTime,  default=datetime.utcnow, nullable=False)

    sender    = relationship("User", foreign_keys=[sender_id],    backref="sent_emails")
    recipient = relationship("User", foreign_keys=[recipient_id], backref="received_emails")
