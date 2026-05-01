import uuid
import os
import jwt
from fastapi import HTTPException, Request, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import env
from app.models import CurrentUser

bearer_scheme = HTTPBearer(auto_error=False)
ACCESS_COOKIE = "secp_access_token"


def get_bearer_token(request: Request) -> str:
    auth = request.headers.get("authorization") or request.headers.get("Authorization")
    if auth and auth.lower().startswith("bearer "):
        return auth.split(" ", 1)[1].strip()

    token = request.cookies.get(ACCESS_COOKIE)
    if token:
        return token

    raise HTTPException(status_code=401, detail="Missing access token")


def decode_token(token: str) -> dict:
    secret = env("JWT_SECRET")
    algorithm = os.getenv("JWT_ALGORITHM", "HS256")
    try:
        return jwt.decode(token, secret, algorithms=[algorithm], options={"verify_aud": False})
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(status_code=401, detail="Token expired") from exc
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=401, detail="Invalid token") from exc


async def get_current_user(
    request: Request,
    creds: HTTPAuthorizationCredentials | None = Security(bearer_scheme),
) -> CurrentUser:
    token = creds.credentials if creds and creds.scheme.lower() == "bearer" else get_bearer_token(request)
    return get_current_user_from_token(token)


def get_current_user_from_token(token: str) -> CurrentUser:
    claims = decode_token(token)
    user_id = claims.get("user_id") or claims.get("sub") or claims.get("id")
    role = claims.get("role")
    if not user_id or not role:
        raise HTTPException(status_code=401, detail="Token missing required claims")
    try:
        return CurrentUser(
            id=uuid.UUID(str(user_id)),
            role=role,
            department=claims.get("department"),
            username=claims.get("username"),
        )
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Invalid token claims") from exc
