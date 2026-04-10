import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, Integer, Text, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from database import Base
import enum


class UserRole(str, enum.Enum):
    EMPLOYEE = "EMPLOYEE"
    MANAGER  = "MANAGER"
    IT_ADMIN = "IT_ADMIN"


class User(Base):
    __tablename__  = "users"
    __table_args__ = {"schema": "app"}

    id             = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username       = Column(String(50),  unique=True, nullable=False)
    email          = Column(String(100), unique=True, nullable=False)
    password_hash  = Column(String(255), nullable=False)
    role           = Column(SAEnum(UserRole, schema="app", name="user_role"), nullable=False)
    department     = Column(String(100), nullable=True)
    is_active      = Column(Boolean,  default=True)
    failed_logins  = Column(Integer,  default=0)
    locked_until   = Column(DateTime, nullable=True)
    vpn_public_key = Column(Text,     nullable=True)
    last_login_at  = Column(DateTime, nullable=True)
    created_at     = Column(DateTime, default=datetime.utcnow)


class RefreshToken(Base):
    __tablename__  = "refresh_tokens"
    __table_args__ = {"schema": "app"}

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id    = Column(UUID(as_uuid=True), nullable=False)
    token      = Column(Text,     nullable=False, unique=True)
    is_revoked = Column(Boolean,  default=False)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
