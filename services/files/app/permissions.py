import uuid
from pathlib import Path

import asyncpg
from fastapi import HTTPException

from app.config import uploads_root
from app.models import CurrentUser


def bucket_to_dir(bucket: str, user: CurrentUser) -> Path:
    root = uploads_root()
    if bucket == "personal":
        return root / "personal" / str(user.id)
    if bucket == "shared":
        return root / "shared"
    if bucket.startswith("team/"):
        _, dept = bucket.split("/", 1)
        return root / "team" / dept
    raise HTTPException(status_code=400, detail="Invalid bucket")


def ensure_bucket_allowed_for_upload(bucket: str, user: CurrentUser) -> None:
    if bucket == "personal":
        return
    if bucket == "shared":
        if user.role != "IT_ADMIN":
            raise HTTPException(status_code=403, detail="Shared bucket is IT_ADMIN only")
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
    raise HTTPException(status_code=400, detail="Invalid bucket")


def can_read_record(rec: asyncpg.Record, user: CurrentUser) -> bool:
    bucket = rec["bucket"]
    owner_id = rec["owner_id"]

    if user.role == "IT_ADMIN":
        return True
    if bucket == "personal":
        return str(user.id) == str(owner_id)
    if bucket == "shared":
        return True
    if bucket.startswith("team/"):
        dept = bucket.split("/", 1)[1]
        if dept == "management":
            return user.role == "MANAGER"
        return bool(user.department) and user.department == dept
    return False


def can_delete_record(rec: asyncpg.Record, user: CurrentUser) -> bool:
    bucket = rec["bucket"]
    owner_id = rec["owner_id"]

    if user.role == "IT_ADMIN":
        return True
    if bucket == "shared":
        return False
    if bucket == "personal":
        return str(user.id) == str(owner_id)
    if bucket.startswith("team/"):
        dept = bucket.split("/", 1)[1]
        if dept == "management":
            return user.role == "MANAGER"
        return user.role == "MANAGER" and bool(user.department) and user.department == dept
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
