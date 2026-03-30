import re
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional
from models import UserRole

def _validate_password_complexity(value: str) -> str:
    if len(value) < 8:
        raise ValueError("Password must be at least 8 characters long")
    if len(value.encode("utf-8")) > 72:
        raise ValueError("Password is too long (bcrypt supports max 72 bytes)")
    if not re.search(r"[A-Z]", value):
        raise ValueError("Password must contain at least one uppercase letter")
    if not re.search(r"[a-z]", value):
        raise ValueError("Password must contain at least one lowercase letter")
    if not re.search(r"[0-9]", value):
        raise ValueError("Password must contain at least one digit")
    if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", value):
        raise ValueError("Password must contain at least one special character")
    return value
def _validate_password_72_bytes(value: str) -> str:
    if len(value.encode("utf-8")) > 72:
        raise ValueError("Password is too long (bcrypt supports max 72 bytes)")
    return value


class UserCreate(BaseModel):
    username:   str
    password:   str = Field(min_length=8)
    role:       UserRole
    department: Optional[str] = None

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        return _validate_password_complexity(v)


class UserLogin(BaseModel):
    username: str
    password: str

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        return _validate_password_72_bytes(v)


class PasswordChange(BaseModel):
    old_password: str
    new_password: str = Field(min_length=8)

    @field_validator("old_password")
    @classmethod
    def validate_old_password(cls, v: str) -> str:
        return _validate_password_72_bytes(v)

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, v: str) -> str:
        return _validate_password_complexity(v)


class TokenResponse(BaseModel):
    access_token:  str
    refresh_token: str
    token_type:    str = "bearer"


class UserResponse(BaseModel):
    id:         str
    username:   str
    email:      str
    role:       str
    department: Optional[str]
    is_active:  bool
    failed_logins: int = 0
    locked_until: Optional[datetime] = None
    risk_score: int = 0

    class Config:
        from_attributes = True

    @classmethod
    def build(cls, user):
        return cls(
            id=str(user.id),
            username=user.username,
            email=user.email,
            role=user.role.value if hasattr(user.role, "value") else str(user.role),
            department=user.department,
            is_active=user.is_active,
            failed_logins=user.failed_logins,
            last_login_at=user.last_login_at,
            locked_until=user.locked_until,
            risk_score=0
        )


class UserSuspend(BaseModel):
    user_id: str


class UserUpdate(BaseModel):
    department: Optional[str] = None


class AdminUserUpdate(BaseModel):
    role: Optional[UserRole] = None
    department: Optional[str] = None
