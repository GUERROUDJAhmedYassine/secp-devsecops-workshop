import base64
import os
import subprocess
import httpx
from fastapi import HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
import crud
from security import hash_password, verify_password
from schemas import UserCreate, PasswordChange, AdminUserUpdate
from siem import siem_emit
from config import (
    WG_SERVER_PUBLIC_KEY, 
    WG_SERVER_ENDPOINT, 
    WG_INTERNAL_SUBNET, 
    WG_CONFIG_PATH,
    FILES_SERVICE_URL
)

def _generate_wg_keys():
    """Generate a WireGuard key pair using the wg CLI tool directly.
    
    Uses wg genkey + wg pubkey to guarantee the keys are 100% compatible
    with WireGuard's Curve25519 implementation (avoids potential byte-format
    mismatches with Python's cryptography library).
    """
    genkey = subprocess.run(
        ["wg", "genkey"],
        capture_output=True, text=True, check=True,
    )
    priv_b64 = genkey.stdout.strip()

    pubkey = subprocess.run(
        ["wg", "pubkey"],
        input=priv_b64,
        capture_output=True, text=True, check=True,
    )
    pub_b64 = pubkey.stdout.strip()

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
        sync_result = subprocess.run(
            "wg syncconf wg0 <(wg-quick strip wg0)",
            shell=True,
            executable="/bin/bash",
            capture_output=True,
            text=True,
        )
        if sync_result.returncode != 0:
            print(f"Warning: wg syncconf failed: {sync_result.stderr.strip()}")
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
AllowedIPs = 10.8.0.1/32
PersistentKeepalive = 25
"""
    return pub_b64, priv_b64, next_ip, client_conf

def upload_vpn_config_to_storage(token: str, username: str, config_str: str) -> str:
    """Uploads the generated .conf file to the files-service and returns the file_id."""
    try:
        with httpx.Client() as client:
            files = {
                'file': (f"vpn_{username}.conf", config_str, 'application/octet-stream')
            }
            headers = {'Authorization': f"Bearer {token}"}
            # We use bucket='admin' to keep these configs separated
            response = client.post(
                f"{FILES_SERVICE_URL}/files/upload?bucket=admin",
                files=files,
                headers=headers,
                timeout=10.0
            )
            response.raise_for_status()
            data = response.json()
            return str(data['id'])
    except Exception as e:
        print(f"Failed to upload VPN config to storage service: {e}")
        return None

def register_user(db: Session, body: UserCreate, admin_token: str = None):
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

    try:
        pub_key, priv_key, internal_ip, vpn_config = provision_vpn(db, user.username)
        user.vpn_public_key = pub_key
        user.vpn_private_key = priv_key
        user.vpn_internal_ip = internal_ip
        user.vpn_config = vpn_config # Attach for response
        
        # Step 2: Upload to storage if token provided
        if admin_token:
            file_id = upload_vpn_config_to_storage(admin_token, user.username, vpn_config)
            if file_id:
                user.vpn_config_file_id = file_id
        
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

