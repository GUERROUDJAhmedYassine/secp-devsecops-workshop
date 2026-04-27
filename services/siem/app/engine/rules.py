"""
SIEM Detection Engine — 8 Rules
Runs on a periodic loop, scanning siem.events for threat patterns
and generating siem.alerts when thresholds are breached.

Rules:
  R1  Brute Force           — N failed logins in M minutes
  R2  Mass Download         — N file downloads in M minutes
  R3  Impossible Travel     — Login from distant IP within impossible time
  R4  VPN Cert Reuse        — Same VPN public key used by multiple users
  R5  Dormant Account       — Login from account inactive for N days
  R6  Off-Hours Access      — Login outside business hours
  R7  External Relay        — Attempt to send email outside allowed domains
  R8  Behavioral Anomaly    — Activity deviating > N stddev from baseline
"""
import logging
import json
import uuid
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import text, func

from core.config import (
    BRUTE_FORCE_THRESHOLD, BRUTE_FORCE_WINDOW_MIN,
    MASS_DOWNLOAD_THRESHOLD, MASS_DOWNLOAD_WINDOW_MIN,
    IMPOSSIBLE_TRAVEL_MAX_SEC,
    DORMANT_ACCOUNT_DAYS,
    OFF_HOURS_START, OFF_HOURS_END,
    BEHAVIORAL_STDDEV_FACTOR,
)
from core.models import Alert

logger = logging.getLogger(__name__)


def run_all_rules(db: Session) -> list[dict]:
    """Execute every detection rule. Returns list of new alert dicts for WS push."""
    new_alerts = []

    for rule_fn in [
        rule_brute_force,
        rule_mass_download,
        rule_impossible_travel,
        rule_vpn_cert_reuse,
        rule_dormant_account,
        rule_off_hours_access,
        rule_external_relay,
        rule_behavioral_anomaly,
    ]:
        try:
            alerts = rule_fn(db)
            new_alerts.extend(alerts)
        except Exception as e:
            db.rollback()
            logger.error(f"Detection rule {rule_fn.__name__} failed: {e}")

    return new_alerts


def _create_alert(
    db: Session,
    alert_type: str,
    severity: str,
    user_id,
    description: str,
    evidence: dict,
) -> dict:
    """Insert an alert and return its serialized dict for WS push."""
    alert = Alert(
        id=uuid.uuid4(),
        alert_type=alert_type,
        severity=severity,
        user_id=user_id,
        description=description,
        evidence=evidence,
        status="OPEN",
        created_at=datetime.utcnow(),
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)

    # Resolve username
    row = db.execute(
        text("SELECT username FROM app.users WHERE id = :uid"),
        {"uid": str(user_id)},
    ).fetchone()
    username = row[0] if row else None

    return {
        "id": str(alert.id),
        "alert_type": alert.alert_type,
        "severity": alert.severity,
        "user_id": str(alert.user_id),
        "username": username,
        "description": alert.description,
        "evidence": alert.evidence,
        "status": alert.status,
        "created_at": alert.created_at.isoformat(),
        "resolved_at": None,
    }


def _already_alerted(db: Session, alert_type: str, user_id, window_minutes: int = 30) -> bool:
    """Check if we already fired this alert for this user recently (dedup)."""
    cutoff = datetime.utcnow() - timedelta(minutes=window_minutes)
    count = db.query(Alert).filter(
        Alert.alert_type == alert_type,
        Alert.user_id == user_id,
        Alert.created_at >= cutoff,
    ).count()
    return count > 0


# ─── R1: Brute Force ─────────────────────────────────────────────────────────

