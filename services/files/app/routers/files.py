import uuid
from pathlib import Path
from typing import Optional

import asyncpg
from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse

from app.auth import get_current_user, get_current_user_from_token
from app.collaboration import collaboration_manager
from app.config import now_utc, sanitize_filename, uploads_root
from app.dependencies import get_db
from app.events import emit_event
from app.models import CollaborationSessionResponse, CollaborationStateResponse, CurrentUser, FileRecord, ListResponse, UploadResponse
from app.permissions import bucket_to_dir, can_delete_record, can_read_record, ensure_bucket_allowed_for_upload, get_file_row

router = APIRouter(tags=["files"])


@router.post("/files/upload", response_model=UploadResponse)
async def upload_file(
    request: Request,
    bucket: str = "personal",
    file: UploadFile = File(...),
    user: CurrentUser = Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_db),
) -> UploadResponse:
    ensure_bucket_allowed_for_upload(bucket, user)

    file_id = uuid.uuid4()
    safe_name = sanitize_filename(file.filename or "file")
    dst_dir = bucket_to_dir(bucket, user)
    dst_dir.mkdir(parents=True, exist_ok=True)

    dst_path = (dst_dir / f"{file_id}_{safe_name}").resolve()
    if not str(dst_path).startswith(str(uploads_root())):
        raise HTTPException(status_code=400, detail="Invalid resolved path")

    size = 0
    with open(dst_path, "wb") as handle:
        while True:
            chunk = await file.read(1024 * 1024)
            if not chunk:
                break
            size += len(chunk)
            handle.write(chunk)

    uploaded_at = now_utc()
    await pool.execute(
        """
        INSERT INTO app.files (id, owner_id, filename, file_size, mime_type, storage_path, bucket, is_deleted, uploaded_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, false, $8)
        """,
        str(file_id),
        str(user.id),
        safe_name,
        int(size),
        file.content_type,
        str(dst_path),
        bucket,
        uploaded_at,
    )

    await emit_event(
        pool,
        event_type="FILE_UPLOAD",
        severity="INFO",
        user=user,
        request=request,
        payload={"file_id": str(file_id), "bucket": bucket, "filename": safe_name, "file_size": size},
    )
    return UploadResponse(id=file_id, filename=safe_name, bucket=bucket, uploaded_at=uploaded_at)


@router.get("/files", response_model=ListResponse)
async def list_files(
    request: Request,
    bucket: Optional[str] = None,
    user: CurrentUser = Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_db),
) -> ListResponse:
    rows = await pool.fetch(
        """
        SELECT id, owner_id, filename, file_size, mime_type, storage_path, bucket, is_deleted, uploaded_at
        FROM app.files
        WHERE is_deleted = false
        ORDER BY uploaded_at DESC
        LIMIT 500
        """
    )
    items: list[FileRecord] = []
    for row in rows:
        if bucket and row["bucket"] != bucket:
            continue
        if can_read_record(row, user):
            items.append(FileRecord(**dict(row)))

    await emit_event(
        pool,
        event_type="FILES_LIST",
        severity="INFO",
        user=user,
        request=request,
        payload={"bucket": bucket},
    )
    return ListResponse(items=items)


@router.get("/files/{file_id}")
async def download_file(
    request: Request,
    file_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_db),
) -> FileResponse:
    rec = await get_file_row(pool, file_id)
    if not can_read_record(rec, user):
        await emit_event(
            pool,
            event_type="UNAUTHORIZED_ACCESS",
            severity="HIGH",
            user=user,
            request=request,
            payload={"file_id": str(file_id), "bucket": rec["bucket"]},
        )
        raise HTTPException(status_code=403, detail="Access denied")

    path = Path(rec["storage_path"])
    if not path.exists():
        raise HTTPException(status_code=404, detail="File missing on disk")

    await emit_event(
        pool,
        event_type="FILE_DOWNLOAD",
        severity="INFO",
        user=user,
        request=request,
        payload={"file_id": str(file_id), "bucket": rec["bucket"], "filename": rec["filename"]},
    )

    count = await pool.fetchval(
        """
        SELECT COUNT(*) FROM siem.events
        WHERE service = 'files'
          AND event_type = 'FILE_DOWNLOAD'
          AND user_id = $1
          AND created_at >= (NOW() - interval '10 minutes')
        """,
        str(user.id),
    )
    if count and int(count) >= 15:
        await emit_event(
            pool,
            event_type="MASS_DOWNLOAD",
            severity="CRITICAL",
            user=user,
            request=request,
            payload={"downloads_last_10min": int(count)},
        )

    return FileResponse(path=str(path), filename=rec["filename"], media_type=rec["mime_type"] or "application/octet-stream")


