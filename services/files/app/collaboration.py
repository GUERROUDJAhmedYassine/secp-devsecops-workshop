import asyncio
import copy
import csv
import io
import re
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any

from app.config import now_utc
from app.preview import is_docx_file, load_docx_preview, save_docx_from_html

WORD_EXTENSIONS = {".txt", ".md", ".html", ".htm", ".docx"}
WORD_MIME_TYPES = {
    "text/plain",
    "text/markdown",
    "text/html",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}
SHEET_EXTENSIONS = {".csv"}
SHEET_MIME_TYPES = {"text/csv", "application/csv"}


def _normalize_mime_type(mime_type: str | None) -> str:
    return (mime_type or "").split(";", 1)[0].strip().lower()


def _column_name_to_index(name: str) -> int:
    result = 0
    for char in name:
        result = (result * 26) + (ord(char) - 64)
    return result - 1


def _column_index_to_name(index: int) -> str:
    label = ""
    current = index
    while True:
        current, remainder = divmod(current, 26)
        label = chr(65 + remainder) + label
        if current == 0:
            break
        current -= 1
    return label


def _parse_cell_key(cell_key: str) -> tuple[int, int] | None:
    match = re.fullmatch(r"([A-Z]+)(\d+)", cell_key.strip().upper())
    if not match:
        return None
    column_name, row_value = match.groups()
    row_index = int(row_value) - 1
    if row_index < 0:
        return None
    return row_index, _column_name_to_index(column_name)


