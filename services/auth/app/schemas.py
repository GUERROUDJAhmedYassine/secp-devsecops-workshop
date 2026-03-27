from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional
from models import UserRole


def _validate_password_72_bytes(value: str) -> str:
    if len(value.encode("utf-8")) > 72:
        raise ValueError("Password is too long (bcrypt supports max 72 bytes)")
    return value


class UserCreate(BaseModel):
    username:   str
    email:      EmailStr
    password:   str = Field(min_length=8)
    role:       UserRole
    department: Optional[str] = None

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        return _validate_password_72_bytes(v)


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
        return _validate_password_72_bytes(v)


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

    class Config:
        from_attributes = True


class UserSuspend(BaseModel):
    user_id: str
