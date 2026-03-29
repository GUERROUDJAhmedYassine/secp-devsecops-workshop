import os
from database import SessionLocal
from models import User, UserRole
from security import hash_password

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
            print("Superuser created successfully.")
        else:
            print(f"Superuser '{username}' already exists.")
    except Exception as e:
        print(f"Error creating superuser: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    create_superuser()
