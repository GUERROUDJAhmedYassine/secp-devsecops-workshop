from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import User
from schemas import UserResponse, AdminUserUpdate
from dependencies import require_role
from services import user_service
import crud

router = APIRouter(prefix="/admin", tags=["admin"])

@router.get("/users", response_model=list[UserResponse])
def list_users(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_role(["IT_ADMIN"])),
):
    """List all user accounts. IT_ADMIN only."""
    return [UserResponse.build(u) for u in crud.get_all_users(db)]

@router.get("/users/{user_id}", response_model=UserResponse)
def get_user(
    user_id: str,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_role(["IT_ADMIN"])),
):
    """Get user profile by ID. IT_ADMIN only."""
    user = crud.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserResponse.build(user)

@router.put("/users/{user_id}", response_model=UserResponse)
def update_user(
    user_id: str,
    body: AdminUserUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_role(["IT_ADMIN"])),
):
    """Update a user's role or department. IT_ADMIN only."""
    user = user_service.update_user_profile(db, user_id, body, str(current_admin.id))
    return UserResponse.build(user)

@router.put("/users/{user_id}/unlock")
def unlock_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_role(["IT_ADMIN"])),
):
    """Unlock a locked user account manually. IT_ADMIN only."""
    user = user_service.unlock_user_account(db, user_id, str(current_admin.id))
    return {"message": f"User {user.username} unlocked successfully"}

@router.put("/users/{user_id}/unsuspend")
def unsuspend_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_role(["IT_ADMIN"])),
):
    """Unsuspend a suspended user account. IT_ADMIN only."""
    user = user_service.unsuspend_user_account(db, user_id, str(current_admin.id))
    return {"message": f"User {user.username} unsuspended successfully"}

@router.put("/users/{user_id}/suspend")
def suspend_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_role(["IT_ADMIN"])),
):
    """Suspend a user account and revoke all their tokens. IT_ADMIN only."""
    user = user_service.suspend_user_account(db, user_id, str(current_admin.id))
    return {"message": f"User {user.username} suspended"}

@router.delete("/users/{user_id}")
def delete_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_role(["IT_ADMIN"])),
):
    """Soft-delete a user account. IT_ADMIN only."""
    user_service.delete_user_account(db, user_id, str(current_admin.id))
    return {"message": "User deleted"}

@router.delete("/maintenance/tokens")
def cleanup_tokens(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_role(["IT_ADMIN"])),
):
    """Clean up expired and revoked refresh tokens to prevent bloat. IT_ADMIN only."""
    deleted_count = crud.delete_expired_and_revoked_tokens(db)
    return {"message": f"Successfully deleted {deleted_count} expired/revoked tokens"}
