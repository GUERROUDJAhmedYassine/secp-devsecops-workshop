"""
Mail Service — Pydantic Schemas
Request bodies, response shapes, and validators.
"""
from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import datetime
import re


# ── Helpers ───────────────────────────────────────────────────────────────────

def format_file_size(size_bytes: int) -> str:
    """Convert bytes to human-readable string for API responses."""
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    return f"{size_bytes / (1024 * 1024):.1f} MB"


# ── Request Schemas ───────────────────────────────────────────────────────────

class EmailSend(BaseModel):
    to:      str           = Field(..., description="Recipient company email")
    subject: str           = Field(..., min_length=1, max_length=500)
    body:    Optional[str] = Field(default="", max_length=50000)

    @field_validator("to")
    @classmethod
    def validate_email_format(cls, v: str) -> str:
        v = v.strip().lower()
        if not re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', v):
            raise ValueError("Invalid email format")
        return v

    @field_validator("subject")
    @classmethod
    def sanitize_subject(cls, v: str) -> str:
        v = v.strip()
        v = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', '', v)
        if not v:
            raise ValueError("Subject cannot be empty after sanitization")
        return v

    @field_validator("body")
    @classmethod
    def sanitize_body(cls, v: Optional[str]) -> str:
        if v is None:
            return ""
        return v.replace('\x00', '')


# ── Response Schemas ──────────────────────────────────────────────────────────

class EmailResponse(BaseModel):
    id:                 str
    sender_id:          str
    sender_username:    str
    sender_email:       str
    recipient_id:       str
    recipient_username: str
    recipient_email:    str
    subject:            str
    body:               str
    has_attachment:     bool
    attachment_size:    Optional[str]   # human-readable, generated from bytes
    is_read:            bool
    sent_at:            datetime

    class Config:
        from_attributes = True


class EmailListResponse(BaseModel):
    emails:       List[EmailResponse]
    total:        int
    unread_count: int


class SearchResult(BaseModel):
    id:       str
    subject:  str
    sender:   str
    recipient: str
    sent_at:  datetime
    is_read:  bool
    folder:   str   # "inbox" or "sent"


class SearchResponse(BaseModel):
    query:   str
    results: List[SearchResult]
    count:   int
