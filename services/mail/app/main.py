"""
SECP — Mail Service
Port: 8002

Handles internal email between corporate accounts (allowed domains from config).
Uses MailHog as SMTP relay for visual confirmation.
Source of truth for email delivery is PostgreSQL app.emails.

Endpoints:
    POST   /mail/send
    GET    /mail/inbox
    GET    /mail/sent
    GET    /mail/search          ← must be defined BEFORE /{email_id}
    GET    /mail/stats/unread    ← must be defined BEFORE /{email_id}
    GET    /mail/{email_id}
    DELETE /mail/{email_id}
    GET    /health
"""

from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Query, Request, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, text
from datetime import datetime, timedelta
from typing import Optional

from config import MAX_ATTACHMENT_SIZE, MASS_EMAIL_THRESHOLD
from database import get_db
from models import Email, User
from schemas import (
    EmailSend, EmailResponse, EmailListResponse,
    SearchResponse, SearchResult, format_file_size
)
from auth import get_current_user
from siem import (
    siem_emit,
    EMAIL_SENT, EMAIL_REJECTED, EMAIL_DELETED,
    EXTERNAL_RELAY_ATTEMPT, ATTACHMENT_TOO_LARGE,
    SUSPICIOUS_CONTENT, MASS_EMAIL_BURST, UNAUTHORIZED_ACCESS
)
from utils import (
    is_internal_email, detect_suspicious_content,
    forward_to_mailhog, save_attachment
)

app = FastAPI(title="SECP Mail Service", version="1.0.0")


# ── Helper ────────────────────────────────────────────────────────────────────

