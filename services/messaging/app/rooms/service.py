# rooms/service.py
import logging
from datetime import datetime, timezone

import asyncpg
from fastapi import HTTPException, status
from core.database import get_pool
from core.time_utils import to_utc_iso
from rooms.membership import is_room_member
from messages import room_repository

logger = logging.getLogger(__name__)

PROJECT_ROOM_PREFIX = "project::"


def _stored_room_name(name: str, *, is_project: bool) -> str:
    clean_name = name.strip()
    if not clean_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Room name is required",
        )
    return f"{PROJECT_ROOM_PREFIX}{clean_name}" if is_project else clean_name


def _split_room_name(stored_name: str) -> tuple[str, bool]:
    if stored_name.startswith(PROJECT_ROOM_PREFIX):
        return stored_name[len(PROJECT_ROOM_PREFIX):], True
    return stored_name, False


def _serialize_room(row: asyncpg.Record) -> dict:
    display_name, prefixed_project = _split_room_name(row["name"])
    is_project = prefixed_project or bool(row["has_project_files"])
    return {
        "id": str(row["id"]),
        "name": display_name,
        "department": row["department"],
        "created_by": str(row["created_by"]) if row["created_by"] else None,
        "created_at": to_utc_iso(row["created_at"]),
        "is_project": is_project,
        "last_message_at": to_utc_iso(row["last_message_at"]) if row["last_message_at"] else None,
    }


async def handle_room_message(room_id: str, sender_id: str, content: str):
    """
    Called by websocket/handler.py when a 'room' type message is received.
    Validates membership, saves the message, and broadcasts to all room members.
    """
    # websocket/manager.py exports send_to_user(), not a "manager" object
    from websocket.manager import send_to_user  # lazy import to avoid circular imports
    # --- membership check ---
    if not await is_room_member(room_id, sender_id):
        await send_to_user(sender_id, {
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
        "sender_id": sender_id,
        "sender_username": sender_username,
        "room_id": room_id,
        "content": content,
        "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "message_id": saved["id"]
    }

    # --- broadcast to every room member ---
    members = await get_room_members(room_id)
    for member_id in members:
        await send_to_user(member_id, message_dict)

    # --- rate-limit / SIEM stub ---
    recent_count = await room_repository.count_recent_messages(sender_id, seconds=60)
    if recent_count > 10:
        # TODO: await siem_emitter.emit("MASS_MESSAGE_BURST", "HIGH", sender_id, {"room_id": room_id})
        logger.warning("Rate limit: user %s sent %d messages in 60s in room %s", sender_id, recent_count, room_id)


async def create_room(name: str, department: str, created_by: str, *, is_project: bool = False) -> dict:
    """Create a new room and auto-add the creator as its first member."""
    pool = get_pool()
    stored_name = _stored_room_name(name, is_project=is_project)
    async with pool.acquire() as conn:
        async with conn.transaction():
            try:
                row = await conn.fetchrow(
                    """
                    INSERT INTO app.rooms (name, department, created_by)
                    VALUES ($1, $2, $3::uuid)
                    RETURNING id, name, department, created_by, created_at
                    """,
                    stored_name, department, created_by
                )
            except asyncpg.UniqueViolationError as exc:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="A room with this name already exists",
                ) from exc
            await conn.execute(
                """
                INSERT INTO app.room_members (room_id, user_id)
                VALUES ($1::uuid, $2::uuid)
                """,
                str(row["id"]), created_by
            )
    logger.info("Room created id=%s name=%s project=%s by=%s", row["id"], stored_name, is_project, created_by)
    return {
        "id": str(row["id"]),
        "name": name.strip(),
        "department": row["department"],
        "created_by": str(row["created_by"]),
        "created_at": to_utc_iso(row["created_at"]),
        "is_project": is_project,
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


async def list_rooms_for_user(user_id: str, *, project_only: bool | None = None) -> list[dict]:
    """Fetch rooms that the user is a member of."""
    pool = get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT
                r.id,
                r.name,
                r.department,
                r.created_by,
                r.created_at,
                lm.created_at AS last_message_at,
                EXISTS (
                    SELECT 1
                    FROM app.files f
                    WHERE f.is_deleted = false
                      AND f.bucket = 'project/' || r.id::text
                ) AS has_project_files
            FROM app.rooms r
            JOIN app.room_members rm ON rm.room_id = r.id
            LEFT JOIN LATERAL (
                SELECT m.created_at
                FROM app.messages m
                WHERE m.room_id = r.id
                  AND m.is_deleted = FALSE
                ORDER BY m.created_at DESC
                LIMIT 1
            ) lm ON TRUE
            WHERE rm.user_id = $1::uuid
            ORDER BY COALESCE(lm.created_at, r.created_at) DESC
            """
            ,
            user_id
        )
    serialized: list[dict] = []
    for row in rows:
        payload = _serialize_room(row)
        if project_only is None or payload["is_project"] == project_only:
            serialized.append(payload)
    logger.debug("Listed %d rooms for user=%s project_only=%s", len(serialized), user_id, project_only)
    return serialized


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


async def remove_user_from_room(room_id: str, user_id: str, *, actor_id: str, actor_role: str) -> dict:
    """Remove a user from a room. Returns a status payload."""
    pool = get_pool()
    async with pool.acquire() as conn:
        room_row = await conn.fetchrow(
            "SELECT created_by FROM app.rooms WHERE id = $1::uuid",
            room_id,
        )
        if not room_row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Room not found",
            )

        creator_id = str(room_row["created_by"])
        if user_id == creator_id and actor_role != "IT_ADMIN":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only IT_ADMIN can remove the room creator",
            )

        async with conn.transaction():
            result = await conn.execute(
                """
                DELETE FROM app.room_members
                WHERE room_id = $1::uuid AND user_id = $2::uuid
                """,
                room_id, user_id
            )
    # asyncpg returns strings like "DELETE 1"
    removed = int(result.split()[-1]) if isinstance(result, str) else 0
    if removed == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User is not a member of this room"
        )
    logger.info("User %s removed from room %s", user_id, room_id)
    return {"room_id": room_id, "user_id": user_id, "status": "removed"}
