from typing import List
from core.database import get_pool
from messages.schemas import MessageOut

async def save_room_message(sender_id: str, room_id: str, content: str) -> None:
    """Save room message to DB."""
    pass

async def get_room_history(room_id: str) -> List[MessageOut]:
    """Fetch room message history."""
    pass
