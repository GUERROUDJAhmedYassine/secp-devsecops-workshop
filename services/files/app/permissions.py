import uuid
from pathlib import Path

import asyncpg
from fastapi import HTTPException

from app.config import uploads_root
from app.models import CurrentUser

PROJECT_PREFIX = "project/"


def _project_room_id(bucket: str) -> str | None:
    if not bucket.startswith(PROJECT_PREFIX):
        return None
    room_id = bucket[len(PROJECT_PREFIX):].strip()
    if not room_id:
        raise HTTPException(status_code=400, detail="Project bucket requires a room id")
    try:
        return str(uuid.UUID(room_id))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid project bucket room id") from exc


def bucket_to_dir(bucket: str, user: CurrentUser) -> Path:
    root = uploads_root()
    if bucket == "personal":
        return root / "personal" / str(user.id)
    if bucket == "shared":
        return root / "shared"
    if bucket == "admin":
        return root / "admin"
    if bucket.startswith("team/"):
        _, dept = bucket.split("/", 1)
        return root / "team" / dept
    project_room_id = _project_room_id(bucket)
    if project_room_id:
        return root / "projects" / project_room_id
    raise HTTPException(status_code=400, detail="Invalid bucket")


async def list_member_room_ids(pool: asyncpg.Pool, user_id: uuid.UUID) -> set[str]:
    rows = await pool.fetch(
        """
        SELECT room_id
        FROM app.room_members
        WHERE user_id = $1::uuid
        """,
        str(user_id),
    )
    return {str(row["room_id"]) for row in rows}


async def is_room_member(pool: asyncpg.Pool, room_id: str, user_id: uuid.UUID) -> bool:
    row = await pool.fetchrow(
        """
        SELECT 1
        FROM app.room_members
        WHERE room_id = $1::uuid AND user_id = $2::uuid
        """,
        room_id,
        str(user_id),
    )
    return row is not None


async def ensure_bucket_allowed_for_upload(bucket: str, user: CurrentUser, pool: asyncpg.Pool) -> None:
    if bucket == "personal":
        return
    if bucket == "shared" or bucket == "admin":
        if user.role != "IT_ADMIN":
            raise HTTPException(status_code=403, detail=f"{bucket} bucket is IT_ADMIN only")
        return
    if bucket.startswith("team/"):
        dept = bucket.split("/", 1)[1]
        if dept == "management":
            if user.role not in ("MANAGER", "IT_ADMIN"):
                raise HTTPException(status_code=403, detail="Management team bucket restricted")
            return
        if user.role not in ("MANAGER", "IT_ADMIN"):
            raise HTTPException(status_code=403, detail="Team bucket upload requires MANAGER")
        if user.role != "IT_ADMIN" and (not user.department or user.department != dept):
            raise HTTPException(status_code=403, detail="Cannot upload to other departments")
        return

    project_room_id = _project_room_id(bucket)
    if project_room_id:
        if user.role == "IT_ADMIN":
            return
        if await is_room_member(pool, project_room_id, user.id):
            return
        raise HTTPException(status_code=403, detail="Project upload requires room membership")

    raise HTTPException(status_code=400, detail="Invalid bucket")


def can_read_record(
    rec: asyncpg.Record,
    user: CurrentUser,
    *,
    member_room_ids: set[str] | None = None,
) -> bool:
    bucket = rec["bucket"]
    owner_id = rec["owner_id"]

    if bucket == "personal":
        return str(user.id) == str(owner_id)
    if user.role == "IT_ADMIN":
        return True
    if bucket == "shared":
        return True
    if bucket.startswith("team/"):
        dept = bucket.split("/", 1)[1]
        if dept == "management":
            return user.role == "MANAGER"
        return bool(user.department) and user.department == dept

    project_room_id = _project_room_id(bucket)
    if project_room_id:
        return project_room_id in (member_room_ids or set())
    return False


def can_delete_record(
    rec: asyncpg.Record,
    user: CurrentUser,
    *,
    member_room_ids: set[str] | None = None,
) -> bool:
    bucket = rec["bucket"]
    owner_id = rec["owner_id"]

    if bucket == "personal":
        return str(user.id) == str(owner_id)
    if user.role == "IT_ADMIN":
        return True
    if bucket == "shared":
        return False
    if bucket.startswith("team/"):
        dept = bucket.split("/", 1)[1]
        if dept == "management":
            return user.role == "MANAGER"
        return user.role == "MANAGER" and bool(user.department) and user.department == dept

    project_room_id = _project_room_id(bucket)
    if project_room_id:
        return user.role == "MANAGER" and project_room_id in (member_room_ids or set())
    return False


async def get_file_row(pool: asyncpg.Pool, file_id: uuid.UUID) -> asyncpg.Record:
    rec = await pool.fetchrow(
        """
        SELECT id, owner_id, filename, file_size, mime_type, storage_path, bucket, is_deleted, uploaded_at
        FROM app.files
        WHERE id = $1
        """,
        str(file_id),
    )
    if not rec or rec["is_deleted"]:
        raise HTTPException(status_code=404, detail="File not found")
    return rec
