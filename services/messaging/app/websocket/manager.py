import asyncio
import logging
from fastapi import WebSocket
from starlette.websockets import WebSocketState

logger = logging.getLogger(__name__)

# Each user can have multiple active connections (tabs/devices)
active_connections: dict[str, list[WebSocket]] = {}
_lock = asyncio.Lock()


async def connect(user_id: str, websocket: WebSocket) -> None:
    """Add a new connection for a user — allows multiple sessions."""
    async with _lock:
        await websocket.accept()
        if user_id not in active_connections:
            active_connections[user_id] = []
        active_connections[user_id].append(websocket)
        sessions = len(active_connections[user_id])
        logger.info(f"User {user_id} connected. Sessions: {sessions}")


async def disconnect(user_id: str, websocket: WebSocket) -> None:
    """Remove one specific connection for a user."""
    async with _lock:
        if user_id not in active_connections:
            return
        active_connections[user_id] = [
            ws for ws in active_connections[user_id] if ws != websocket
        ]
        if not active_connections[user_id]:
            del active_connections[user_id]
            logger.info(f"User {user_id} fully offline.")


async def send_to_user(user_id: str, message: dict) -> bool:
    """Send message to ALL sessions of a user — all tabs receive it."""
    sessions = active_connections.get(user_id, [])
    if not sessions:
        return False
    dead = []
    delivered = False
    for websocket in sessions:
        if websocket.client_state != WebSocketState.CONNECTED:
            dead.append(websocket)
            continue
        try:
            await websocket.send_json(message)
            delivered = True
        except Exception as e:
            logger.warning(f"Failed to send to {user_id}: {e}")
            dead.append(websocket)
    for ws in dead:
        await disconnect(user_id, ws)
    return delivered


async def broadcast(message: dict, exclude_user_id: str | None = None) -> None:
    """Send message to all connected users except one."""
    for user_id in list(active_connections.keys()):
        if user_id == exclude_user_id:
            continue
        await send_to_user(user_id, message)


async def get_online_users() -> list[str]:
    """Return list of currently connected user IDs."""
    return list(active_connections.keys())


async def is_online(user_id: str) -> bool:
    """Check if a user has at least one active connection."""
    return user_id in active_connections and len(active_connections[user_id]) > 0