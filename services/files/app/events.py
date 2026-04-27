import json
from typing import Optional

import asyncpg
from fastapi import Request

from app.models import CurrentUser

SERVICE_NAME = "files"


async def emit_event(
    pool: asyncpg.Pool,
    *,
    event_type: str,
    severity: str,
    user: Optional[CurrentUser],
    request: Request,
    payload: dict,
) -> None:
    source_ip = request.client.host if request.client else None
    await pool.execute(
        """
        INSERT INTO siem.events (event_type, severity, service, user_id, source_ip, payload)
        VALUES ($1, $2, $3, $4, $5::inet, $6::jsonb)
        """,
        event_type,
        severity,
        SERVICE_NAME,
        str(user.id) if user else None,
        source_ip,
        json.dumps(payload),
    )