def rule_brute_force(db: Session) -> list[dict]:
    """
    Detect brute-force attacks on two independent axes:

    ARM A — per user_id: same account targeted ≥ N times (catches
            distributed spraying from many IPs against one account).

    ARM B — per source_ip: one IP causes ≥ N failures across ANY
            accounts (catches Docker / NAT scenarios where all traffic
            shares the same source IP and ARM A never fires because
            each individual account hasn't hit the threshold yet).

    Both arms use the same threshold and window. A candidate user_id
    is only alerted once per dedup window regardless of which arm
    triggered it.
    """
    cutoff = datetime.utcnow() - timedelta(minutes=BRUTE_FORCE_WINDOW_MIN)

    # ── ARM A: group by user_id ──────────────────────────────────────────────
    # Fires when the same account accumulates ≥ threshold failures.
    # user_id must be non-null (known account is being targeted).
    by_user = db.execute(text("""
        SELECT user_id,
               COUNT(*)                            AS cnt,
               ARRAY_AGG(DISTINCT source_ip::text) AS ips,
               'user_id'                           AS axis
        FROM siem.events
        WHERE event_type = 'LOGIN_FAILURE'
          AND created_at >= :cutoff
          AND user_id IS NOT NULL
        GROUP BY user_id
        HAVING COUNT(*) >= :threshold
    """), {"cutoff": cutoff, "threshold": BRUTE_FORCE_THRESHOLD}).fetchall()

    # ── ARM B: group by source_ip ────────────────────────────────────────────
    # Fires when a single IP causes ≥ threshold failures against ANY accounts.
    # This covers Docker (all containers share one host IP), corporate NAT,
    # or credential-stuffing tools cycling through many usernames.
    # We collect every distinct victim user_id so we can raise an alert
    # for each account that was targeted from that IP.
    by_ip = db.execute(text("""
        SELECT source_ip::text                     AS ip,
               COUNT(*)                            AS cnt,
               ARRAY_AGG(DISTINCT user_id::text)   AS victim_ids
        FROM siem.events
        WHERE event_type = 'LOGIN_FAILURE'
          AND created_at >= :cutoff
          AND source_ip IS NOT NULL
        GROUP BY source_ip
        HAVING COUNT(*) >= :threshold
    """), {"cutoff": cutoff, "threshold": BRUTE_FORCE_THRESHOLD}).fetchall()

    # ── Merge both arms into a single dict keyed by user_id ─────────────────
    # Key: str(user_id)  →  {"user_id", "count", "ips", "axis", "attacker_ip"}
    candidates: dict[str, dict] = {}

    for row in by_user:
        uid = str(row[0])
        candidates[uid] = {
            "user_id":     row[0],
            "count":       row[1],
            "ips":         row[2] or [],
            "axis":        "per_account",
            "attacker_ip": None,
        }

    for row in by_ip:
        attacker_ip  = row[0]
        total_count  = row[1]
        victim_ids   = [v for v in (row[2] or []) if v]  # filter out None

        if not victim_ids:
            # Failures against unknown/unenrolled usernames — alert with a
            # sentinel user_id so we don't lose the signal.  We pick the
            # first available active user as the alert "owner" for FK reasons,
            # but the evidence carries the full attacker IP.
            sentinel = db.execute(
                text("SELECT id FROM app.users WHERE is_active = true LIMIT 1")
            ).fetchone()
            if sentinel:
                uid = str(sentinel[0])
                if uid not in candidates:
                    candidates[uid] = {
                        "user_id":     sentinel[0],
                        "count":       total_count,
                        "ips":         [attacker_ip],
                        "axis":        "per_ip_unknown_accounts",
                        "attacker_ip": attacker_ip,
                    }
        else:
            for uid in victim_ids:
                if uid not in candidates:
                    candidates[uid] = {
                        "user_id":     uid,
                        "count":       total_count,
                        "ips":         [attacker_ip],
                        "axis":        "per_ip",
                        "attacker_ip": attacker_ip,
                    }
                # If already present from ARM A, annotate with the attacker IP
                # but don't overwrite the richer ARM A data.
                elif candidates[uid]["attacker_ip"] is None:
                    candidates[uid]["attacker_ip"] = attacker_ip

    # ── Raise one alert per unique victim, skip dedup-suppressed ones ────────
    alerts = []
    for uid, data in candidates.items():
        if _already_alerted(db, "BRUTE_FORCE", data["user_id"]):
            continue

        axis_label = {
            "per_account":             "same account targeted",
            "per_ip":                  "same source IP targeting multiple accounts",
            "per_ip_unknown_accounts": "source IP targeting unknown accounts",
        }.get(data["axis"], data["axis"])

        description = (
            f"Brute force detected ({axis_label}): "
            f"{data['count']} failed login attempts in {BRUTE_FORCE_WINDOW_MIN} minutes"
        )

        evidence = {
            "failed_count":    data["count"],
            "source_ips":      data["ips"],
            "attacker_ip":     data["attacker_ip"],
            "detection_axis":  data["axis"],
            "window_minutes":  BRUTE_FORCE_WINDOW_MIN,
        }

        alerts.append(_create_alert(
            db,
            alert_type="BRUTE_FORCE",
            severity="HIGH",
            user_id=data["user_id"],
            description=description,
            evidence=evidence,
        ))

    return alerts


