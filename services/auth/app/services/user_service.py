from fastapi import HTTPException
from sqlalchemy.orm import Session
import crud
from security import hash_password, verify_password
from schemas import UserCreate, PasswordChange, AdminUserUpdate
from siem import siem_emit

def register_user(db: Session, body: UserCreate):
    if crud.get_user_by_username(db, body.username):
        raise HTTPException(status_code=400, detail="Username already taken")

    generated_email = f"{body.username}@secp.com"

    if crud.get_user_by_email(db, generated_email):
        raise HTTPException(status_code=400, detail="Email already registered")

    user = crud.create_user(
        db,
        username=body.username,
        email=generated_email,
        password_hash=hash_password(body.password),
        role=body.role,
        department=body.department,
    )
    return user

def change_user_password(db: Session, current_user, body: PasswordChange, source_ip: str):
    if not verify_password(body.old_password, current_user.password_hash):
        raise HTTPException(status_code=401, detail="Old password is incorrect")

    current_user.password_hash = hash_password(body.new_password)
    db.commit()

    siem_emit(db, "PASSWORD_CHANGE", "MEDIUM",
              user_id=str(current_user.id), source_ip=source_ip)

def unlock_user_account(db: Session, user_id: str, admin_id: str):
    user = crud.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    user.failed_logins = 0
    user.locked_until = None
    db.commit()
    
    siem_emit(db, "ACCOUNT_UNLOCKED", "INFO", user_id=user_id,
              payload={"by_admin": admin_id})
    return user

def unsuspend_user_account(db: Session, user_id: str, admin_id: str):
    user = crud.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    user.is_active = True
    db.commit()
    
    siem_emit(db, "ACCOUNT_UNSUSPENDED", "INFO", user_id=user_id,
              payload={"by_admin": admin_id})
    return user

def update_user_profile(db: Session, user_id: str, body: AdminUserUpdate, admin_id: str):
    user = crud.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if body.role is not None:
        user.role = body.role
    if body.department is not None:
        user.department = body.department

    db.commit()
    db.refresh(user)

    siem_emit(db, "ACCOUNT_MODIFIED", "INFO", user_id=user_id,
              payload={"by_admin": admin_id, "new_role": body.role.value if body.role else None})
    return user

def suspend_user_account(db: Session, user_id: str, admin_id: str):
    user = crud.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_active = False
    crud.revoke_all_refresh_tokens_for_user(db, user_id)
    db.commit()

    siem_emit(db, "ACCOUNT_SUSPENDED", "HIGH", user_id=user_id,
              payload={"by_admin": admin_id})
    return user

def delete_user_account(db: Session, user_id: str, admin_id: str):
    user = crud.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_active = False
    user.username  = f"deleted_{user.username}"
    user.email     = f"deleted_{user.email}"
    db.commit()

    siem_emit(db, "ACCOUNT_DELETED", "HIGH", user_id=user_id,
              payload={"by_admin": admin_id})
