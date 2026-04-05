from fastapi import APIRouter
from typing import List, Dict

router = APIRouter(prefix="/rooms", tags=["rooms"])

@router.post("/")
async def create_room() -> None:
    """HTTP POST to create a room."""
    pass

@router.get("/")
async def list_rooms() -> List[Dict]:
    """HTTP GET to list all rooms."""
    pass

@router.post("/{room_id}/join")
async def join_room(room_id: str) -> None:
    """HTTP POST to join a room."""
    pass
