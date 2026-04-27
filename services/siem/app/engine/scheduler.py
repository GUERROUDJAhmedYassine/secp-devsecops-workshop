"""
SIEM — Detection Engine Scheduler
Runs the detection rules and baseline updater on a periodic loop
as a background thread inside the FastAPI process.
"""
import time
import logging
import threading
from core.database import SessionLocal
from engine.rules import run_all_rules
from engine.baselines import update_baselines
from core.config import ENGINE_INTERVAL_SEC

logger = logging.getLogger(__name__)

# Shared list for WebSocket push — main.py reads and flushes this
_pending_alerts: list[dict] = []
_pending_events: list[dict] = []
_lock = threading.Lock()
_last_event_id = None


def get_and_flush_alerts() -> list[dict]:
    """Thread-safe: get all pending alerts and clear the buffer."""
    with _lock:
        alerts = list(_pending_alerts)
        _pending_alerts.clear()
    return alerts

def get_and_flush_events() -> list[dict]:
    """Thread-safe: get all pending events and clear the buffer."""
    with _lock:
        events = list(_pending_events)
        _pending_events.clear()
    return events


def _engine_loop():
    """Main detection loop — runs in a daemon thread."""
    logger.info(f"Detection engine started (interval: {ENGINE_INTERVAL_SEC}s)")

    # Wait for DB to be ready
    time.sleep(5)

    cycle = 0
    while True:
        try:
            db = SessionLocal()
            try:
                # Run detection rules every cycle
                new_alerts = run_all_rules(db)
                if new_alerts:
                    with _lock:
                        _pending_alerts.extend(new_alerts)
                    logger.info(f"Detection cycle {cycle}: {len(new_alerts)} new alerts")

                # Track new events for WebSocket broadcast
                global _last_event_id
                if _last_event_id is None:
                    row = db.execute(text("SELECT MAX(id) FROM siem.events")).fetchone()
                    _last_event_id = row[0] if row and row[0] else 0
                else:
                    from sqlalchemy import text
                    new_events = db.execute(
                        text("SELECT id, event_type, severity, service, user_id, source_ip, payload, created_at FROM siem.events WHERE id > :last_id ORDER BY id ASC"), 
                        {"last_id": _last_event_id}
                    ).fetchall()
                    
                    if new_events:
                        _last_event_id = new_events[-1][0]
                        events_out = []
                        for e in new_events:
                            events_out.append({
                                "id": e[0],
                                "event_type": e[1],
                                "severity": e[2],
                                "service": e[3],
                                "user_id": str(e[4]) if e[4] else None,
                                "source_ip": str(e[5]) if e[5] else None,
                                "payload": e[6],
                                "created_at": e[7].isoformat(),
                            })
                        with _lock:
                            _pending_events.extend(events_out)

                # Update baselines every 10th cycle (less frequent)
                if cycle % 10 == 0:
                    update_baselines(db)

            finally:
                db.close()

        except Exception as e:
            logger.error(f"Detection engine error in cycle {cycle}: {e}")

        cycle += 1
        time.sleep(ENGINE_INTERVAL_SEC)


def start_engine():
    """Start the detection engine in a daemon thread."""
    thread = threading.Thread(target=_engine_loop, daemon=True, name="siem-engine")
    thread.start()
    logger.info("Detection engine thread started")
