from datetime import datetime
from sqlalchemy.orm import Session
from models import User, RefreshToken, UserRole

def get_user_by_username(db: Session, username: str):
    return db.query(User).filter(User.username == username).first()

def get_user_by_email(db: Session, email: str):
    return db.query(User).filter(User.email == email).first()

def get_user_by_id(db: Session, user_id: str):
    return db.query(User).filter(User.id == user_id).first()

def create_user(db: Session, username: str, email: str, password_hash: str, role: UserRole, department: str = None):
    user = User(
        username=username,
        email=email,
        password_hash=password_hash,
        role=role,
        department=department,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

def get_all_users(db: Session):
    return db.query(User).all()

def get_active_user_by_id(db: Session, user_id: str):
    return db.query(User).filter(User.id == user_id, User.is_active == True).first()
    
def get_active_user_by_id(db: Session, user_id: str):
    return db.query(User).filter(User.id == user_id, User.is_active == True).first()

def create_refresh_token(db: Session, user_id, token: str, expires_at: datetime):
    record = RefreshToken(
        user_id=user_id,
        token=token,
        expires_at=expires_at,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record

def get_valid_refresh_token(db: Session, token: str):
    return db.query(RefreshToken).filter(
        RefreshToken.token == token,
        RefreshToken.is_revoked == False,
        RefreshToken.expires_at > datetime.utcnow(),
    ).first()

def revoke_all_refresh_tokens_for_user(db: Session, user_id):
    db.query(RefreshToken).filter(
        RefreshToken.user_id == user_id,
        RefreshToken.is_revoked == False,
    ).update({"is_revoked": True})
    db.commit()

def delete_expired_and_revoked_tokens(db: Session):
    deleted_count = db.query(RefreshToken).filter(
        (RefreshToken.expires_at < datetime.utcnow()) | (RefreshToken.is_revoked == True)
    ).delete()
    db.commit()
    return deleted_count