def build_email_response(email: Email) -> EmailResponse:
    """Build EmailResponse from ORM object."""
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
        attachment_size=(
            format_file_size(email.attachment_size_bytes)
            if email.attachment_size_bytes else None
        ),
        is_read=email.is_read,
        sent_at=email.sent_at,
    )


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.post("/mail/send", response_model=EmailResponse, status_code=status.HTTP_201_CREATED)
async def send_email(
    request:     Request,
    email_data:  EmailSend,
    attachment:  Optional[UploadFile] = File(None),
    current_user: User    = Depends(get_current_user),
    db:           Session = Depends(get_db),
):
    """
    Send an internal email to another user on an allowed corporate domain.

    Order of checks:
    1. Domain validation (before any DB query)
    2. Recipient exists
    3. Attachment size + save
    4. Suspicious content scan
    5. Store in DB
    6. Forward to MailHog (non-fatal)
    7. Emit SIEM event
    8. Check mass-email pattern
    """
    source_ip = request.client.host

    # ── 1. Domain check FIRST — before any DB query ──────────────────────────
    # FIX: original code checked recipient existence first, meaning external
    # addresses never reached the domain check and EXTERNAL_RELAY_ATTEMPT
    # was never emitted. Domain must be validated before the DB query.
    if not is_internal_email(email_data.to):
        siem_emit(
            db, EXTERNAL_RELAY_ATTEMPT, "HIGH",
            user_id=str(current_user.id), source_ip=source_ip,
            payload={"attempted_recipient": email_data.to}
        )
        raise HTTPException(
            status_code=403,
            detail="External email addresses are not permitted. Use an allowed internal domain only."
        )

    # ── 2. Recipient must exist and be active ────────────────────────────────
    recipient = db.query(User).filter(
        User.email == email_data.to.strip().lower(),
        User.is_active == True
    ).first()

    if not recipient:
        siem_emit(
            db, EMAIL_REJECTED, "MEDIUM",
            user_id=str(current_user.id), source_ip=source_ip,
            payload={"reason": "recipient_not_found", "attempted_email": email_data.to}
        )
        raise HTTPException(status_code=404, detail="Recipient not found")

    # ── 3. Attachment handling ────────────────────────────────────────────────
    attachment_path       = None
    attachment_size_bytes = None
    has_attachment        = False

    if attachment and attachment.filename:
        content   = await attachment.read()
        file_size = len(content)

        if file_size > MAX_ATTACHMENT_SIZE:
            siem_emit(
                db, ATTACHMENT_TOO_LARGE, "MEDIUM",
                user_id=str(current_user.id), source_ip=source_ip,
                payload={"size_bytes": file_size, "max_bytes": MAX_ATTACHMENT_SIZE}
            )
            raise HTTPException(
                status_code=413,
                detail=f"Attachment exceeds {format_file_size(MAX_ATTACHMENT_SIZE)} limit"
            )

        attachment_path       = save_attachment(content, attachment.filename)
        attachment_size_bytes = file_size
        has_attachment        = True

    # ── 4. Suspicious content scan ────────────────────────────────────────────
    match = detect_suspicious_content(email_data.body)
    if match:
        siem_emit(
            db, SUSPICIOUS_CONTENT, "MEDIUM",
            user_id=str(current_user.id), source_ip=source_ip,
            payload={"pattern_matched": match, "recipient": email_data.to}
        )
        # We log but do not block — analyst reviews the alert

    # ── 5. Persist to database ────────────────────────────────────────────────
    email = Email(
        sender_id=current_user.id,
        recipient_id=recipient.id,
        subject=email_data.subject,
        body=email_data.body,
        has_attachment=has_attachment,
        attachment_path=attachment_path,
        attachment_size_bytes=attachment_size_bytes,
    )
    db.add(email)
    db.commit()
    db.refresh(email)

    # ── 6. Forward to MailHog (visual SMTP confirmation — non-fatal) ──────────
    await forward_to_mailhog(
        sender_email=current_user.email,
        recipient_email=recipient.email,
        subject=email_data.subject,
        body=email_data.body or "",
        attachment_path=attachment_path,
    )

    # ── 7. SIEM: email sent ───────────────────────────────────────────────────
    siem_emit(
        db, EMAIL_SENT, "INFO",
        user_id=str(current_user.id), source_ip=source_ip,
        payload={
            "email_id":       str(email.id),
            "recipient_id":   str(recipient.id),
            "recipient_email": email_data.to,
            "has_attachment": has_attachment,
            "attachment_size_bytes": attachment_size_bytes,
        }
    )

    # ── 8. SIEM: mass email burst check ──────────────────────────────────────
    recent_count = db.query(Email).filter(
        Email.sender_id == current_user.id,
        Email.sent_at   >= datetime.utcnow() - timedelta(minutes=10)
    ).count()

    if recent_count >= MASS_EMAIL_THRESHOLD:
        siem_emit(
            db, MASS_EMAIL_BURST, "MEDIUM",
            user_id=str(current_user.id), source_ip=source_ip,
            payload={"count": recent_count, "window_minutes": 10}
        )

    return build_email_response(email)


# ── FIX: /mail/search and /mail/stats/unread MUST be before /mail/{email_id} ──
# FastAPI matches routes top-to-bottom. If /{email_id} is first,
# requests to /mail/search are captured as email_id="search" and return 404.

@app.get("/mail/search", response_model=SearchResponse)
def search_emails(
    request:     Request,
    q:           str     = Query(..., min_length=2, max_length=100),
    search_in:   str     = Query("both", pattern="^(subject|body|both)$"),
    current_user: User   = Depends(get_current_user),
    db:          Session = Depends(get_db),
):
    """Search inbox and sent folder by subject and/or body."""
    q = q.strip()

    conditions = []
    if search_in in ["subject", "both"]:
        conditions.append(Email.subject.ilike(f"%{q}%"))
    if search_in in ["body", "both"]:
        conditions.append(Email.body.ilike(f"%{q}%"))

    emails = db.query(Email).filter(
        or_(
            Email.sender_id    == current_user.id,
            Email.recipient_id == current_user.id,
        ),
        Email.is_deleted == False,
        or_(*conditions),
    ).order_by(Email.sent_at.desc()).limit(50).all()

    return SearchResponse(
        query=q,
        count=len(emails),
        results=[
            SearchResult(
                id=str(e.id),
                subject=e.subject,
                sender=e.sender.email,
                recipient=e.recipient.email,
                sent_at=e.sent_at,
                is_read=e.is_read,
                folder="sent" if str(e.sender_id) == str(current_user.id) else "inbox",
            )
            for e in emails
        ],
    )


