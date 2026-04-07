# rooms/membership.py
import logging
from fastapi import Depends, HTTPException, status
from core.database import get_pool
from security.dependencies import get_current_user

logger = logging.getLogger(__name__)


async def is_room_member(room_id: str, user_id: str) -> bool:
    """Check if a user is a member of the specified room."""
    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT 1 FROM app.room_members WHERE room_id = $1::uuid AND user_id = $2::uuid",
            room_id, user_id
        )
    logger.debug("Membership check room=%s user=%s result=%s", room_id, user_id, row is not None)
    return row is not None


async def require_room_member(room_id: str, current_user: dict = Depends(get_current_user)):
    """FastAPI dependency that raises 403 if the authenticated user is not a member of the room."""
    if not await is_room_member(room_id, current_user["id"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not a member of this room"
        )
    return current_user
