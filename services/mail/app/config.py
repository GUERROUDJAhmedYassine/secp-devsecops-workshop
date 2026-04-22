"""
Mail Service — Configuration
All settings loaded from environment variables.
"""
import os

# ── Database (defaults aligned with Auth Service for local runs without .env) ─
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/secp",
)

# ── JWT — must match Auth Service env (same secret / algorithm) ───────────────
JWT_SECRET    = os.getenv("JWT_SECRET", "dev_secret_change_in_production")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")

# ── Mail ─────────────────────────────────────────
MAILHOG_HOST = os.getenv("MAILHOG_HOST", "mailhog")
MAILHOG_PORT = int(os.getenv("MAILHOG_PORT", "1025"))
MAIL_UPLOAD_DIR = os.getenv("MAIL_UPLOAD_DIR", "/app/uploads/email_attachments")
# Auth bootstrap uses @secp.com; report uses @company.dz — allow both unless overridden
_raw_domains = os.getenv("ALLOWED_EMAIL_DOMAINS", "company.dz,secp.com")
ALLOWED_DOMAINS = [d.strip().lower() for d in _raw_domains.split(",") if d.strip()]

# ── Limits ───────────────────────────────────────
MAX_ATTACHMENT_SIZE  = 10 * 1024 * 1024   # 10 MB
MASS_EMAIL_THRESHOLD = 20                  # emails in 10 minutes = SIEM alert