# ─── R2: Mass Download ───────────────────────────────────────────────────────

def rule_mass_download(db: Session) -> list[dict]:
    """Detect >= N file operations in M minutes, grouped by user_id.
    Events without a user_id (demo scripts, service-level emits) are
    attributed to a sentinel active user so the signal is never lost.
    """
    cutoff = datetime.utcnow() - timedelta(minutes=MASS_DOWNLOAD_WINDOW_MIN)

    rows = db.execute(text("""
        SELECT user_id, COUNT(*) as cnt
        FROM siem.events
        WHERE event_type IN ('FILE_DOWNLOAD', 'FILE_UPLOADED')
          AND created_at >= :cutoff
        GROUP BY user_id
        HAVING COUNT(*) >= :threshold
    """), {"cutoff": cutoff, "threshold": MASS_DOWNLOAD_THRESHOLD}).fetchall()

    alerts = []
    for row in rows:
        user_id, count = row[0], row[1]
        # Resolve null user_id to a sentinel active user
        if not user_id:
            sentinel = db.execute(
                text("SELECT id FROM app.users WHERE is_active = true LIMIT 1")
            ).fetchone()
            if not sentinel:
                continue
            user_id = sentinel[0]
        if _already_alerted(db, "MASS_DOWNLOAD", user_id):
            continue
        alerts.append(_create_alert(
            db,
            alert_type="MASS_DOWNLOAD",
            severity="HIGH",
            user_id=user_id,
            description=f"Mass file exfiltration: {count} file operations in {MASS_DOWNLOAD_WINDOW_MIN} minutes",
            evidence={"file_count": count, "window_minutes": MASS_DOWNLOAD_WINDOW_MIN},
        ))
    return alerts


# ─── R3: Impossible Travel ───────────────────────────────────────────────────

def rule_impossible_travel(db: Session) -> list[dict]:
    """Detect logins from different IPs within a time window too short for physical travel."""
    cutoff = datetime.utcnow() - timedelta(seconds=IMPOSSIBLE_TRAVEL_MAX_SEC)

    rows = db.execute(text("""
        SELECT user_id,
               ARRAY_AGG(DISTINCT source_ip::text) as ips,
               MIN(created_at) as first_login,
               MAX(created_at) as last_login
        FROM siem.events
        WHERE event_type = 'LOGIN_SUCCESS'
          AND created_at >= :cutoff
          AND source_ip IS NOT NULL
          AND user_id IS NOT NULL
        GROUP BY user_id
        HAVING COUNT(DISTINCT source_ip) >= 2
    """), {"cutoff": cutoff}).fetchall()

    alerts = []
    for row in rows:
        user_id, ips, first_login, last_login = row[0], row[1], row[2], row[3]
        if _already_alerted(db, "IMPOSSIBLE_TRAVEL", user_id, window_minutes=60):
            continue
        time_diff = (last_login - first_login).total_seconds()
        alerts.append(_create_alert(
            db,
            alert_type="IMPOSSIBLE_TRAVEL",
            severity="CRITICAL",
            user_id=user_id,
            description=f"Impossible travel: logins from {len(ips)} different IPs within {int(time_diff)}s",
            evidence={"source_ips": ips, "time_diff_seconds": int(time_diff), "first_login": first_login.isoformat(), "last_login": last_login.isoformat()},
        ))
    return alerts


# ─── R4: VPN Cert Reuse ──────────────────────────────────────────────────────

