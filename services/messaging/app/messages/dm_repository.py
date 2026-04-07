import logging
from uuid import UUID
from datetime import datetime, timezone
from core.database import get_pool

logger = logging.getLogger(__name__)

# Maximum messages to return in one request — hard cap
MAX_HISTORY_LIMIT = 100


async def save_dm(
    sender_id: str,
    recipient_id: str,
    content: str
) -> UUID:
    """Save a direct message and return its UUID."""
    pool = get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            row = await conn.fetchrow(
                """
                INSERT INTO app.messages (sender_id, recipient_id, content)
                VALUES ($1::uuid, $2::uuid, $3)
                RETURNING id, created_at
                """,
                sender_id, recipient_id, content
            )
            if not row:
                raise RuntimeError(f"Failed to save DM from {sender_id} to {recipient_id}")

            logger.info(f"DM saved — id={row['id']} from={sender_id} to={recipient_id}")
            return row["id"]


async def get_dm_history(
    user1_id: str,
    user2_id: str,
    limit: int = 50,
    offset: int = 0
) -> list[dict]:
    """Fetch paginated conversation history between two users oldest first."""
    limit = min(limit, MAX_HISTORY_LIMIT)
    offset = max(offset, 0)

    pool = get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT
                id,
                sender_id,
                recipient_id,
                content,
                is_read,
                is_deleted,
                created_at
            FROM app.messages
            WHERE is_deleted = FALSE
              AND (
                (sender_id = $1::uuid AND recipient_id = $2::uuid)
                OR
                (sender_id = $2::uuid AND recipient_id = $1::uuid)
              )
            ORDER BY created_at ASC
            LIMIT $3 OFFSET $4
            """,
            user1_id, user2_id, limit, offset
        )

        logger.debug(f"History fetched — between={user1_id}&{user2_id} count={len(rows)}")
        return [_format_message(row) for row in rows]


async def get_unread_count(
    user_id: str,
    sender_id: str
) -> int:
    """Count unread messages from a specific sender to a user."""
    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT COUNT(*) AS count
            FROM app.messages
            WHERE recipient_id = $1::uuid
              AND sender_id = $2::uuid
              AND is_read = FALSE
              AND is_deleted = FALSE
            """,
            user_id, sender_id
        )
        count = int(row["count"]) if row else 0
        logger.debug(f"Unread count for {user_id} from {sender_id}: {count}")
        return count


async def get_all_unread_counts(user_id: str) -> list[dict]:
    """Get unread message counts from ALL senders for a user in one query."""
    pool = get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT
                sender_id,
                COUNT(*) AS unread_count,
                MAX(created_at) AS latest_at
            FROM app.messages
            WHERE recipient_id = $1::uuid
              AND is_read = FALSE
              AND is_deleted = FALSE
            GROUP BY sender_id
            ORDER BY latest_at DESC
            """,
            user_id
        )
        return [
            {
                "sender_id": str(row["sender_id"]),
                "unread_count": int(row["unread_count"]),
                "latest_at": row["latest_at"].isoformat()
            }
            for row in rows
        ]


async def mark_as_read(
    user_id: str,
    sender_id: str
) -> int:
    """Mark all messages from sender to user as read. Returns count updated."""
    pool = get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            result = await conn.execute(
                """
                UPDATE app.messages
                SET is_read = TRUE
                WHERE recipient_id = $1::uuid
                  AND sender_id = $2::uuid
                  AND is_read = FALSE
                  AND is_deleted = FALSE
                """,
                user_id, sender_id
            )
            count = int(result.split()[-1])
            if count > 0:
                logger.info(f"Marked {count} messages as read — user={user_id} from={sender_id}")
            return count


async def mark_single_as_read(
    message_id: str,
    reader_id: str
) -> bool:
    """Mark a specific message as read. Only recipient can mark it."""
    pool = get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            # Verify recipient ownership before updating
            row = await conn.fetchrow(
                """
                SELECT recipient_id FROM app.messages
                WHERE id = $1::uuid AND is_deleted = FALSE
                """,
                message_id
            )

            if not row:
                return False

            if str(row["recipient_id"]) != reader_id:
                logger.warning(f"Read rejected — {reader_id} is not the recipient of {message_id}")
                raise PermissionError("You can only mark messages sent to you as read")

            result = await conn.execute(
                """
                UPDATE app.messages
                SET is_read = TRUE
                WHERE id = $1::uuid AND is_read = FALSE
                """,
                message_id
            )
            updated = "1" in result
            if updated:
                logger.info(f"Message {message_id} marked as read by {reader_id}")
            return updated


async def soft_delete_message(
    message_id: str,
    user_id: str
) -> bool:
    """Soft delete a message — only sender can delete. Audit trail preserved."""
    pool = get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            # First verify ownership before deleting
            owner = await conn.fetchrow(
                """
                SELECT sender_id FROM app.messages
                WHERE id = $1::uuid AND is_deleted = FALSE
                """,
                message_id
            )

            if not owner:
                logger.warning(f"Delete failed — message {message_id} not found")
                return False

            if str(owner["sender_id"]) != user_id:
                logger.warning(f"Delete rejected — {user_id} does not own message {message_id}")
                raise PermissionError("You can only delete your own messages")

            await conn.execute(
                """
                UPDATE app.messages
                SET is_deleted = TRUE
                WHERE id = $1::uuid
                """,
                message_id
            )
            logger.info(f"Message {message_id} soft deleted by {user_id}")
            return True


async def get_conversation_list(user_id: str) -> list[dict]:
    """Get all conversations for a user with latest message and unread count."""
    pool = get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT DISTINCT ON (other_user)
                CASE
                    WHEN sender_id = $1::uuid THEN recipient_id
                    ELSE sender_id
                END AS other_user,
                content,
                created_at,
                is_read,
                sender_id
            FROM app.messages
            WHERE (sender_id = $1::uuid OR recipient_id = $1::uuid)
              AND is_deleted = FALSE
            ORDER BY other_user, created_at DESC
            """,
            user_id
        )
        return [
            {
                "other_user": str(row["other_user"]),
                "last_message": row["content"] if not row["is_deleted"] else "[deleted]",
                "last_message_at": row["created_at"].isoformat(),
                "is_read": row["is_read"],
                "sent_by_me": str(row["sender_id"]) == user_id
            }
            for row in rows
        ]


def _format_message(row) -> dict:
    """Convert database row to clean API response dict."""
    return {
        "id": str(row["id"]),
        "sender_id": str(row["sender_id"]),
        "recipient_id": str(row["recipient_id"]),
        "content": row["content"] if not row["is_deleted"] else "[deleted]",
        "is_read": row["is_read"],
        "is_deleted": row["is_deleted"],
        "created_at": row["created_at"].isoformat()
    }