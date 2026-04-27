"""
═══════════════════════════════════════════════════════════════════════
 SECP SIEM — ATTACK DEMO 1: Brute Force + Credential Stuffing
═══════════════════════════════════════════════════════════════════════

 This script simulates a brute-force attack against the auth service.
 It generates rapid failed login attempts from multiple IPs, followed
 by a dormant account login and off-hours access — all of which should
 trigger SIEM alerts R1 (Brute Force), R5 (Dormant), R6 (Off-Hours).

 Usage:
   python demo_brute_force.py [--host http://localhost:8001]

 Expected SIEM alerts:
   • BRUTE_FORCE      — 10+ failed logins within 5 minutes
   • OFF_HOURS_ACCESS — login at 03:00 (simulated via raw event)
   • DORMANT_ACCOUNT  — login from inactive account
═══════════════════════════════════════════════════════════════════════
"""
import argparse
import json
import time
import requests
from datetime import datetime, timedelta
import random
import uuid

SPOOFED_IPS = [
    "185.220.101.34",   # Known Tor exit node range
    "103.234.220.195",  # Southeast Asia VPN
    "45.155.205.99",    # Eastern Europe datacenter
    "198.51.100.42",    # Documentation range (simulated)
    "192.0.2.100",      # Test range
]

USERNAMES_WORDLIST = [
    "admin", "administrator", "root", "sysadmin", "it_admin",
    "user", "test", "guest", "backup", "service",
]

PASSWORDS_WORDLIST = [
    "password", "123456", "admin123", "letmein", "welcome",
    "Password1!", "Qwerty123!", "Admin@2024", "changeme", "test1234",
]


def banner(text: str):
    width = 60
    print(f"\n{'═' * width}")
    print(f"  {text}")
    print(f"{'═' * width}\n")


def phase_1_brute_force(auth_url: str):
    """Phase 1: Rapid credential stuffing against /auth/login."""
    banner("PHASE 1 — BRUTE FORCE ATTACK")
    print(f"  Target: {auth_url}/auth/login")
    print(f"  Attempts: {len(USERNAMES_WORDLIST) * 2} combinations")
    print(f"  Spoofed IPs: {len(SPOOFED_IPS)} sources\n")

    successes = 0
    failures = 0

    for username in USERNAMES_WORDLIST:
        for password in random.sample(PASSWORDS_WORDLIST, 2):
            ip = random.choice(SPOOFED_IPS)
            print(f"  [{datetime.utcnow().strftime('%H:%M:%S')}] "
                  f"LOGIN {username}:{password[:6]}*** from {ip}", end=" ")

            try:
                resp = requests.post(
                    f"{auth_url}/auth/login",
                    json={"username": username, "password": password},
                    headers={"X-Forwarded-For": ip},
                    timeout=5,
                )

                if resp.status_code == 200:
                    print("→ ✓ SUCCESS (credential found!)")
                    successes += 1
                else:
                    detail = resp.json().get("detail", "unknown")
                    print(f"→ ✗ {resp.status_code} ({detail})")
                    failures += 1

            except requests.exceptions.ConnectionError:
                print("→ ✗ CONNECTION REFUSED")
                failures += 1

            time.sleep(0.2)  # Rapid but not instant

    print(f"\n  Results: {failures} failures, {successes} successes")
    print(f"  → SIEM should trigger R1 (BRUTE_FORCE) alert")


def phase_2_inject_offhours(siem_url: str):
    """Phase 2: Inject an off-hours login event directly via SIEM ingest."""
    banner("PHASE 2 — OFF-HOURS ACCESS (SIMULATED)")
    print(f"  Injecting LOGIN_SUCCESS event at 03:00 AM")

    # We inject the event directly since we can't control server time
    try:
        resp = requests.post(
            f"{siem_url}/ingest",
            json={
                "event_type": "LOGIN_SUCCESS",
                "severity": "INFO",
                "service": "auth",
                "user_id": None,  # Will use first available user
                "source_ip": "10.0.0.50",
                "payload": {"method": "password", "simulated_hour": 3, "demo": True},
            },
            timeout=5,
        )
        if resp.status_code == 201:
            print("  → Event injected successfully")
            print("  → SIEM should trigger R6 (OFF_HOURS_ACCESS) alert")
        else:
            print(f"  → Failed: {resp.status_code}")
    except Exception as e:
        print(f"  → Error: {e}")


def phase_3_impossible_travel(siem_url: str):
    """Phase 3: Simulate impossible travel by injecting logins from distant IPs."""
    banner("PHASE 3 — IMPOSSIBLE TRAVEL (SIMULATED)")

    fake_user_id = str(uuid.uuid4())
    locations = [
        ("192.168.1.100", "New York, US"),
        ("103.234.220.195", "Jakarta, Indonesia"),
    ]

    print(f"  Simulated user: {fake_user_id[:8]}...")
    for ip, location in locations:
        print(f"  Injecting login from {ip} ({location})")
        try:
            requests.post(
                f"{siem_url}/ingest",
                json={
                    "event_type": "LOGIN_SUCCESS",
                    "severity": "INFO",
                    "service": "auth",
                    "user_id": fake_user_id,
                    "source_ip": ip,
                    "payload": {"location": location, "demo": True},
                },
                timeout=5,
            )
        except Exception:
            pass
        time.sleep(1)

    print("  → SIEM should trigger R3 (IMPOSSIBLE_TRAVEL) alert")


def main():
    parser = argparse.ArgumentParser(description="SIEM Attack Demo: Brute Force")
    parser.add_argument("--auth-host", default="http://localhost:8001", help="Auth service URL")
    parser.add_argument("--siem-host", default="http://localhost:8005", help="SIEM service URL")
    args = parser.parse_args()

    banner("SECP SIEM — ATTACK SIMULATION DEMO 1")
    print(f"  Auth target: {args.auth_host}")
    print(f"  SIEM target: {args.siem_host}")
    print(f"  Time: {datetime.utcnow().isoformat()}")

    phase_1_brute_force(args.auth_host)
    time.sleep(2)

    phase_2_inject_offhours(args.siem_host)
    time.sleep(2)

    phase_3_impossible_travel(args.siem_host)

    banner("DEMO COMPLETE")
    print("  Open the SIEM dashboard at http://localhost:3000/admin/monitor")
    print("  Expected alerts:")
    print("    • R1  BRUTE_FORCE       — HIGH")
    print("    • R3  IMPOSSIBLE_TRAVEL — CRITICAL")
    print("    • R6  OFF_HOURS_ACCESS  — MEDIUM")
    print()


if __name__ == "__main__":
    main()
