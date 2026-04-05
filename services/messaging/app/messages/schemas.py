from pydantic import BaseModel, Field, UUID4
from typing import Literal, Optional
from datetime import datetime

class MessageIn(BaseModel):
    """Schema for incoming messages (new creations)."""
    type: Literal["dm", "room"]
    content: str = Field(..., max_length=2000)
    to: Optional[str] = None
    room_id: Optional[UUID4] = None

class MessageOut(BaseModel):
    """Schema for returned messages."""
    id: UUID4
    content: str
    type: str
    from_user: str
    to: Optional[str] = None
    room_id: Optional[UUID4] = None
    created_at: datetime
    is_deleted: bool = False

# Explanation: Validates incoming message data and shapes outward message formats.
# Security note: Strict Pydantic validation (e.g. max_length) prevents payload tampering and memory exhaustion attacks.