@app.get("/mail/stats/unread")
def get_unread_count(
    current_user: User   = Depends(get_current_user),
    db:          Session = Depends(get_db),
):
    """Unread count for notification badge."""
    count = db.query(Email).filter(
        Email.recipient_id == current_user.id,
        Email.is_read      == False,
        Email.is_deleted   == False,
    ).count()
    return {"unread_count": count}


@app.get("/mail/inbox", response_model=EmailListResponse)
def get_inbox(
    page:        int  = Query(1,  ge=1),
    per_page:    int  = Query(20, ge=1, le=100),
    unread_only: bool = Query(False),
    current_user: User   = Depends(get_current_user),
    db:          Session = Depends(get_db),
):
    """Paginated inbox for the current user."""
    query = db.query(Email).filter(
        Email.recipient_id == current_user.id,
        Email.is_deleted   == False,
    )
    if unread_only:
        query = query.filter(Email.is_read == False)

    total        = query.count()
    unread_count = db.query(Email).filter(
        Email.recipient_id == current_user.id,
        Email.is_read      == False,
        Email.is_deleted   == False,
    ).count()

    emails = query.order_by(Email.sent_at.desc()) \
                  .offset((page - 1) * per_page) \
                  .limit(per_page).all()

    return EmailListResponse(
        total=total,
        unread_count=unread_count,
        emails=[build_email_response(e) for e in emails],
    )


@app.get("/mail/sent", response_model=EmailListResponse)
def get_sent(
    page:     int  = Query(1,  ge=1),
    per_page: int  = Query(20, ge=1, le=100),
    current_user: User   = Depends(get_current_user),
    db:          Session = Depends(get_db),
):
    """Paginated sent folder for the current user."""
    query = db.query(Email).filter(
        Email.sender_id  == current_user.id,
        Email.is_deleted == False,
    )
    total  = query.count()
    emails = query.order_by(Email.sent_at.desc()) \
                  .offset((page - 1) * per_page) \
                  .limit(per_page).all()

    return EmailListResponse(
        total=total,
        unread_count=0,
        emails=[build_email_response(e) for e in emails],
    )


@app.get("/mail/{email_id}", response_model=EmailResponse)
def get_email(
    email_id:  str,
    request:   Request,
    mark_read: bool    = Query(True),
    current_user: User   = Depends(get_current_user),
    db:          Session = Depends(get_db),
):
    """Get a single email. Only sender or recipient may access it."""
    email = db.query(Email).filter(
        Email.id         == email_id,
        Email.is_deleted == False,
    ).first()

    if not email:
        raise HTTPException(status_code=404, detail="Email not found")

    is_sender    = str(email.sender_id)    == str(current_user.id)
    is_recipient = str(email.recipient_id) == str(current_user.id)

    if not (is_sender or is_recipient):
        siem_emit(
            db, UNAUTHORIZED_ACCESS, "HIGH",
            user_id=str(current_user.id), source_ip=request.client.host,
            payload={"email_id": email_id, "actual_owner": str(email.recipient_id)}
        )
        raise HTTPException(status_code=403, detail="Access denied")

    if mark_read and is_recipient and not email.is_read:
        email.is_read = True
        db.commit()

    return build_email_response(email)


@app.delete("/mail/{email_id}")
def delete_email(
    email_id: str,
    request:  Request,
    current_user: User   = Depends(get_current_user),
    db:          Session = Depends(get_db),
):
    """Soft-delete an email. Only the recipient can delete from their inbox."""
    email = db.query(Email).filter(
        Email.id         == email_id,
        Email.is_deleted == False,
    ).first()

    if not email:
        raise HTTPException(status_code=404, detail="Email not found")

    if str(email.recipient_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Only the recipient can delete this email")

    email.is_deleted = True
    db.commit()

    siem_emit(
        db, EMAIL_DELETED, "INFO",
        user_id=str(current_user.id), source_ip=request.client.host,
        payload={"email_id": email_id}
    )

    return {"message": "Email deleted"}


@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "mail", "port": 8002}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8002, reload=True)
