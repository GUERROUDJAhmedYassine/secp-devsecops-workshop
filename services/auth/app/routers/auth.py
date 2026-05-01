import os

from fastapi import APIRouter, Body, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session
from database import get_db
from models import User
from schemas import UserCreate, UserLogin, PasswordChange, TokenResponse, UserResponse, DirectoryUserResponse
from dependencies import get_current_user, require_role
from services import auth_service, user_service
from config import ACCESS_TOKEN_EXPIRE_MINUTES, REFRESH_TOKEN_EXPIRE_DAYS
import crud
import psutil
import socket
import platform
import time

router = APIRouter(prefix="/auth", tags=["auth"])

ACCESS_COOKIE = "secp_access_token"
REFRESH_COOKIE = "secp_refresh_token"
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").lower() == "true"
COOKIE_SAMESITE = os.getenv("COOKIE_SAMESITE", "strict").lower()


def set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    response.set_cookie(
        key=ACCESS_COOKIE,
        value=access_token,
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        path="/",
    )
    response.set_cookie(
        key=REFRESH_COOKIE,
        value=refresh_token,
        max_age=REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        path="/",
    )


def clear_auth_cookies(response: Response) -> None:
    response.delete_cookie(ACCESS_COOKIE, path="/")
    response.delete_cookie(REFRESH_COOKIE, path="/")

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(
    body: UserCreate,
    request: Request,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_role(["IT_ADMIN"])),
):
    """Create a new user account. IT_ADMIN only."""
    # Extract token for files-service upload
    auth_header = request.headers.get("Authorization")
    token = auth_header.split(" ")[1] if auth_header and " " in auth_header else None
    token = token or request.cookies.get(ACCESS_COOKIE)
    
    user = user_service.register_user(db, body, admin_token=token)
    return UserResponse.build(user)

@router.post("/login", response_model=TokenResponse)
def login(
    body: UserLogin,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    """Authenticate user and return JWT access + refresh tokens."""
    access_token, refresh_token = auth_service.authenticate_user(db, body, request.client.host)
    set_auth_cookies(response, access_token, refresh_token)
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)

@router.post("/refresh", response_model=TokenResponse)
def refresh(
    request: Request,
    response: Response,
    refresh_token: str | None = Body(default=None, embed=True),
    db: Session = Depends(get_db),
):
    """Issue a new access token from a valid refresh token."""
    refresh_token = refresh_token or request.cookies.get(REFRESH_COOKIE)
    if not refresh_token:
        raise HTTPException(status_code=401, detail="Missing refresh token")

    new_access = auth_service.handle_refresh(db, refresh_token)
    set_auth_cookies(response, new_access, refresh_token)
    return TokenResponse(access_token=new_access, refresh_token=refresh_token)

@router.post("/logout")
def logout(
    response: Response,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Revoke all refresh tokens for the current user."""
    auth_service.handle_logout(db, str(current_user.id))
    clear_auth_cookies(response)
    return {"message": "Logged out successfully"}

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """Return the current user's profile."""
    return UserResponse.build(current_user)


@router.get("/users", response_model=list[DirectoryUserResponse])
def list_public_users(
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    """Shared user directory for authenticated users."""
    return [DirectoryUserResponse.build(u) for u in crud.get_all_users(db) if u.is_active]

@router.put("/password")
def change_password(
    body: PasswordChange,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Change the current user's password."""
    user_service.change_user_password(db, current_user, body, request.client.host)
    return {"message": "Password updated successfully"}


@router.get("/system-health")
def get_system_health():
    """Return hardware and OS health metrics."""
    # CPU Usage (non-blocking for fast response, or use a small interval)
    # interval=None returns percentage since last call
    cpu_usage = psutil.cpu_percent(interval=0.1)
    cpu_cores = psutil.cpu_count(logical=True)
    server_host = socket.gethostname()
    os_platform = f"{platform.system()} {platform.release()}"
    
    # Uptime
    boot_time = psutil.boot_time()
    uptime_seconds = time.time() - boot_time
    
    days = int(uptime_seconds // (24 * 3600))
    hours = int((uptime_seconds % (24 * 3600)) // 3600)
    minutes = int((uptime_seconds % 3600) // 60)
    
    if days > 0:
        uptime_str = f"{days}d {hours}h {minutes}m"
    elif hours > 0:
        uptime_str = f"{hours}h {minutes}m"
    else:
        uptime_str = f"{minutes}m"

    return {
        "cpu_usage_percent": cpu_usage,
        "cpu_cores": cpu_cores,
        "hostname": server_host,
        "platform": platform.system(),
        "platform_release": platform.release(),
        "uptime_seconds": uptime_seconds
    }
