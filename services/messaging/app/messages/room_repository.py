# messages/room_repository.py
import logging
from core.database import get_pool
from core.time_utils import to_utc_iso

logger = logging.getLogger(__name__)

MAX_HISTORY_LIMIT = 100


def _format_message(row) -> dict:
    """Convert an asyncpg Record to a serialisable dict matching the agreed message shape."""
    return {
        "id": str(row["id"]),
        "sender_id": str(row["sender_id"]),
        "recipient_id": str(row["recipient_id"]) if row["recipient_id"] else None,
        "room_id": str(row["room_id"]) if row["room_id"] else None,
        "content": row["content"],
        "is_read": row["is_read"],
        "is_deleted": row["is_deleted"],
        "created_at": to_utc_iso(row["created_at"])
    }


async def save_room_message(room_id: str, sender_id: str, content: str) -> dict:
    """Insert a new room message into app.messages and return the formatted row."""
    pool = get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            row = await conn.fetchrow(
                """
                INSERT INTO app.messages (sender_id, recipient_id, room_id, content)
                VALUES ($1::uuid, NULL, $2::uuid, $3)
                RETURNING id, sender_id, recipient_id, room_id, content, is_read, is_deleted, created_at
                """,
                sender_id, room_id, content
            )
    logger.info("Saved room message id=%s room=%s sender=%s", row["id"], room_id, sender_id)
    return _format_message(row)


async def get_room_history(room_id: str, limit: int = 50) -> list[dict]:
    """Fetch the last N messages for a room, joined with sender username, ordered ASC."""
    limit = min(limit, MAX_HISTORY_LIMIT)
    pool = get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT recent.id, recent.sender_id, recent.recipient_id, recent.room_id,
                   recent.content, recent.is_read, recent.is_deleted, recent.created_at,
                   u.username
            FROM (
                SELECT m.id, m.sender_id, m.recipient_id, m.room_id,
                       m.content, m.is_read, m.is_deleted, m.created_at
                FROM app.messages m
                WHERE m.room_id = $1::uuid AND m.is_deleted = FALSE
                ORDER BY m.created_at DESC
                LIMIT $2
            ) recent
            JOIN app.users u ON u.id = recent.sender_id
            ORDER BY recent.created_at ASC
            """,
            room_id, limit
        )
    logger.debug("Fetched %d messages for room=%s", len(rows), room_id)
    result = []
    for row in rows:
        msg = _format_message(row)
        msg["username"] = row["username"]
        result.append(msg)
    return result


async def count_recent_messages(sender_id: str, seconds: int = 60) -> int:
    """Count how many messages a sender has sent in the last N seconds."""
    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT COUNT(*) AS cnt
            FROM app.messages
            WHERE sender_id = $1::uuid
              AND created_at > NOW() - INTERVAL '1 second' * $2
            """,
            sender_id, seconds
        )
    return row["cnt"] if row else 0
