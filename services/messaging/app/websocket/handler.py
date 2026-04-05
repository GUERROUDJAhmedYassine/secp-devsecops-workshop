from fastapi import WebSocket
from messages.schemas import MessageIn
from siem.emitter import emit

async def handle_message(websocket: WebSocket, user_id: str, data: MessageIn) -> None:
    """Receive and route dm or room message."""
    pass
