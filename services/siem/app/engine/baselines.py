"""
SIEM — Baseline Updater
Periodically recalculates user_baselines from event history.
Uses exponential moving average for smooth baseline evolution.
"""
import logging
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import text

logger = logging.getLogger(__name__)

EMA_ALPHA = 0.3  # weight for new data (0.3 = 30% new, 70% old)


def update_baselines(db: Session) -> int:
    """
    Recalculate baselines for all users with recent activity.
    Returns number of baselines updated.
    """
    # Ensure all active users have a baseline row
    db.execute(text("""
        INSERT INTO siem.user_baselines (user_id)
        SELECT id FROM app.users WHERE is_active = true
        ON CONFLICT (user_id) DO NOTHING
    """))
    db.commit()

    # Calculate last 24h activity per user
    cutoff = datetime.utcnow() - timedelta(hours=24)

    rows = db.execute(text("""
        SELECT
            e.user_id,
            COALESCE(AVG(EXTRACT(HOUR FROM e.created_at))
                FILTER (WHERE e.event_type = 'LOGIN_SUCCESS'), NULL) as avg_hour,
            COALESCE(COUNT(*) FILTER (WHERE e.event_type = 'MESSAGE_SENT'), 0) as msg_count,
            COALESCE(COUNT(*) FILTER (WHERE e.event_type = 'EMAIL_SENT'), 0) as email_count,
            COALESCE(COUNT(*) FILTER (WHERE e.event_type IN ('FILE_DOWNLOAD', 'FILE_UPLOADED')), 0) as file_count,
            ARRAY_AGG(DISTINCT e.source_ip::text)
                FILTER (WHERE e.source_ip IS NOT NULL AND e.event_type = 'LOGIN_SUCCESS') as ips,
            COUNT(*) as total_events
        FROM siem.events e
        WHERE e.created_at >= :cutoff
          AND e.user_id IS NOT NULL
        GROUP BY e.user_id
    """), {"cutoff": cutoff}).fetchall()

    updated = 0
    for row in rows:
        user_id = row[0]
        new_avg_hour = row[1]
        msg_count = row[2]
        email_count = row[3]
        file_count = row[4]
        ips = [ip for ip in (row[5] or []) if ip]
        total_events = row[6]

        # Get current baseline
        current = db.execute(text("""
            SELECT avg_login_hour, avg_messages_day, avg_emails_day, avg_files_day,
                   known_ips, confidence, tx_count
            FROM siem.user_baselines WHERE user_id = :uid
        """), {"uid": str(user_id)}).fetchone()

        if not current:
            continue

        old_hour = current[0] or 12.0
        old_msg = current[1] or 0.0
        old_email = current[2] or 0.0
        old_files = current[3] or 0.0
        old_ips = current[4] or []
        old_confidence = current[5] or 0.0
        old_tx = current[6] or 0

        # EMA update
        new_tx = old_tx + 1
        ema_hour = (EMA_ALPHA * new_avg_hour + (1 - EMA_ALPHA) * old_hour) if new_avg_hour else old_hour
        ema_msg = EMA_ALPHA * msg_count + (1 - EMA_ALPHA) * old_msg
        ema_email = EMA_ALPHA * email_count + (1 - EMA_ALPHA) * old_email
        ema_files = EMA_ALPHA * file_count + (1 - EMA_ALPHA) * old_files

        # Merge IPs (keep unique)
        merged_ips = list(set([str(ip) for ip in old_ips] + ips))

        # Confidence grows with more data points (caps at 1.0)
        new_confidence = min(1.0, old_confidence + 0.05)

        db.execute(text("""
            UPDATE siem.user_baselines
            SET avg_login_hour = :hour,
                avg_messages_day = :msg,
                avg_emails_day = :email,
                avg_files_day = :files,
                known_ips = :ips,
                confidence = :confidence,
                tx_count = :tx,
                last_updated = :now
            WHERE user_id = :uid
        """), {
            "hour": ema_hour,
            "msg": ema_msg,
            "email": ema_email,
            "files": ema_files,
            "ips": merged_ips,
            "confidence": new_confidence,
            "tx": new_tx,
            "now": datetime.utcnow(),
            "uid": str(user_id),
        })
        updated += 1

    db.commit()
    logger.info(f"Baselines updated for {updated} users")
    return updated
