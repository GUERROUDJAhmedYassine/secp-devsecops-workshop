import base64
import os
from fastapi import HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
import crud
from security import hash_password, verify_password
from schemas import UserCreate, PasswordChange, AdminUserUpdate
from siem import siem_emit
from cryptography.hazmat.primitives.asymmetric import x25519
from cryptography.hazmat.primitives import serialization
from config import WG_SERVER_PUBLIC_KEY, WG_SERVER_ENDPOINT, WG_INTERNAL_SUBNET, WG_CONFIG_PATH

def _generate_wg_keys():
    """Programmatically generate a WireGuard key pair."""
    private_key = x25519.X25519PrivateKey.generate()
    public_key = private_key.public_key()
    
    priv_b64 = base64.b64encode(private_key.private_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PrivateFormat.Raw,
        encryption_algorithm=serialization.NoEncryption()
    )).decode()
    
    pub_b64 = base64.b64encode(public_key.public_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PublicFormat.Raw
    )).decode()
    
    return priv_b64, pub_b64

def provision_vpn(db: Session, username: str):
    """Assigns next IP, generates keys, and writes to server config."""
    # 1. Determine next available IP
    last_user = db.execute(text("SELECT vpn_internal_ip FROM app.users WHERE vpn_internal_ip IS NOT NULL ORDER BY vpn_internal_ip DESC LIMIT 1")).fetchone()
    
    if not last_user or not last_user[0]:
        next_ip = "10.8.0.2"
    else:
        ip_parts = str(last_user[0]).split('.')
        next_ip = f"{ip_parts[0]}.{ip_parts[1]}.{ip_parts[2]}.{int(ip_parts[3]) + 1}"

    # 2. Generate Keys
    priv_b64, pub_b64 = _generate_wg_keys()

    # 3. Append to shared WireGuard config
    peer_block = f"\n# User: {username}\n[Peer]\nPublicKey = {pub_b64}\nAllowedIPs = {next_ip}/32\n"
    try:
        os.makedirs(os.path.dirname(WG_CONFIG_PATH), exist_ok=True)
        with open(WG_CONFIG_PATH, "a") as f:
            f.write(peer_block)
    except Exception as e:
        print(f"Warning: Could not write to WireGuard config: {e}")

    # 4. Build the client .conf string
    client_conf = f"""[Interface]
PrivateKey = {priv_b64}
Address = {next_ip}/24
DNS = 1.1.1.1

[Peer]
PublicKey = {WG_SERVER_PUBLIC_KEY}
Endpoint = {WG_SERVER_ENDPOINT}
AllowedIPs = 0.0.0.0/0
PersistentKeepalive = 25
"""
    return pub_b64, next_ip, client_conf

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

    # Provision VPN
    try:
        pub_key, internal_ip, vpn_config = provision_vpn(db, user.username)
        user.vpn_public_key = pub_key
        user.vpn_internal_ip = internal_ip
        user.vpn_config = vpn_config # Attach for response
        db.commit()
    except Exception as e:
        print(f"Error provisioning VPN for {user.username}: {e}")

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

