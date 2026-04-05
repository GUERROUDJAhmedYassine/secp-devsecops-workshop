import logging
import json
import asyncio
from typing import Optional
from core.database import db

logger = logging.getLogger(__name__)

async def _write_to_db(event_type: str, severity: str, service: str, user_id: Optional[str], source_ip: Optional[str], payload: dict) -> None:
    query = """
        INSERT INTO siem.events (event_type, severity, service, user_id, source_ip, payload)
        VALUES ($1, $2, $3, $4, $5, $6::jsonb)
    """
    try:
        if db.pool is not None:
            payload_str = json.dumps(payload)
            await db.pool.execute(query, event_type, severity, service, user_id, source_ip, payload_str)
    except Exception as e:
        logger.error(f"Failed to emit SIEM event silently: {e}")

async def emit(event_type: str, severity: str, service: str, user_id: Optional[str], source_ip: Optional[str], payload: dict) -> None:
    """Emits security events to the SIEM database table in the background without blocking."""
    asyncio.create_task(
        _write_to_db(event_type, severity, service, user_id, source_ip, payload)
    )

# Explanation: Asynchronously writes audit logs to the SIEM table using a background task to prevent blocking.
# Security note: Wraps the network call in a catch-all block to prevent logging failures from crashing the service.