def rule_vpn_cert_reuse(db: Session) -> list[dict]:
    """Detect the same VPN public key being used by multiple user accounts."""
    rows = db.execute(text("""
        SELECT vpn_public_key, ARRAY_AGG(id::text) as user_ids, COUNT(*) as cnt
        FROM app.users
        WHERE vpn_public_key IS NOT NULL
          AND vpn_public_key != ''
          AND is_active = true
        GROUP BY vpn_public_key
        HAVING COUNT(*) > 1
    """)).fetchall()

    alerts = []
    for row in rows:
        vpn_key, user_ids, count = row[0], row[1], row[2]
        # Alert against the first user ID
        primary_user = user_ids[0]
        if _already_alerted(db, "VPN_CERT_REUSE", primary_user, window_minutes=1440):
            continue
        alerts.append(_create_alert(
            db,
            alert_type="VPN_CERT_REUSE",
            severity="HIGH",
            user_id=primary_user,
            description=f"VPN certificate reuse: same key shared by {count} accounts",
            evidence={"shared_users": user_ids, "user_count": count, "key_prefix": vpn_key[:20] + "..." if len(vpn_key) > 20 else vpn_key},
        ))
    return alerts


# ─── R5: Dormant Account ─────────────────────────────────────────────────────

def rule_dormant_account(db: Session) -> list[dict]:
    """Detect logins from accounts that haven't been active for N days."""
    cutoff = datetime.utcnow() - timedelta(minutes=5)  # recent logins
    dormant_date = datetime.utcnow() - timedelta(days=DORMANT_ACCOUNT_DAYS)

    rows = db.execute(text("""
        SELECT e.user_id, u.username, u.last_login_at, e.source_ip::text
        FROM siem.events e
        JOIN app.users u ON u.id = e.user_id
        WHERE e.event_type = 'LOGIN_SUCCESS'
          AND e.created_at >= :cutoff
          AND (u.last_login_at IS NULL OR u.last_login_at <= :dormant_date)
    """), {"cutoff": cutoff, "dormant_date": dormant_date}).fetchall()

    alerts = []
    for row in rows:
        user_id, username, last_login, source_ip = row[0], row[1], row[2], row[3]
        if _already_alerted(db, "DORMANT_ACCOUNT", user_id, window_minutes=1440):
            continue
        days_dormant = (datetime.utcnow() - last_login).days if last_login else "never"
        alerts.append(_create_alert(
            db,
            alert_type="DORMANT_ACCOUNT",
            severity="MEDIUM",
            user_id=user_id,
            description=f"Dormant account login: {username} was inactive for {days_dormant} days",
            evidence={"username": username, "last_login": last_login.isoformat() if last_login else None, "days_dormant": days_dormant, "source_ip": source_ip},
        ))
    return alerts


# ─── R6: Off-Hours Access ────────────────────────────────────────────────────

def rule_off_hours_access(db: Session) -> list[dict]:
    """Detect logins outside business hours."""
    cutoff = datetime.utcnow() - timedelta(minutes=5)

    # Off-hours: either hour >= OFF_HOURS_START or hour < OFF_HOURS_END
    rows = db.execute(text("""
        SELECT e.user_id, e.source_ip::text, e.created_at,
               EXTRACT(HOUR FROM e.created_at) as login_hour
        FROM siem.events e
        WHERE e.event_type = 'LOGIN_SUCCESS'
          AND e.created_at >= :cutoff
          AND e.user_id IS NOT NULL
          AND (EXTRACT(HOUR FROM e.created_at) >= :start_hour
               OR EXTRACT(HOUR FROM e.created_at) < :end_hour)
    """), {"cutoff": cutoff, "start_hour": OFF_HOURS_START, "end_hour": OFF_HOURS_END}).fetchall()

    alerts = []
    for row in rows:
        user_id, source_ip, created_at, login_hour = row[0], row[1], row[2], row[3]
        if _already_alerted(db, "OFF_HOURS_ACCESS", user_id):
            continue
        alerts.append(_create_alert(
            db,
            alert_type="OFF_HOURS_ACCESS",
            severity="MEDIUM",
            user_id=user_id,
            description=f"Off-hours login detected at {int(login_hour):02d}:00 (policy: {OFF_HOURS_END:02d}:00-{OFF_HOURS_START:02d}:00)",
            evidence={"login_hour": int(login_hour), "source_ip": source_ip, "timestamp": created_at.isoformat()},
        ))
    return alerts


# ─── R7: External Relay ──────────────────────────────────────────────────────

