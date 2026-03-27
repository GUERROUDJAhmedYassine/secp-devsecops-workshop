"""
SECP — Authentication Service
Port: 8001
"""

from datetime import datetime
from fastapi import FastAPI, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from database import get_db
from models import User, RefreshToken
from schemas import UserCreate, UserLogin, PasswordChange, TokenResponse, UserResponse
from auth import verify_password, hash_password, create_access_token, create_refresh_token
from dependencies import get_current_user, require_role
from siem import siem_emit

app = FastAPI(title="SECP Auth Service", version="1.0.0")


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "healthy", "service": "auth"}


# ── Register ──────────────────────────────────────────────────────────────────

@app.post("/auth/register", response_model=UserResponse)
def register(
    body: UserCreate,
    request: Request,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_role(["IT_ADMIN"])),
):
    """Create a new user account. IT_ADMIN only."""

    if db.query(User).filter(User.username == body.username).first():
        raise HTTPException(status_code=400, detail="Username already taken")

    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        username      = body.username,
        email         = body.email,
        password_hash = hash_password(body.password),
        role          = body.role,
        department    = body.department,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return UserResponse(
        id         = str(user.id),
        username   = user.username,
        email      = user.email,
        role       = user.role.value,
        department = user.department,
        is_active  = user.is_active,
    )


# ── Login ─────────────────────────────────────────────────────────────────────

@app.post("/auth/login", response_model=TokenResponse)
def login(
    body: UserLogin,
    request: Request,
    db: Session = Depends(get_db),
):
    """Authenticate user and return JWT access + refresh tokens."""

    source_ip = request.client.host

    # 1 — does the account exist?
    user = db.query(User).filter(User.username == body.username).first()
    if not user:
        siem_emit(db, "LOGIN_FAILURE", "MEDIUM", source_ip=source_ip,
                  payload={"username": body.username, "reason": "user_not_found"})
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # 2 — is the account locked?
    if user.locked_until and user.locked_until > datetime.utcnow():
        raise HTTPException(status_code=423, detail="Account locked. Try again later.")

    # 3 — is the password correct?
    if not verify_password(body.password, user.password_hash):
        user.failed_logins += 1

        if user.failed_logins >= 5:
            from datetime import timedelta
            user.locked_until = datetime.utcnow() + timedelta(minutes=15)
            db.commit()
            siem_emit(db, "ACCOUNT_LOCKED", "HIGH", user_id=str(user.id),
                      source_ip=source_ip,
                      payload={"failed_attempts": user.failed_logins})
            raise HTTPException(status_code=423, detail="Account locked — too many failed attempts")

        db.commit()
        siem_emit(db, "LOGIN_FAILURE", "MEDIUM", user_id=str(user.id),
                  source_ip=source_ip,
                  payload={"attempt": user.failed_logins})
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # 4 — success
    user.failed_logins = 0
    user.locked_until  = None
    user.last_login_at = datetime.utcnow()

    access_token               = create_access_token(str(user.id), user.role.value)
    refresh_token_value, expiry = create_refresh_token()

    db.add(RefreshToken(
        user_id    = user.id,
        token      = refresh_token_value,
        expires_at = expiry,
    ))
    db.commit()

    siem_emit(db, "LOGIN_SUCCESS", "INFO", user_id=str(user.id), source_ip=source_ip)

    return TokenResponse(
        access_token  = access_token,
        refresh_token = refresh_token_value,
    )


# ── Refresh ───────────────────────────────────────────────────────────────────

@app.post("/auth/refresh", response_model=TokenResponse)
def refresh(
    refresh_token: str,
    db: Session = Depends(get_db),
):
    """Issue a new access token from a valid refresh token."""

    record = db.query(RefreshToken).filter(
        RefreshToken.token      == refresh_token,
        RefreshToken.is_revoked == False,
        RefreshToken.expires_at >  datetime.utcnow(),
    ).first()

    if not record:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    user = db.query(User).filter(User.id == record.user_id, User.is_active == True).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found or suspended")

    new_access = create_access_token(str(user.id), user.role.value)

    siem_emit(db, "TOKEN_REFRESH", "INFO", user_id=str(user.id))

    return TokenResponse(access_token=new_access, refresh_token=refresh_token)


# ── Logout ────────────────────────────────────────────────────────────────────

@app.post("/auth/logout")
def logout(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Revoke all refresh tokens for the current user."""

    db.query(RefreshToken).filter(
        RefreshToken.user_id    == current_user.id,
        RefreshToken.is_revoked == False,
    ).update({"is_revoked": True})
    db.commit()

    siem_emit(db, "LOGOUT", "INFO", user_id=str(current_user.id))

    return {"message": "Logged out successfully"}


# ── Me ────────────────────────────────────────────────────────────────────────

@app.get("/auth/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """Return the current user's profile."""
    return UserResponse(
        id         = str(current_user.id),
        username   = current_user.username,
        email      = current_user.email,
        role       = current_user.role.value,
        department = current_user.department,
        is_active  = current_user.is_active,
    )


# ── Change password ───────────────────────────────────────────────────────────

@app.put("/auth/password")
def change_password(
    body: PasswordChange,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Change the current user's password."""

    if not verify_password(body.old_password, current_user.password_hash):
        raise HTTPException(status_code=401, detail="Old password is incorrect")

    current_user.password_hash = hash_password(body.new_password)
    db.commit()

    siem_emit(db, "PASSWORD_CHANGE", "MEDIUM",
              user_id=str(current_user.id), source_ip=request.client.host)

    return {"message": "Password updated successfully"}


# ── Admin: list users ─────────────────────────────────────────────────────────

@app.get("/admin/users", response_model=list[UserResponse])
def list_users(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_role(["IT_ADMIN"])),
):
    """List all user accounts. IT_ADMIN only."""
    return [
        UserResponse(
            id         = str(u.id),
            username   = u.username,
            email      = u.email,
            role       = u.role.value,
            department = u.department,
            is_active  = u.is_active,
        )
        for u in db.query(User).all()
    ]


# ── Admin: suspend user ───────────────────────────────────────────────────────

@app.put("/admin/users/{user_id}/suspend")
def suspend_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_role(["IT_ADMIN"])),
):
    """Suspend a user account and revoke all their tokens. IT_ADMIN only."""

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_active = False
    db.query(RefreshToken).filter(
        RefreshToken.user_id    == user_id,
        RefreshToken.is_revoked == False,
    ).update({"is_revoked": True})
    db.commit()

    siem_emit(db, "ACCOUNT_SUSPENDED", "HIGH", user_id=user_id,
              payload={"by_admin": str(current_admin.id)})

    return {"message": f"User {user.username} suspended"}


# ── Admin: delete user ────────────────────────────────────────────────────────

@app.delete("/admin/users/{user_id}")
def delete_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_role(["IT_ADMIN"])),
):
    """Soft-delete a user account. IT_ADMIN only."""

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_active = False
    user.username  = f"deleted_{user.username}"
    user.email     = f"deleted_{user.email}"
    db.commit()

    siem_emit(db, "ACCOUNT_DELETED", "HIGH", user_id=user_id,
              payload={"by_admin": str(current_admin.id)})

    return {"message": "User deleted"}


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
