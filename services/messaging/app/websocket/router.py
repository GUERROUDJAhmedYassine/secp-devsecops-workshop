from fastapi import APIRouter, WebSocket
from typing import Optional
from security.dependencies import get_token_payload

router = APIRouter()

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: Optional[str] = None) -> None:
    """Main WebSocket entry point."""
    pass
