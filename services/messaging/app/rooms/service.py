from typing import List, Dict
from core.database import get_pool
from siem.emitter import emit

async def create_room_service(name: str, department: str, created_by: str) -> None:
    """Room creation logic."""
    pass

async def get_all_rooms() -> List[Dict]:
    """Fetch all rooms."""
    pass

async def add_member(room_id: str, user_id: str) -> None:
    """Add user to room."""
    pass