@dataclass
class CollaborationSession:
    session_id: str
    file_id: uuid.UUID
    mode: str
    storage_path: str = ""
    participants: set[str] = field(default_factory=set)
    sockets: dict[str, dict[str, Any]] = field(default_factory=dict)
    text_content: str = ""
    persisted_text_content: str = ""
    sheet_cells: dict[str, str] = field(default_factory=dict)
    yjs_updates: list[str] = field(default_factory=list)
    is_dirty: bool = False
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

    def choose_mode(self, filename: str, mime_type: str | None) -> str | None:
        extension = Path(filename).suffix.lower()
        normalized_mime = _normalize_mime_type(mime_type)
        if extension in SHEET_EXTENSIONS or normalized_mime in SHEET_MIME_TYPES:
            return "excel"
        if extension in WORD_EXTENSIONS or normalized_mime in WORD_MIME_TYPES:
            return "word"
        return None

    def _load_text_content(self, path: Path) -> str:
        if is_docx_file(path.name, None):
            return load_docx_preview(path)
        return path.read_text(encoding="utf-8", errors="ignore")

    def _load_sheet_cells(self, path: Path) -> dict[str, str]:
        sheet_cells: dict[str, str] = {}
        raw = path.read_text(encoding="utf-8", errors="ignore")
        for row_index, row in enumerate(csv.reader(io.StringIO(raw))):
            for column_index, value in enumerate(row):
                if value == "":
                    continue
                cell_key = f"{_column_index_to_name(column_index)}{row_index + 1}"
                sheet_cells[cell_key] = value
        return sheet_cells

    def _save_session_to_disk(self, session: CollaborationSession) -> None:
        if not session.storage_path:
            return

        path = Path(session.storage_path)
        path.parent.mkdir(parents=True, exist_ok=True)

        if session.mode == "word":
            if is_docx_file(path.name, None):
                save_docx_from_html(path, session.persisted_text_content)
                return
            path.write_text(session.persisted_text_content, encoding="utf-8")
            return

        max_row = -1
        max_col = -1
        parsed_cells: dict[tuple[int, int], str] = {}
        for cell_key, value in session.sheet_cells.items():
            parsed = _parse_cell_key(cell_key)
            if parsed is None:
                continue
            row_index, column_index = parsed
            parsed_cells[(row_index, column_index)] = value
            max_row = max(max_row, row_index)
            max_col = max(max_col, column_index)

        output = io.StringIO()
        writer = csv.writer(output)
        for row_index in range(max_row + 1):
            row_values: list[str] = []
            for column_index in range(max_col + 1):
                row_values.append(parsed_cells.get((row_index, column_index), ""))
            writer.writerow(row_values)
        path.write_text(output.getvalue(), encoding="utf-8")

    async def open_session(
        self,
        *,
        file_id: uuid.UUID,
        user_id: uuid.UUID,
        filename: str,
        mime_type: str | None,
        storage_path: str = "",
    ) -> CollaborationSession:
        lock = await self._get_file_lock(file_id)
        async with lock:
            key = str(file_id)
            session = self._sessions_by_file.get(key)
            if session is None:
                mode = self.choose_mode(filename, mime_type)
                if mode is None:
                    raise ValueError("Collaboration supports .txt, .md, .html, .htm, .docx, and .csv files")

                text_content = ""
                sheet_cells: dict[str, str] = {}
                path = Path(storage_path)
                if path.exists() and path.is_file():
                    if mode == "word":
                        text_content = self._load_text_content(path)
                    elif mode == "excel":
                        sheet_cells = self._load_sheet_cells(path)

                session = CollaborationSession(
                    session_id=str(uuid.uuid4()),
                    file_id=file_id,
                    mode=mode,
                    storage_path=storage_path,
                    text_content=text_content,
                    persisted_text_content=text_content,
                    sheet_cells=sheet_cells,
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
            session.sockets.setdefault(uid, {})[str(id(websocket))] = websocket
            session.last_activity = now_utc()
            return session

    async def detach_socket(
        self,
        *,
        file_id: uuid.UUID,
        session_id: str,
        user_id: uuid.UUID,
        websocket: Any,
    ) -> None:
        lock = await self._get_file_lock(file_id)
        async with lock:
            key = str(file_id)
            session = self._sessions_by_file.get(key)
            if session is None or session.session_id != session_id:
                return

            uid = str(user_id)
            user_sockets = session.sockets.get(uid)
            if user_sockets is not None:
                user_sockets.pop(str(id(websocket)), None)
                if not user_sockets:
                    session.sockets.pop(uid, None)
                    session.participants.discard(uid)

            session.last_activity = now_utc()

            if not session.sockets:
                if session.is_dirty:
                    self._save_session_to_disk(session)
                self._sessions_by_file.pop(key, None)

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
                "yjs_updates": list(session.yjs_updates),
                "participants": sorted(session.participants),
            }

    async def apply_operation(
        self,
        *,
        file_id: uuid.UUID,
        session_id: str,
        user_id: uuid.UUID,
        operation: dict[str, Any],
    ) -> dict[str, Any] | None:
        lock = await self._get_file_lock(file_id)
        async with lock:
            session = self._sessions_by_file.get(str(file_id))
            if session is None or session.session_id != session_id:
                raise ValueError("Invalid collaboration session")

            op_type = operation.get("type")
            if op_type == "replace_text":
                if session.mode != "word":
                    raise ValueError("replace_text is only valid for word mode")
                content = str(operation.get("content", ""))
                if content != session.persisted_text_content:
                    session.is_dirty = True
                session.text_content = content
                session.persisted_text_content = content
            elif op_type == "replace_sheet":
                if session.mode != "excel":
                    raise ValueError("replace_sheet is only valid for excel mode")
                cells = operation.get("cells") or {}
                if not isinstance(cells, dict):
                    raise ValueError("cells must be an object")
                next_cells = {str(k): str(v) for k, v in cells.items()}
                if next_cells != session.sheet_cells:
                    session.is_dirty = True
                session.sheet_cells = next_cells
            elif op_type == "cell_update":
                if session.mode != "excel":
                    raise ValueError("cell_update is only valid for excel mode")
                cell = str(operation.get("cell", "")).upper().strip()
                if not cell:
                    raise ValueError("cell is required")
                value = str(operation.get("value", ""))
                if session.sheet_cells.get(cell) != value:
                    session.is_dirty = True
                session.sheet_cells[cell] = value
            elif op_type == "yjs_update":
                if session.mode != "word":
                    raise ValueError("yjs_update is only valid for word mode")
                b64_update = str(operation.get("updateBase64", ""))
                if not b64_update:
                    raise ValueError("updateBase64 is required")
                session.yjs_updates.append(b64_update)
            elif op_type == "sync_content":
                if session.mode != "word":
                    raise ValueError("sync_content is only valid for word mode")
                html_content = str(operation.get("content", ""))
                plain_text = str(operation.get("plainText", ""))
                extension = Path(session.storage_path).suffix.lower()
                next_content = html_content if extension in {".html", ".htm", ".docx"} else plain_text
                if next_content != session.persisted_text_content:
                    session.is_dirty = True
                session.persisted_text_content = next_content
                session.last_activity = now_utc()
                return None
            else:
                raise ValueError(f"Unsupported operation type: {op_type}")

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
            sockets = [
                (uid, socket)
                for uid, user_sockets in session.sockets.items()
                for socket in user_sockets.values()
            ]

        for uid, socket in sockets:
            if except_user_id and uid == except_user_id:
                continue
            try:
                await socket.send_json(message)
            except Exception:
                continue


collaboration_manager = CollaborationManager()
