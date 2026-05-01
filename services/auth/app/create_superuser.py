import os
from database import SessionLocal
from models import User, UserRole
from security import hash_password
from services.user_service import provision_vpn

def create_superuser():
    username = os.getenv("ADMIN_USERNAME", "admin")
    password = os.getenv("ADMIN_PASSWORD", "Admin@123!")

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.username == username).first()
        if not user:
            print(f"Creating default superuser: {username}")
            new_user = User(
                username=username,
                email=f"{username}@secp.com",
                password_hash=hash_password(password),
                role=UserRole.IT_ADMIN,
                department="IT Operations",
            )
            db.add(new_user)
            db.commit()
            db.refresh(new_user)

            # VPN Provisioning
            try:
                pub_key, priv_key, internal_ip, vpn_config = provision_vpn(db, new_user.username)
                new_user.vpn_public_key = pub_key
                new_user.vpn_private_key = priv_key
                new_user.vpn_internal_ip = internal_ip
                db.commit()

                print("VPN provisioning successful.")
                print("=" * 50)
                print("ADMIN VPN CONFIG (save this):")
                print("=" * 50)
                print(vpn_config)
                print("=" * 50)

            except Exception as vpn_err:
                print(f"Warning: VPN provisioning failed — {vpn_err}")
                print("Admin account created but without VPN profile.")

            print("Superuser created successfully.")
        else:
            print(f"Superuser '{username}' already exists.")
    except Exception as e:
        print(f"Error creating superuser: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    create_superuser()