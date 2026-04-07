# rooms/service.py
import logging
from datetime import datetime, timezone
from fastapi import HTTPException, status
from core.database import get_pool
from rooms.membership import is_room_member
from messages import room_repository

logger = logging.getLogger(__name__)


async def handle_room_message(room_id: str, sender_id: str, content: str):
    """
    Called by websocket/handler.py when a 'room' type message is received.
    Validates membership, saves the message, and broadcasts to all room members.
    """
    from websocket.manager import manager  # lazy import — teammate's code
    # --- membership check ---
    if not await is_room_member(room_id, sender_id):
        await manager.send_to_user(sender_id, {
            "type": "error",
            "code": 403,
            "detail": "Not a member of this room"
        })
        return

    # --- persist ---
    saved = await room_repository.save_room_message(room_id, sender_id, content)

    # --- resolve sender username for the broadcast payload ---
    pool = get_pool()
    async with pool.acquire() as conn:
        user_row = await conn.fetchrow(
            "SELECT username FROM app.users WHERE id = $1::uuid", sender_id
        )
    sender_username = user_row["username"] if user_row else "unknown"

    # --- build the agreed-upon message dict ---
    message_dict = {
        "type": "message",
        "from": sender_username,
        "room_id": room_id,
        "content": content,
        "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "message_id": saved["id"]
    }

    # --- broadcast to every room member ---
    members = await get_room_members(room_id)
    for member_id in members:
        await manager.send_to_user(member_id, message_dict)

    # --- rate-limit / SIEM stub ---
    recent_count = await room_repository.count_recent_messages(sender_id, seconds=60)
    if recent_count > 10:
        # TODO: await siem_emitter.emit("MASS_MESSAGE_BURST", "HIGH", sender_id, {"room_id": room_id})
        logger.warning("Rate limit: user %s sent %d messages in 60s in room %s", sender_id, recent_count, room_id)


async def create_room(name: str, department: str, created_by: str) -> dict:
    """Create a new room and auto-add the creator as its first member."""
    pool = get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            row = await conn.fetchrow(
                """
                INSERT INTO app.rooms (name, department, created_by)
                VALUES ($1, $2, $3::uuid)
                RETURNING id, name, department, created_by, created_at
                """,
                name, department, created_by
            )
            await conn.execute(
                """
                INSERT INTO app.room_members (room_id, user_id)
                VALUES ($1::uuid, $2::uuid)
                """,
                str(row["id"]), created_by
            )
    logger.info("Room created id=%s name=%s by=%s", row["id"], name, created_by)
    return {
        "id": str(row["id"]),
        "name": row["name"],
        "department": row["department"],
        "created_by": str(row["created_by"]),
        "created_at": row["created_at"].isoformat()
    }


async def join_room(room_id: str, user_id: str) -> dict:
    """Add a user to a room. Raises 400 if already a member."""
    if await is_room_member(room_id, user_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is already a member of this room"
        )
    pool = get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            await conn.execute(
                """
                INSERT INTO app.room_members (room_id, user_id)
                VALUES ($1::uuid, $2::uuid)
                """,
                room_id, user_id
            )
    logger.info("User %s joined room %s", user_id, room_id)
    return {"room_id": room_id, "user_id": user_id, "status": "joined"}


async def list_rooms() -> list[dict]:
    """Fetch all rooms."""
    pool = get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT id, name, department, created_by, created_at
            FROM app.rooms
            ORDER BY created_at DESC
            """
        )
    logger.debug("Listed %d rooms", len(rows))
    return [
        {
            "id": str(r["id"]),
            "name": r["name"],
            "department": r["department"],
            "created_by": str(r["created_by"]) if r["created_by"] else None,
            "created_at": r["created_at"].isoformat()
        }
        for r in rows
    ]


async def get_room_members(room_id: str) -> list[str]:
    """Return a list of user_id strings for all members of the room."""
    pool = get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT user_id FROM app.room_members WHERE room_id = $1::uuid",
            room_id
        )
    logger.debug("Room %s has %d members", room_id, len(rows))
    return [str(r["user_id"]) for r in rows]
