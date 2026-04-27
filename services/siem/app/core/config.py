"""
SECP — SIEM Core Configuration
All settings loaded from environment variables.
"""
import os

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/secp",
)

JWT_SECRET    = os.getenv("JWT_SECRET", "dev_secret_change_in_production")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")

# Detection engine tuning knobs
BRUTE_FORCE_THRESHOLD     = int(os.getenv("BRUTE_FORCE_THRESHOLD", "5"))
BRUTE_FORCE_WINDOW_MIN    = int(os.getenv("BRUTE_FORCE_WINDOW_MIN", "5"))

MASS_DOWNLOAD_THRESHOLD   = int(os.getenv("MASS_DOWNLOAD_THRESHOLD", "15"))
MASS_DOWNLOAD_WINDOW_MIN  = int(os.getenv("MASS_DOWNLOAD_WINDOW_MIN", "10"))

IMPOSSIBLE_TRAVEL_MIN_KM  = int(os.getenv("IMPOSSIBLE_TRAVEL_MIN_KM", "500"))
IMPOSSIBLE_TRAVEL_MAX_SEC = int(os.getenv("IMPOSSIBLE_TRAVEL_MAX_SEC", "3600"))

DORMANT_ACCOUNT_DAYS      = int(os.getenv("DORMANT_ACCOUNT_DAYS", "90"))

OFF_HOURS_START           = int(os.getenv("OFF_HOURS_START", "22"))   # 22:00
OFF_HOURS_END             = int(os.getenv("OFF_HOURS_END", "6"))      # 06:00

BEHAVIORAL_STDDEV_FACTOR  = float(os.getenv("BEHAVIORAL_STDDEV_FACTOR", "3.0"))

# WebSocket push
WS_ALERT_PORT             = int(os.getenv("WS_ALERT_PORT", "8006"))

# Detection engine loop interval (seconds)
ENGINE_INTERVAL_SEC       = int(os.getenv("ENGINE_INTERVAL_SEC", "15"))
