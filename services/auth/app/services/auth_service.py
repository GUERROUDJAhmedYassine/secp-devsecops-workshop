from datetime import datetime, timedelta
from fastapi import HTTPException
from sqlalchemy.orm import Session
import crud
from security import verify_password, create_access_token, create_refresh_token
from schemas import UserLogin
from siem import siem_emit

def authenticate_user(db: Session, body: UserLogin, source_ip: str):
    user = crud.get_user_by_username(db, body.username)
    if not user:
        siem_emit(db, "LOGIN_FAILURE", "MEDIUM", source_ip=source_ip,
                  payload={"username": body.username, "reason": "user_not_found"})
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if user.locked_until and user.locked_until > datetime.utcnow():
        raise HTTPException(status_code=423, detail="Account locked. Try again later.")

    if not verify_password(body.password, user.password_hash):
        user.failed_logins += 1
        if user.failed_logins >= 5:
            user.locked_until = datetime.utcnow() + timedelta(minutes=15)
            db.commit()
            siem_emit(db, "ACCOUNT_LOCKED", "HIGH", user_id=str(user.id),
                      source_ip=source_ip,
                      payload={"failed_attempts": user.failed_logins})
            raise HTTPException(status_code=423, detail="Account locked — too many failed attempts")

        db.commit()
        siem_emit(db, "LOGIN_FAILURE", "MEDIUM", user_id=str(user.id),
                  source_ip=source_ip, payload={"attempt": user.failed_logins})
        raise HTTPException(status_code=401, detail="Invalid credentials")

    user.failed_logins = 0
    user.locked_until = None
    user.last_login_at = datetime.utcnow()

    access_token = create_access_token(str(user.id), user.role.value)
    refresh_token_value, expiry = create_refresh_token()

    crud.create_refresh_token(db, user.id, refresh_token_value, expiry)

    siem_emit(db, "LOGIN_SUCCESS", "INFO", user_id=str(user.id), source_ip=source_ip)

    return access_token, refresh_token_value

def handle_refresh(db: Session, refresh_token: str):
    record = crud.get_valid_refresh_token(db, refresh_token)
    if not record:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    user = crud.get_active_user_by_id(db, str(record.user_id))
    if not user:
        raise HTTPException(status_code=401, detail="User not found or suspended")

    new_access = create_access_token(str(user.id), user.role.value)
    siem_emit(db, "TOKEN_REFRESH", "INFO", user_id=str(user.id))

    return new_access

def handle_logout(db: Session, user_id: str):
    crud.revoke_all_refresh_tokens_for_user(db, user_id)
    siem_emit(db, "LOGOUT", "INFO", user_id=user_id)
