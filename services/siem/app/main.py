from datetime import datetime, timezone
import os
import platform
import socket

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()
APP_STARTED_AT = datetime.now(timezone.utc)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"status": "ok"}


def _load_average() -> tuple[float | None, float | None, float | None]:
    try:
        one, five, fifteen = os.getloadavg()
        return round(one, 2), round(five, 2), round(fifteen, 2)
    except (AttributeError, OSError):
        return None, None, None


def _uptime_seconds() -> int:
    return int((datetime.now(timezone.utc) - APP_STARTED_AT).total_seconds())


def _cpu_usage_percent(load_avg_1m: float | None, cpu_cores: int) -> float | None:
    if load_avg_1m is None or cpu_cores <= 0:
        return None
    return round(min(100.0, max(0.0, (load_avg_1m / cpu_cores) * 100.0)), 1)


@app.get("/dashboard/system")
def dashboard_system():
    hostname = socket.gethostname()
    cpu_cores = os.cpu_count() or 0
    load_1m, load_5m, load_15m = _load_average()
    return {
        "status": "ok",
        "service": "siem",
        "hostname": hostname,
        "platform": platform.system(),
        "platform_release": platform.release(),
        "python_version": platform.python_version(),
        "cpu_cores": cpu_cores,
        "cpu_load_1m": load_1m,
        "cpu_load_5m": load_5m,
        "cpu_load_15m": load_15m,
        "cpu_usage_percent": _cpu_usage_percent(load_1m, cpu_cores),
        "server_time": datetime.now(timezone.utc).isoformat(),
        "uptime_seconds": _uptime_seconds(),
    }


@app.get("/dashboard/stats")
def dashboard_stats():
    cpu_cores = os.cpu_count() or 0
    load_1m, _, _ = _load_average()
    cpu_percent = _cpu_usage_percent(load_1m, cpu_cores)
    return {
        "active_alerts": 0,
        "events_monitored": 0,
        "system_cpu": f"{cpu_percent:.1f}%" if cpu_percent is not None else "--",
        "system_memory": "--",
        "service": "siem",
        "hostname": socket.gethostname(),
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8005)
