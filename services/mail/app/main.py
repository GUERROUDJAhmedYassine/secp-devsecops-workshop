"""
SECP Mail Service
Port: 8002

Handles internal email between corporate accounts (allowed domains from config).
Uses MailHog as SMTP relay for visual confirmation.
Source of truth for email delivery is PostgreSQL app.emails.
"""
import os
import logging
import mimetypes
from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID

from fastapi import (
    Depends,
    FastAPI,
    File,
    Form,
    HTTPException,
    Query,
    Request,
    UploadFile,
    status,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import ValidationError
from sqlalchemy import or_
from sqlalchemy.orm import Session

from auth import get_current_user
from config import MASS_EMAIL_THRESHOLD, MAX_ATTACHMENT_SIZE
from database import get_db
from models import Email, User
from schemas import (
    EmailListResponse,
    EmailResponse,
    EmailSend,
    SearchResponse,
    SearchResult,
    format_file_size,
)
from siem import (
    ATTACHMENT_TOO_LARGE,
    EMAIL_DELETED,
    EMAIL_REJECTED,
    EMAIL_SENT,
    EXTERNAL_RELAY_ATTEMPT,
    MASS_EMAIL_BURST,
    SUSPICIOUS_CONTENT,
    UNAUTHORIZED_ACCESS,
    siem_emit,
)
from utils import (
    detect_suspicious_content,
    forward_to_mailhog,
    attachment_display_name,
    is_internal_email,
    save_attachment,
)

app = FastAPI(title="SECP Mail Service", version="1.0.0")
logger = logging.getLogger(__name__)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_attachment_size_label(email: Email) -> Optional[str]:
    if not email.has_attachment or not email.attachment_path:
        return None

    if not os.path.exists(email.attachment_path):
        return None

    try:
        return format_file_size(os.path.getsize(email.attachment_path))
    except OSError:
        logger.warning("Failed to read attachment size for %s", email.attachment_path)
        return None


def get_attachment_name(email: Email) -> Optional[str]:
    if not email.has_attachment or not email.attachment_path:
        return None
    return attachment_display_name(email.attachment_path)


def build_email_response(email: Email) -> EmailResponse:
    """Build EmailResponse from an ORM email record."""
    return EmailResponse(
        id=str(email.id),
        sender_id=str(email.sender_id),
        sender_username=email.sender.username,
        sender_email=email.sender.email,
        recipient_id=str(email.recipient_id),
        recipient_username=email.recipient.username,
        recipient_email=email.recipient.email,
        subject=email.subject,
        body=email.body or "",
        has_attachment=email.has_attachment,
        attachment_name=get_attachment_name(email),
        attachment_size=get_attachment_size_label(email),
        is_read=email.is_read,
        sent_at=email.sent_at,
    )


@app.post("/mail/send", response_model=EmailResponse, status_code=status.HTTP_201_CREATED)
async def send_email(
    request: Request,
    to: str = Form(...),
    subject: str = Form(...),
    body: Optional[str] = Form(""),
    attachment: Optional[UploadFile] = File(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Send an internal email to another user on an allowed corporate domain.

    Accepts multipart form data so the endpoint can support optional attachments.
    """
    try:
        email_data = EmailSend(to=to, subject=subject, body=body)
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=exc.errors()) from exc

    source_ip = request.client.host if request.client else None

    if not is_internal_email(email_data.to):
        siem_emit(
            db,
            EXTERNAL_RELAY_ATTEMPT,
            "HIGH",
            user_id=str(current_user.id),
            source_ip=source_ip,
            payload={"attempted_recipient": email_data.to},
        )
        raise HTTPException(
            status_code=403,
            detail="External email addresses are not permitted. Use an allowed internal domain only.",
        )

    recipient = db.query(User).filter(
        User.email == email_data.to,
        User.is_active.is_(True),
    ).first()

    if not recipient:
        siem_emit(
            db,
            EMAIL_REJECTED,
            "MEDIUM",
            user_id=str(current_user.id),
            source_ip=source_ip,
            payload={"reason": "recipient_not_found", "attempted_email": email_data.to},
        )
        raise HTTPException(status_code=404, detail="Recipient not found")

    attachment_path = None
    attachment_size_bytes = None
    has_attachment = False

    if attachment and attachment.filename:
        content = await attachment.read()
        file_size = len(content)

        if file_size > MAX_ATTACHMENT_SIZE:
            siem_emit(
                db,
                ATTACHMENT_TOO_LARGE,
                "MEDIUM",
                user_id=str(current_user.id),
                source_ip=source_ip,
                payload={"size_bytes": file_size, "max_bytes": MAX_ATTACHMENT_SIZE},
            )
            raise HTTPException(
                status_code=413,
                detail=f"Attachment exceeds {format_file_size(MAX_ATTACHMENT_SIZE)} limit",
            )

        attachment_path = save_attachment(content, attachment.filename)
        attachment_size_bytes = file_size
        has_attachment = True

    match = detect_suspicious_content(email_data.body)
    if match:
        siem_emit(
            db,
            SUSPICIOUS_CONTENT,
            "MEDIUM",
            user_id=str(current_user.id),
            source_ip=source_ip,
            payload={"pattern_matched": match, "recipient": email_data.to},
        )

    email = Email(
        sender_id=current_user.id,
        recipient_id=recipient.id,
        subject=email_data.subject,
        body=email_data.body,
        has_attachment=has_attachment,
        attachment_path=attachment_path,
    )

    try:
        db.add(email)
        db.commit()
        db.refresh(email)
    except Exception:
        logger.exception(
            "Failed to save email sender=%s recipient=%s",
            current_user.email,
            email_data.to,
        )
        if attachment_path and os.path.exists(attachment_path):
            os.remove(attachment_path)
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to save email")

    await forward_to_mailhog(
        sender_email=current_user.email,
        recipient_email=recipient.email,
        subject=email_data.subject,
        body=email_data.body or "",
        attachment_path=attachment_path,
    )

    siem_emit(
        db,
        EMAIL_SENT,
        "INFO",
        user_id=str(current_user.id),
        source_ip=source_ip,
        payload={
            "email_id": str(email.id),
            "recipient_id": str(recipient.id),
            "recipient_email": email_data.to,
            "has_attachment": has_attachment,
            "attachment_size_bytes": attachment_size_bytes,
        },
    )

    recent_count = db.query(Email).filter(
        Email.sender_id == current_user.id,
        Email.sent_at >= datetime.utcnow() - timedelta(minutes=10),
    ).count()

    if recent_count >= MASS_EMAIL_THRESHOLD:
        siem_emit(
            db,
            MASS_EMAIL_BURST,
            "MEDIUM",
            user_id=str(current_user.id),
            source_ip=source_ip,
            payload={"count": recent_count, "window_minutes": 10},
        )

    return build_email_response(email)


@app.get("/mail/search", response_model=SearchResponse)
def search_emails(
    q: str = Query(..., min_length=2, max_length=100),
    search_in: str = Query("both", pattern="^(subject|body|both)$"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Search inbox and sent mail by subject and/or body."""
    query_value = q.strip()
    conditions = []

    if search_in in ["subject", "both"]:
        conditions.append(Email.subject.ilike(f"%{query_value}%"))
    if search_in in ["body", "both"]:
        conditions.append(Email.body.ilike(f"%{query_value}%"))

    emails = db.query(Email).filter(
        or_(
            Email.sender_id == current_user.id,
            Email.recipient_id == current_user.id,
        ),
        Email.is_deleted.is_(False),
        or_(*conditions),
    ).order_by(Email.sent_at.desc()).limit(50).all()

    return SearchResponse(
        query=query_value,
        count=len(emails),
        results=[
            SearchResult(
                id=str(email.id),
                subject=email.subject,
                sender=email.sender.email,
                recipient=email.recipient.email,
                sent_at=email.sent_at,
                is_read=email.is_read,
                folder="sent" if str(email.sender_id) == str(current_user.id) else "inbox",
            )
            for email in emails
        ],
    )


@app.get("/mail/stats/unread")
def get_unread_count(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Unread count for notification badges."""
    count = db.query(Email).filter(
        Email.recipient_id == current_user.id,
        Email.is_read.is_(False),
        Email.is_deleted.is_(False),
    ).count()
    return {"unread_count": count}


@app.get("/mail/inbox", response_model=EmailListResponse)
def get_inbox(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    unread_only: bool = Query(False),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Paginated inbox for the current user."""
    query = db.query(Email).filter(
        Email.recipient_id == current_user.id,
        Email.is_deleted.is_(False),
    )

    if unread_only:
        query = query.filter(Email.is_read.is_(False))

    total = query.count()
    unread_count = db.query(Email).filter(
        Email.recipient_id == current_user.id,
        Email.is_read.is_(False),
        Email.is_deleted.is_(False),
    ).count()

    emails = query.order_by(Email.sent_at.desc()).offset((page - 1) * per_page).limit(per_page).all()

    return EmailListResponse(
        total=total,
        unread_count=unread_count,
        emails=[build_email_response(email) for email in emails],
    )


@app.get("/mail/sent", response_model=EmailListResponse)
def get_sent(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Paginated sent mail for the current user."""
    query = db.query(Email).filter(
        Email.sender_id == current_user.id,
        Email.is_deleted.is_(False),
    )

    total = query.count()
    emails = query.order_by(Email.sent_at.desc()).offset((page - 1) * per_page).limit(per_page).all()

    return EmailListResponse(
        total=total,
        unread_count=0,
        emails=[build_email_response(email) for email in emails],
    )


@app.get("/mail/{email_id}", response_model=EmailResponse)
def get_email(
    email_id: UUID,
    request: Request,
    mark_read: bool = Query(True),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a single email. Only the sender or recipient may access it."""
    email = db.query(Email).filter(
        Email.id == email_id,
        Email.is_deleted.is_(False),
    ).first()

    if not email:
        raise HTTPException(status_code=404, detail="Email not found")

    is_sender = str(email.sender_id) == str(current_user.id)
    is_recipient = str(email.recipient_id) == str(current_user.id)

    if not (is_sender or is_recipient):
        siem_emit(
            db,
            UNAUTHORIZED_ACCESS,
            "HIGH",
            user_id=str(current_user.id),
            source_ip=request.client.host if request.client else None,
            payload={"email_id": str(email_id), "actual_owner": str(email.recipient_id)},
        )
        raise HTTPException(status_code=403, detail="Access denied")

    if mark_read and is_recipient and not email.is_read:
        email.is_read = True
        db.commit()
        db.refresh(email)

    return build_email_response(email)


@app.get("/mail/{email_id}/attachment")
def download_attachment(
    email_id: UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Download an email attachment. Only the sender or recipient may access it."""
    email = db.query(Email).filter(
        Email.id == email_id,
        Email.is_deleted.is_(False),
    ).first()

    if not email:
        raise HTTPException(status_code=404, detail="Email not found")

    is_sender = str(email.sender_id) == str(current_user.id)
    is_recipient = str(email.recipient_id) == str(current_user.id)

    if not (is_sender or is_recipient):
        siem_emit(
            db,
            UNAUTHORIZED_ACCESS,
            "HIGH",
            user_id=str(current_user.id),
            source_ip=request.client.host if request.client else None,
            payload={"email_id": str(email_id), "actual_owner": str(email.recipient_id)},
        )
        raise HTTPException(status_code=403, detail="Access denied")

    if not email.has_attachment or not email.attachment_path:
        raise HTTPException(status_code=404, detail="Attachment not found")

    if not os.path.exists(email.attachment_path):
        logger.warning("Attachment file missing for email %s", email.id)
        raise HTTPException(status_code=404, detail="Attachment file is unavailable")

    attachment_name = get_attachment_name(email) or "attachment"
    media_type = mimetypes.guess_type(attachment_name)[0] or "application/octet-stream"

    return FileResponse(
        email.attachment_path,
        media_type=media_type,
        filename=attachment_name,
    )


@app.delete("/mail/{email_id}")
def delete_email(
    email_id: UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Soft-delete an email. Only the recipient can delete it from the inbox."""
    email = db.query(Email).filter(
        Email.id == email_id,
        Email.is_deleted.is_(False),
    ).first()

    if not email:
        raise HTTPException(status_code=404, detail="Email not found")

    if str(email.recipient_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Only the recipient can delete this email")

    email.is_deleted = True
    db.commit()

    siem_emit(
        db,
        EMAIL_DELETED,
        "INFO",
        user_id=str(current_user.id),
        source_ip=request.client.host if request.client else None,
        payload={"email_id": str(email_id)},
    )

    return {"message": "Email deleted"}


@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "mail", "port": 8002}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8002, reload=True)
