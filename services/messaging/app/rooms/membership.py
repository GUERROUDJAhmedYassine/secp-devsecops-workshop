from typing import List
from core.database import get_pool

async def is_member(room_id: str, user_id: str) -> bool:
    """Check if user belongs to room."""
    pass

async def get_user_rooms(user_id: str) -> List[str]:
    """Get all rooms for a user."""
    pass
