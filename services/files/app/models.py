import uuid
from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel


Role = Literal["EMPLOYEE", "MANAGER", "IT_ADMIN"]


class CurrentUser(BaseModel):
    id: uuid.UUID
    role: Role
    department: Optional[str] = None
    username: Optional[str] = None


class FileRecord(BaseModel):
    id: uuid.UUID
    owner_id: uuid.UUID
    filename: str
    file_size: int
    mime_type: Optional[str] = None
    storage_path: str
    bucket: str
    is_deleted: bool
    uploaded_at: datetime


class UploadResponse(BaseModel):
    id: uuid.UUID
    filename: str
    bucket: str
    uploaded_at: datetime


class ListResponse(BaseModel):
    items: list[FileRecord]


class CollaborationSessionResponse(BaseModel):
    session_id: str
    file_id: uuid.UUID
    mode: Literal["word", "excel"]
    status: Literal["solo", "collaborative"]
    participants: list[str]
    opened_at: datetime
    websocket_path: str
    revision: int
    message: str


class CollaborationStateResponse(BaseModel):
    session_id: str
    file_id: uuid.UUID
    mode: Literal["word", "excel"]
    revision: int
    text_content: str
    sheet_cells: dict[str, str]
    participants: list[str]
