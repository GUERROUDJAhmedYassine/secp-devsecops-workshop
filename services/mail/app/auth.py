"""
Mail Service — Authentication
JWT validation and current user extraction.
JWT tokens are issued by the Auth Service and validated here
using the shared JWT_SECRET (same claims: sub, role, exp, iat).
"""
import uuid

import jwt
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from config import JWT_SECRET, JWT_ALGORITHM
from database import get_db
from models import User

ACCESS_COOKIE = "secp_access_token"
security = HTTPBearer(auto_error=False)


def decode_token(token: str) -> dict:
    """
    Decode and validate a JWT access token.
    Raises 401 if expired or invalid (aligned with Auth Service security.decode_access_token).
    """
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    """
    Same rules as Auth Service dependencies.get_current_user:
    - invalid / expired token → 401
    - unknown user id → 401
    - suspended account (is_active false) → 403 Account suspended
    """
    token = credentials.credentials if credentials else request.cookies.get(ACCESS_COOKIE)
    if not token:
        raise HTTPException(status_code=401, detail="Missing access token")

    payload = decode_token(token)
    raw_sub = payload.get("sub")
    if not raw_sub:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    try:
        user_id = uuid.UUID(str(raw_sub))
    except (ValueError, AttributeError):
        raise HTTPException(status_code=401, detail="Invalid token payload")

    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account suspended")

    return user
