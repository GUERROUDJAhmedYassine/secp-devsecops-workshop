import asyncio
import copy
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any

from app.config import now_utc


@dataclass
class CollaborationSession:
    session_id: str
    file_id: uuid.UUID
    mode: str
    participants: set[str] = field(default_factory=set)
    sockets: dict[str, Any] = field(default_factory=dict)
    text_content: str = ""
    sheet_cells: dict[str, str] = field(default_factory=dict)
    revision: int = 0
    opened_at: datetime = field(default_factory=now_utc)
    last_activity: datetime = field(default_factory=now_utc)


class CollaborationManager:
    def __init__(self) -> None:
        self._global_lock = asyncio.Lock()
        self._file_locks: dict[str, asyncio.Lock] = {}
        self._sessions_by_file: dict[str, CollaborationSession] = {}

    async def _get_file_lock(self, file_id: uuid.UUID) -> asyncio.Lock:
        key = str(file_id)
        async with self._global_lock:
            if key not in self._file_locks:
                self._file_locks[key] = asyncio.Lock()
            return self._file_locks[key]

    def choose_mode(self, filename: str, mime_type: str | None) -> str:
        extension = Path(filename).suffix.lower()
        spreadsheet_ext = {".xlsx", ".xls", ".csv", ".ods"}
        spreadsheet_mime = {
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.ms-excel",
            "text/csv",
            "application/vnd.oasis.opendocument.spreadsheet",
        }
        if extension in spreadsheet_ext or (mime_type and mime_type in spreadsheet_mime):
            return "excel"
        return "word"

    async def open_session(
        self,
        *,
        file_id: uuid.UUID,
        user_id: uuid.UUID,
        filename: str,
        mime_type: str | None,
    ) -> CollaborationSession:
        lock = await self._get_file_lock(file_id)
        async with lock:
            key = str(file_id)
            session = self._sessions_by_file.get(key)
            if session is None:
                session = CollaborationSession(
                    session_id=str(uuid.uuid4()),
                    file_id=file_id,
                    mode=self.choose_mode(filename, mime_type),
                )
                self._sessions_by_file[key] = session
            session.participants.add(str(user_id))
            session.last_activity = now_utc()
            return session

    async def get_session(self, *, file_id: uuid.UUID, session_id: str) -> CollaborationSession | None:
        lock = await self._get_file_lock(file_id)
        async with lock:
            session = self._sessions_by_file.get(str(file_id))
            if session and session.session_id == session_id:
                return session
            return None

    async def attach_socket(
        self,
        *,
        file_id: uuid.UUID,
        session_id: str,
        user_id: uuid.UUID,
        websocket: Any,
    ) -> CollaborationSession:
        lock = await self._get_file_lock(file_id)
        async with lock:
            key = str(file_id)
            session = self._sessions_by_file.get(key)
            if session is None or session.session_id != session_id:
                raise ValueError("Invalid collaboration session")
            uid = str(user_id)
            session.participants.add(uid)
            session.sockets[uid] = websocket
            session.last_activity = now_utc()
            return session

    async def detach_socket(
        self,
        *,
        file_id: uuid.UUID,
        session_id: str,
        user_id: uuid.UUID,
    ) -> None:
        lock = await self._get_file_lock(file_id)
        async with lock:
            session = self._sessions_by_file.get(str(file_id))
            if session is None or session.session_id != session_id:
                return
            uid = str(user_id)
            session.sockets.pop(uid, None)
            session.participants.discard(uid)
            session.last_activity = now_utc()

    async def snapshot(self, *, file_id: uuid.UUID, session_id: str) -> dict[str, Any]:
        lock = await self._get_file_lock(file_id)
        async with lock:
            session = self._sessions_by_file.get(str(file_id))
            if session is None or session.session_id != session_id:
                raise ValueError("Invalid collaboration session")
            return {
                "session_id": session.session_id,
                "file_id": str(session.file_id),
                "mode": session.mode,
                "revision": session.revision,
                "text_content": session.text_content,
                "sheet_cells": copy.deepcopy(session.sheet_cells),
                "participants": sorted(session.participants),
            }

    async def apply_operation(
        self,
        *,
        file_id: uuid.UUID,
        session_id: str,
        user_id: uuid.UUID,
        operation: dict[str, Any],
    ) -> dict[str, Any]:
        lock = await self._get_file_lock(file_id)
        async with lock:
            session = self._sessions_by_file.get(str(file_id))
            if session is None or session.session_id != session_id:
                raise ValueError("Invalid collaboration session")

            op_type = operation.get("type")
            if op_type == "replace_text":
                if session.mode != "word":
                    raise ValueError("replace_text is only valid for word mode")
                session.text_content = str(operation.get("content", ""))
            elif op_type == "replace_sheet":
                if session.mode != "excel":
                    raise ValueError("replace_sheet is only valid for excel mode")
                cells = operation.get("cells") or {}
                if not isinstance(cells, dict):
                    raise ValueError("cells must be an object")
                session.sheet_cells = {str(k): str(v) for k, v in cells.items()}
            elif op_type == "cell_update":
                if session.mode != "excel":
                    raise ValueError("cell_update is only valid for excel mode")
                cell = str(operation.get("cell", "")).upper().strip()
                if not cell:
                    raise ValueError("cell is required")
                value = str(operation.get("value", ""))
                session.sheet_cells[cell] = value
            else:
                raise ValueError("Unsupported operation type")

            session.revision += 1
            session.last_activity = now_utc()
            return {
                "type": "editor_update",
                "session_id": session.session_id,
                "file_id": str(session.file_id),
                "mode": session.mode,
                "revision": session.revision,
                "author_user_id": str(user_id),
                "operation": operation,
                "participants": sorted(session.participants),
            }

    async def broadcast(
        self,
        *,
        file_id: uuid.UUID,
        session_id: str,
        message: dict[str, Any],
        except_user_id: str | None = None,
    ) -> None:
        lock = await self._get_file_lock(file_id)
        async with lock:
            session = self._sessions_by_file.get(str(file_id))
            if session is None or session.session_id != session_id:
                return
            sockets = list(session.sockets.items())
        for uid, socket in sockets:
            if except_user_id and uid == except_user_id:
                continue
            try:
                await socket.send_json(message)
            except Exception:
                # Dead sockets are cleaned on disconnect handler.
                continue


collaboration_manager = CollaborationManager()
