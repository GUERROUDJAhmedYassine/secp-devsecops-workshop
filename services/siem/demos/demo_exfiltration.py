"""
═══════════════════════════════════════════════════════════════════════
 SECP SIEM — ATTACK DEMO 2: Data Exfiltration + External Relay
═══════════════════════════════════════════════════════════════════════

 This script simulates a data exfiltration scenario:
   1. Attacker authenticates with stolen credentials
   2. Rapid mass file downloads (triggers R2)
   3. Attempts to relay emails to external addresses (triggers R7)
   4. Generates behavioral anomaly via burst activity (triggers R8)

 Usage:
   python demo_exfiltration.py [--host http://localhost]

 Prerequisites:
   Run first:  python demo_brute_force.py
   Requires a valid user account. Uses the admin account created
   by create_superuser.py (admin / AdminPass123!)

 Expected SIEM alerts:
   • MASS_DOWNLOAD     — 15+ file operations in 10 minutes
   • EXTERNAL_RELAY    — outbound email to external domain
   • BEHAVIORAL_ANOMALY — activity spike vs baseline
   • MASS_EMAIL_BURST  — rapid email sending
═══════════════════════════════════════════════════════════════════════
"""
import argparse
import json
import time
import requests
from datetime import datetime
import random
import string


def banner(text: str):
    width = 60
    print(f"\n{'═' * width}")
    print(f"  {text}")
    print(f"{'═' * width}\n")


def get_token(auth_url: str, username: str, password: str) -> str | None:
    """Authenticate and return access token."""
    try:
        resp = requests.post(
            f"{auth_url}/auth/login",
            json={"username": username, "password": password},
            timeout=5,
        )
        if resp.status_code == 200:
            return resp.json().get("access_token")
        print(f"  Auth failed: {resp.status_code} — {resp.json().get('detail', 'unknown')}")
        return None
    except Exception as e:
        print(f"  Auth error: {e}")
        return None


def phase_1_authenticate(auth_url: str):
    """Phase 1: Attacker authenticates with known credentials."""
    banner("PHASE 1 — ATTACKER AUTHENTICATION")

    creds = [
        ("admin", "AdminPass123!"),
        ("admin", "Admin@secp2024!"),
    ]

    for username, password in creds:
        print(f"  Trying {username} / {password[:6]}***")
        token = get_token(auth_url, username, password)
        if token:
            print(f"  → ✓ Authentication successful!")
            print(f"  → Token: {token[:30]}...")
            return token
        time.sleep(0.5)

    print("  → ✗ Could not authenticate. Falling back to event injection.")
    return None


def phase_2_mass_download(siem_url: str, token: str | None):
    """Phase 2: Simulate mass file downloads to trigger R2."""
    banner("PHASE 2 — MASS FILE DOWNLOAD (DATA EXFILTRATION)")

    headers = {"Authorization": f"Bearer {token}"} if token else {}
    fake_files = [
        "employee_records_2024.xlsx",
        "salary_database_full.csv",
        "vpn_certificates_backup.tar.gz",
        "password_policy_internal.pdf",
        "network_topology_diagram.vsdx",
        "customer_database_export.sql",
        "financial_reports_Q4.pdf",
        "security_audit_findings.docx",
        "admin_credentials_list.txt",
        "source_code_backup.zip",
        "encryption_keys_backup.pem",
        "incident_response_playbook.pdf",
        "board_meeting_minutes.docx",
        "merger_documents_confidential.pdf",
        "infrastructure_access_matrix.xlsx",
        "cloud_api_keys.json",
        "database_dump_production.sql",
        "hr_termination_list.csv",
    ]

    print(f"  Downloading {len(fake_files)} sensitive files...\n")

    for i, filename in enumerate(fake_files, 1):
        size = random.randint(50_000, 50_000_000)
        print(f"  [{i:02d}/{len(fake_files)}] ↓ {filename} ({size/1024/1024:.1f} MB)", end=" ")

        # Inject event directly
        try:
            requests.post(
                f"{siem_url}/ingest",
                json={
                    "event_type": "FILE_DOWNLOAD",
                    "severity": "INFO",
                    "service": "files",
                    "source_ip": "10.8.0.50",
                    "payload": {
                        "filename": filename,
                        "size_bytes": size,
                        "demo": True,
                    },
                },
                timeout=5,
            )
            print("→ ✓")
        except Exception:
            print("→ ✗")
        time.sleep(0.3)

    print(f"\n  → SIEM should trigger R2 (MASS_DOWNLOAD) alert")