@router.delete("/files/{file_id}")
async def delete_file(
    request: Request,
    file_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_db),
) -> dict:
    rec = await get_file_row(pool, file_id)
    if not can_delete_record(rec, user):
        await emit_event(
            pool,
            event_type="UNAUTHORIZED_ACCESS",
            severity="HIGH",
            user=user,
            request=request,
            payload={"file_id": str(file_id), "action": "delete", "bucket": rec["bucket"]},
        )
        raise HTTPException(status_code=403, detail="Access denied")

    await pool.execute("UPDATE app.files SET is_deleted = true WHERE id = $1", str(file_id))
    await emit_event(
        pool,
        event_type="FILE_DELETE",
        severity="MEDIUM",
        user=user,
        request=request,
        payload={"file_id": str(file_id), "bucket": rec["bucket"], "filename": rec["filename"]},
    )
    return {"ok": True, "id": str(file_id)}


@router.post("/files/{file_id}/collaborate", response_model=CollaborationSessionResponse)
async def collaborate_on_file(
    request: Request,
    file_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_db),
) -> CollaborationSessionResponse:
    rec = await get_file_row(pool, file_id)
    if not can_read_record(rec, user):
        raise HTTPException(status_code=403, detail="Access denied")

    session = await collaboration_manager.open_session(
        file_id=file_id,
        user_id=user.id,
        filename=rec["filename"],
        mime_type=rec["mime_type"],
    )
    participants = sorted(session.participants)
    status = "collaborative" if len(participants) > 1 else "solo"

    await emit_event(
        pool,
        event_type="FILE_COLLABORATION_OPEN",
        severity="INFO",
        user=user,
        request=request,
        payload={
            "file_id": str(file_id),
            "session_id": session.session_id,
            "participants_count": len(participants),
            "mode": session.mode,
        },
    )

    message = (
        f"Opened {session.mode} emulator for live collaboration."
        if status == "collaborative"
        else f"Opened {session.mode} emulator. Waiting for another participant."
    )
    return CollaborationSessionResponse(
        session_id=session.session_id,
        file_id=file_id,
        mode=session.mode,
        status=status,
        participants=participants,
        opened_at=session.opened_at,
        websocket_path=f"/files/{file_id}/collaborate/ws/{session.session_id}",
        revision=session.revision,
        message=message,
    )


@router.get("/files/{file_id}/collaborate/{session_id}", response_model=CollaborationStateResponse)
async def get_collaboration_state(
    file_id: uuid.UUID,
    session_id: str,
    user: CurrentUser = Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_db),
) -> CollaborationStateResponse:
    rec = await get_file_row(pool, file_id)
    if not can_read_record(rec, user):
        raise HTTPException(status_code=403, detail="Access denied")
    snapshot = await collaboration_manager.snapshot(file_id=file_id, session_id=session_id)
    return CollaborationStateResponse(**snapshot)


@router.websocket("/files/{file_id}/collaborate/ws/{session_id}")
async def collaboration_websocket(
    websocket: WebSocket,
    file_id: uuid.UUID,
    session_id: str,
    token: str = Query(...),
) -> None:
    await websocket.accept()

    try:
        user = get_current_user_from_token(token)
    except HTTPException:
        await websocket.send_json({"type": "error", "detail": "Invalid token"})
        await websocket.close(code=4401)
        return

    pool = getattr(websocket.app.state, "db_pool", None)
    if pool is None:
        await websocket.send_json({"type": "error", "detail": "Service unavailable"})
        await websocket.close(code=1011)
        return

    try:
        rec = await get_file_row(pool, file_id)
        if not can_read_record(rec, user):
            await websocket.send_json({"type": "error", "detail": "Access denied"})
            await websocket.close(code=4403)
            return

        await collaboration_manager.attach_socket(
            file_id=file_id,
            session_id=session_id,
            user_id=user.id,
            websocket=websocket,
        )
        snapshot = await collaboration_manager.snapshot(file_id=file_id, session_id=session_id)
        await websocket.send_json({"type": "snapshot", **snapshot})
        await collaboration_manager.broadcast(
            file_id=file_id,
            session_id=session_id,
            message={
                "type": "presence_joined",
                "session_id": session_id,
                "file_id": str(file_id),
                "user_id": str(user.id),
                "participants": snapshot["participants"],
            },
            except_user_id=str(user.id),
        )

        while True:
            incoming = await websocket.receive_json()
            operation = incoming.get("operation")
            if not isinstance(operation, dict):
                await websocket.send_json({"type": "error", "detail": "operation object is required"})
                continue

            event = await collaboration_manager.apply_operation(
                file_id=file_id,
                session_id=session_id,
                user_id=user.id,
                operation=operation,
            )
            await collaboration_manager.broadcast(
                file_id=file_id,
                session_id=session_id,
                message=event,
            )
    except WebSocketDisconnect:
        pass
    except ValueError as exc:
        await websocket.send_json({"type": "error", "detail": str(exc)})
        await websocket.close(code=4400)
    finally:
        await collaboration_manager.detach_socket(file_id=file_id, session_id=session_id, user_id=user.id)
        try:
            snapshot = await collaboration_manager.snapshot(file_id=file_id, session_id=session_id)
            await collaboration_manager.broadcast(
                file_id=file_id,
                session_id=session_id,
                message={
                    "type": "presence_left",
                    "session_id": session_id,
                    "file_id": str(file_id),
                    "user_id": str(user.id),
                    "participants": snapshot["participants"],
                },
                except_user_id=str(user.id),
            )
        except Exception:
            return
