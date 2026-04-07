import logging
from datetime import datetime, timezone
from fastapi import WebSocket
from messages.dm_repository import save_dm, get_dm_history
from siem.emitter import emit

logger = logging.getLogger(__name__)

# Rate limiting — max messages per user per minute
MAX_MESSAGES_PER_MINUTE = 30
_message_counts: dict[str, list[datetime]] = {}


async def handle_message(websocket: WebSocket, user_id: str, data: dict) -> None:
    """Receive message from user, apply rate limit, route to correct handler."""

    # Rate limit check
    if not _check_rate_limit(user_id):
        await websocket.send_json({
            "type": "error",
            "code": 429,
            "message": "Too many messages — slow down"
        })
        await emit(
            event_type="MASS_MESSAGE_BURST",
            severity="MEDIUM",
            service="messaging",
            user_id=user_id,
            source_ip=None,
            payload={"reason": "rate_limit_exceeded"}
        )
        logger.warning(f"Rate limit hit for user {user_id}")
        return

    message_type = data.get("type")
    handlers = {
        "dm": handle_dm,
        "room": handle_room,
        "history": handle_history,
        "ping": handle_ping,
    }

    handler = handlers.get(message_type)
    if not handler:
        await websocket.send_json({
            "type": "error",
            "code": 400,
            "message": f"Unknown message type: {message_type}"
        })
        return

    await handler(websocket, user_id, data)


def _check_rate_limit(user_id: str) -> bool:
    """Token bucket rate limiter — max 30 messages per 60 seconds per user."""
    now = datetime.now(timezone.utc)
    window = 60  # seconds

    if user_id not in _message_counts:
        _message_counts[user_id] = []

    # Remove timestamps outside the window
    _message_counts[user_id] = [
        t for t in _message_counts[user_id]
        if (now - t).total_seconds() < window
    ]

    if len(_message_counts[user_id]) >= MAX_MESSAGES_PER_MINUTE:
        return False

    _message_counts[user_id].append(now)
    return True


async def handle_ping(websocket: WebSocket, user_id: str, data: dict) -> None:
    """Respond to client heartbeat ping — keeps connection alive."""
    await websocket.send_json({
        "type": "pong",
        "timestamp": datetime.now(timezone.utc).isoformat()
    })


async def handle_dm(websocket: WebSocket, user_id: str, data: dict) -> None:
    """Handle direct message — validate, save, deliver, confirm, log."""

    recipient = data.get("to", "").strip()
    content = data.get("content", "").strip()

    # Validate
    if not recipient:
        await _send_error(websocket, "DM requires 'to' field", 400)
        return
    if not content:
        await _send_error(websocket, "DM requires 'content' field", 400)
        return
    if recipient == user_id:
        await _send_error(websocket, "Cannot send DM to yourself", 400)
        return
    if len(content) > 2000:
        await _send_error(websocket, "Message too long — maximum 2000 characters", 400)
        return

    # Save to database
    try:
        message_id = await save_dm(
            sender_id=user_id,
            recipient_id=recipient,
            content=content
        )
    except Exception as e:
        logger.error(f"Failed to save DM from {user_id} to {recipient}: {e}")
        await _send_error(websocket, "Failed to save message", 500)
        return

    # Deliver to recipient
    from websocket.manager import send_to_user, is_online
    delivered = await send_to_user(recipient, {
        "type": "dm",
        "from": user_id,
        "content": content,
        "message_id": str(message_id),
        "timestamp": datetime.now(timezone.utc).isoformat()
    })

    # If recipient is online but delivery failed — warn
    recipient_online = await is_online(recipient)
    if recipient_online and not delivered:
        logger.warning(f"Recipient {recipient} is online but delivery failed")

    # Confirm to sender
    await websocket.send_json({
        "type": "dm_sent",
        "message_id": str(message_id),
        "to": recipient,
        "delivered": delivered,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })

    # SIEM event
    await emit(
        event_type="MESSAGE_SENT",
        severity="INFO",
        service="messaging",
        user_id=user_id,
        source_ip=None,
        payload={
            "to": recipient,
            "delivered": delivered,
            "content_length": len(content),
            "message_id": str(message_id)
        }
    )

    logger.info(f"DM {message_id} from {user_id} to {recipient} — delivered: {delivered}")


async def handle_room(websocket: WebSocket, user_id: str, data: dict) -> None:
    """Handle room message — validate then delegate to rooms service."""

    room_id = data.get("room_id", "").strip()
    content = data.get("content", "").strip()

    if not room_id:
        await _send_error(websocket, "Room message requires 'room_id' field", 400)
        return
    if not content:
        await _send_error(websocket, "Room message requires 'content' field", 400)
        return
    if len(content) > 2000:
        await _send_error(websocket, "Message too long — maximum 2000 characters", 400)
        return

    try:
        from rooms.service import handle_room_message
        await handle_room_message(
            room_id=room_id,
            sender_id=user_id,
            content=content
        )
        await websocket.send_json({
            "type": "room_sent",
            "room_id": room_id,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
    except PermissionError:
        await _send_error(websocket, "You are not a member of this room", 403)
    except Exception as e:
        logger.error(f"Room message failed for {user_id} in {room_id}: {e}")
        await _send_error(websocket, "Failed to send room message", 500)


async def handle_history(websocket: WebSocket, user_id: str, data: dict) -> None:
    """Return paginated DM history between current user and another user."""

    with_user = data.get("with", "").strip()
    limit = min(int(data.get("limit", 50)), 100)  # max 100 messages per request
    offset = int(data.get("offset", 0))

    if not with_user:
        await _send_error(websocket, "History requires 'with' field", 400)
        return

    try:
        messages = await get_dm_history(
            user1_id=user_id,
            user2_id=with_user,
            limit=limit,
            offset=offset
        )
        await websocket.send_json({
            "type": "history",
            "with": with_user,
            "messages": messages,
            "limit": limit,
            "offset": offset,
            "count": len(messages)
        })
    except Exception as e:
        logger.error(f"Failed to fetch history for {user_id}: {e}")
        await _send_error(websocket, "Failed to fetch message history", 500)


async def _send_error(websocket: WebSocket, message: str, code: int) -> None:
    """Helper — send structured error response to client."""
    await websocket.send_json({
        "type": "error",
        "code": code,
        "message": message,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })