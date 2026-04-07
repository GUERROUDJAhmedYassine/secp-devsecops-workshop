# rooms/router.py
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from security.dependencies import get_current_user
from rooms.membership import require_room_member
from rooms import service as room_service
from messages import room_repository

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/rooms", tags=["rooms"])


# ── Request bodies ────────────────────────────────────────────────────────────

class CreateRoomRequest(BaseModel):
    name: str
    department: str


class JoinRoomRequest(BaseModel):
    user_id: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_room(body: CreateRoomRequest, current_user: dict = Depends(get_current_user)):
    """Create a new room. Restricted to IT_ADMIN role."""
    if current_user["role"] != "IT_ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only IT_ADMIN can create rooms"
        )

    result = await room_service.create_room(
        name=body.name,
        department=body.department,
        created_by=str(current_user["id"])
    )
    return result


@router.get("/")
async def list_rooms(current_user: dict = Depends(get_current_user)):
    """List all rooms. Available to any authenticated user."""
    return await room_service.list_rooms()


@router.post("/{room_id}/join")
async def join_room(room_id: str, body: JoinRoomRequest, current_user: dict = Depends(get_current_user)):
    """Add a user to a room. Restricted to IT_ADMIN role."""
    if current_user["role"] != "IT_ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only IT_ADMIN can add users to rooms"
        )
    return await room_service.join_room(room_id=room_id, user_id=body.user_id)


@router.get("/{room_id}/messages")
async def get_room_messages(
    room_id: str,
    current_user: dict = Depends(require_room_member),
    limit: int = 50
):
    """Fetch message history for a room. Restricted to room members only."""
    return await room_repository.get_room_history(room_id=room_id, limit=limit)
