from fastapi import APIRouter, Depends, Request,status  
from sqlalchemy.orm import Session
from database import get_db
from models import User
from schemas import UserCreate, UserLogin, PasswordChange, TokenResponse, UserResponse, DirectoryUserResponse
from dependencies import get_current_user, require_role
from services import auth_service, user_service
import crud

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(
    body: UserCreate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_role(["IT_ADMIN"])),
):
    """Create a new user account. IT_ADMIN only."""
    user = user_service.register_user(db, body)
    return UserResponse.build(user)

@router.post("/login", response_model=TokenResponse)
def login(
    body: UserLogin,
    request: Request,
    db: Session = Depends(get_db),
):
    """Authenticate user and return JWT access + refresh tokens."""
    access_token, refresh_token = auth_service.authenticate_user(db, body, request.client.host)
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)

@router.post("/refresh", response_model=TokenResponse)
def refresh(
    refresh_token: str,
    db: Session = Depends(get_db),
):
    """Issue a new access token from a valid refresh token."""
    new_access = auth_service.handle_refresh(db, refresh_token)
    return TokenResponse(access_token=new_access, refresh_token=refresh_token)

@router.post("/logout")
def logout(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Revoke all refresh tokens for the current user."""
    auth_service.handle_logout(db, str(current_user.id))
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
