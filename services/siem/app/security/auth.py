"""
SIEM Service — JWT Authentication
Same pattern as auth/mail: verifies tokens issued by auth service.
Only IT_ADMIN can access SIEM endpoints.
"""
import jwt
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from core.config import JWT_SECRET, JWT_ALGORITHM

ACCESS_COOKIE = "secp_access_token"
security = HTTPBearer(auto_error=False)


def decode_token(token: str) -> dict:
    """Decode and validate a JWT access token."""
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


def get_current_admin(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> dict:
    """
    Validates JWT and enforces IT_ADMIN role.
    Returns the decoded JWT payload.
    """
    token = credentials.credentials if credentials else request.cookies.get(ACCESS_COOKIE)
    if not token:
        raise HTTPException(status_code=401, detail="Missing access token")

    payload = decode_token(token)

    raw_sub = payload.get("sub")
    if not raw_sub:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    role = payload.get("role", "")
    if role != "IT_ADMIN":
        raise HTTPException(status_code=403, detail="SIEM access requires IT_ADMIN role")

    return payload


def verify_ws_token(token: str) -> dict | None:
    """
    Validate a JWT for WebSocket connections.
    Returns payload dict or None.
    """
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("role") != "IT_ADMIN":
            return None
        return payload
    except Exception:
        return None
