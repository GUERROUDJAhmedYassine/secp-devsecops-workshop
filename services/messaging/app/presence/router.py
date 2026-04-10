import logging
from fastapi import APIRouter, Depends

from security.dependencies import get_current_user
from websocket.manager import get_online_users

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/presence", tags=["presence"])


@router.get("/online")
async def online_users(_current_user: dict = Depends(get_current_user)):
    """Return a list of currently online user IDs."""
    users = await get_online_users()
    return {"online_user_ids": users}