def phase_3_external_relay(siem_url: str, mail_url: str, token: str | None):
    """Phase 3: Attempt to exfiltrate data via external email relay."""
    banner("PHASE 3 — EXTERNAL EMAIL RELAY ATTEMPT")

    external_targets = [
        "hacker@darkweb.onion",
        "data-buyer@competitor.com",
        "whistleblower@protonmail.com",
        "leak@external-drop.net",
    ]

    print(f"  Attempting to relay to {len(external_targets)} external addresses...\n")

    for target in external_targets:
        print(f"  ✉ Sending to {target}", end=" ")

        # Try the actual mail endpoint first
        if token:
            try:
                resp = requests.post(
                    f"{mail_url}/mail/send",
                    data={
                        "to": target,
                        "subject": "Confidential Data Export",
                        "body": "See attached employee records and credentials.",
                    },
                    headers={"Authorization": f"Bearer {token}"},
                    timeout=5,
                )
                if resp.status_code == 403:
                    print(f"→ BLOCKED (403: external relay denied)")
                else:
                    print(f"→ {resp.status_code}")
            except Exception:
                print("→ connection error")
        else:
            # Inject the event directly
            try:
                requests.post(
                    f"{siem_url}/ingest",
                    json={
                        "event_type": "EXTERNAL_RELAY_ATTEMPT",
                        "severity": "HIGH",
                        "service": "mail",
                        "source_ip": "10.8.0.50",
                        "payload": {
                            "attempted_recipient": target,
                            "demo": True,
                        },
                    },
                    timeout=5,
                )
                print("→ BLOCKED (injected to SIEM)")
            except Exception:
                print("→ error")
        time.sleep(0.5)

    print(f"\n  → SIEM should trigger R7 (EXTERNAL_RELAY) alert")


def phase_4_behavioral_anomaly(siem_url: str):
    """Phase 4: Generate burst activity to exceed behavioral baseline."""
    banner("PHASE 4 — BEHAVIORAL ANOMALY (ACTIVITY SPIKE)")

    print("  Generating burst of messages and emails...\n")

    event_types = ["MESSAGE_SENT", "EMAIL_SENT", "FILE_UPLOADED"]

    for i in range(30):
        event_type = random.choice(event_types)
        print(f"  [{i+1:02d}/30] Simulating {event_type}", end=" ")

        try:
            requests.post(
                f"{siem_url}/ingest",
                json={
                    "event_type": event_type,
                    "severity": "INFO",
                    "service": random.choice(["messaging", "mail", "files"]),
                    "source_ip": "10.8.0.50",
                    "payload": {
                        "content_length": random.randint(10, 5000),
                        "demo": True,
                    },
                },
                timeout=5,
            )
            print("→ ✓")
        except Exception:
            print("→ ✗")
        time.sleep(0.1)

    print(f"\n  → SIEM should trigger R8 (BEHAVIORAL_ANOMALY) alert")


def main():
    parser = argparse.ArgumentParser(description="SIEM Attack Demo: Data Exfiltration")
    parser.add_argument("--auth-host", default="http://localhost:8001", help="Auth service URL")
    parser.add_argument("--mail-host", default="http://localhost:8002", help="Mail service URL")
    parser.add_argument("--siem-host", default="http://localhost:8005", help="SIEM service URL")
    args = parser.parse_args()

    banner("SECP SIEM — ATTACK SIMULATION DEMO 2")
    print(f"  Auth target: {args.auth_host}")
    print(f"  Mail target: {args.mail_host}")
    print(f"  SIEM target: {args.siem_host}")
    print(f"  Time: {datetime.utcnow().isoformat()}")

    token = phase_1_authenticate(args.auth_host)
    time.sleep(1)

    phase_2_mass_download(args.siem_host, token)
    time.sleep(2)

    phase_3_external_relay(args.siem_host, args.mail_host, token)
    time.sleep(2)

    phase_4_behavioral_anomaly(args.siem_host)

    banner("DEMO COMPLETE")
    print("  Open the SIEM dashboard at http://localhost:3000/admin/monitor")
    print("  Expected alerts:")
    print("    • R2  MASS_DOWNLOAD      — HIGH")
    print("    • R7  EXTERNAL_RELAY     — HIGH")
    print("    • R8  BEHAVIORAL_ANOMALY — HIGH")
    print()


if __name__ == "__main__":
    main()