def rule_external_relay(db: Session) -> list[dict]:
    """Detect attempts to relay email to external addresses.
    Events without a user_id (demo scripts, mail service emits without
    an authenticated session) are attributed to a sentinel active user.
    """
    cutoff = datetime.utcnow() - timedelta(minutes=5)

    rows = db.execute(text("""
        SELECT user_id, COUNT(*) as cnt,
               ARRAY_AGG(payload->>'attempted_recipient') as targets
        FROM siem.events
        WHERE event_type = 'EXTERNAL_RELAY_ATTEMPT'
          AND created_at >= :cutoff
        GROUP BY user_id
    """), {"cutoff": cutoff}).fetchall()

    alerts = []
    for row in rows:
        user_id, count, targets = row[0], row[1], row[2]
        # Resolve null user_id to a sentinel active user
        if not user_id:
            sentinel = db.execute(
                text("SELECT id FROM app.users WHERE is_active = true LIMIT 1")
            ).fetchone()
            if not sentinel:
                continue
            user_id = sentinel[0]
        if _already_alerted(db, "EXTERNAL_RELAY", user_id):
            continue
        alerts.append(_create_alert(
            db,
            alert_type="EXTERNAL_RELAY",
            severity="HIGH",
            user_id=user_id,
            description=f"External email relay attempt: {count} blocked outbound emails",
            evidence={"attempt_count": count, "targets": targets or []},
        ))
    return alerts


# ─── R8: Behavioral Anomaly ──────────────────────────────────────────────────

def rule_behavioral_anomaly(db: Session) -> list[dict]:
    """Detect activity that deviates significantly from user baseline."""
    cutoff = datetime.utcnow() - timedelta(hours=1)

    # Get baselines with enough confidence
    baselines = db.execute(text("""
        SELECT user_id, avg_messages_day, avg_emails_day, avg_files_day, confidence
        FROM siem.user_baselines
        WHERE confidence >= 0.3
    """)).fetchall()

    alerts = []
    for baseline in baselines:
        user_id = baseline[0]
        avg_msg = float(baseline[1] or 0)
        avg_email = float(baseline[2] or 0)
        avg_files = float(baseline[3] or 0)
        confidence = float(baseline[4] or 0)

        # Count recent activity (last hour, scaled to daily rate)
        activity = db.execute(text("""
            SELECT
                COALESCE(SUM(CASE WHEN event_type = 'MESSAGE_SENT' THEN 1 ELSE 0 END), 0) as msgs,
                COALESCE(SUM(CASE WHEN event_type = 'EMAIL_SENT' THEN 1 ELSE 0 END), 0) as emails,
                COALESCE(SUM(CASE WHEN event_type IN ('FILE_DOWNLOAD', 'FILE_UPLOADED') THEN 1 ELSE 0 END), 0) as files
            FROM siem.events
            WHERE user_id = :uid AND created_at >= :cutoff
        """), {"uid": str(user_id), "cutoff": cutoff}).fetchone()

        msgs, emails, files = activity[0], activity[1], activity[2]

        # Scale hourly count to equivalent daily rate
        msgs_daily = msgs * 24
        emails_daily = emails * 24
        files_daily = files * 24

        anomalies = []
        threshold = BEHAVIORAL_STDDEV_FACTOR

        if avg_msg > 0 and msgs_daily > avg_msg * threshold:
            anomalies.append(f"messages: {msgs}/hr (baseline: {avg_msg:.0f}/day)")
        if avg_email > 0 and emails_daily > avg_email * threshold:
            anomalies.append(f"emails: {emails}/hr (baseline: {avg_email:.0f}/day)")
        if avg_files > 0 and files_daily > avg_files * threshold:
            anomalies.append(f"files: {files}/hr (baseline: {avg_files:.0f}/day)")

        if anomalies and not _already_alerted(db, "BEHAVIORAL_ANOMALY", user_id, window_minutes=60):
            alerts.append(_create_alert(
                db,
                alert_type="BEHAVIORAL_ANOMALY",
                severity="HIGH",
                user_id=user_id,
                description=f"Behavioral anomaly detected: {', '.join(anomalies)}",
                evidence={
                    "anomalies": anomalies,
                    "hourly_counts": {"messages": msgs, "emails": emails, "files": files},
                    "baselines": {"avg_messages_day": avg_msg, "avg_emails_day": avg_email, "avg_files_day": avg_files},
                    "confidence": confidence,
                },
            ))

    return alerts
