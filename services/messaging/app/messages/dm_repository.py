from typing import List
from core.database import get_pool
from messages.schemas import MessageOut

async def save_dm(sender_id: str, recipient_id: str, content: str) -> None:
    """Save direct message to DB."""
    pass

async def get_dm_history(user1_id: str, user2_id: str) -> List[MessageOut]:
    """Fetch conversation history."""
    pass
