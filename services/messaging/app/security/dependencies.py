from fastapi import Request
from typing import Optional
from security.jwt_handler import verify_token
from fastapi.security import OAuth2PasswordBearer
from fastapi import Depends
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="http://localhost:8001/auth/login")

async def get_token_payload(request: Request) -> Optional[dict]:
    """Extracts and validates the JWT from the Authorization header."""
    try:
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return None
        
        token = auth_header.split(" ")[1]
        return verify_token(token)
    except Exception:
        return None

# Explanation: Extracts Bearer token from the request header and validates it securely.
# Security note: Gracefully handles malformed headers and splits to prevent unexpected application crashes.


async def get_current_user(
    token: str = Depends(oauth2_scheme)
) -> dict | None:
    """Extract and validate current user from JWT token."""
    pass
