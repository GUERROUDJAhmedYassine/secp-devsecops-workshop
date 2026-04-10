import jwt
import logging
from typing import Optional, Dict, Any
from core.config import settings

logger = logging.getLogger(__name__)

def verify_token(token: str) -> Optional[Dict[str, Any]]:
    """Validates an incoming JWT and returns the payload if valid."""
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
            options={"require": ["sub", "role", "exp"]}
        )
        return payload
    except jwt.ExpiredSignatureError:
        logger.warning("Token expired")
    except jwt.InvalidTokenError:
        logger.warning("Invalid token signature or tampered token")
    except Exception as e:
        logger.error(f"Unexpected token validation error: {e}")
    return None

# Explanation: Decodes and strictly validates Jason Web Tokens without creating them.
# Security note: Prevents authentication bypass by rejecting missing claims, expired tokens, or invalid signatures.
