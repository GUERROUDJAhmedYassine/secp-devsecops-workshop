import os
import re
from datetime import datetime
from pathlib import Path


def env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"Missing required env var: {name}")
    return value


def now_utc() -> datetime:
    # Keep timestamp naive for compatibility with existing DB schema.
    return datetime.utcnow()


def sanitize_filename(name: str) -> str:
    safe_name = name.strip().replace("\\", "_").replace("/", "_")
    safe_name = re.sub(r"[^A-Za-z0-9._ -]+", "_", safe_name)
    safe_name = re.sub(r"\s+", " ", safe_name).strip()
    return safe_name[:200] if safe_name else "file"


def uploads_root() -> Path:
    return Path(os.getenv("UPLOADS_ROOT", "/app/uploads")).resolve()
