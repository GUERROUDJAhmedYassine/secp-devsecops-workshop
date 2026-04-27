"""
SECP — SIEM Service
Port 8005 (REST API) + Port 8006 (WebSocket push — separate process)

Detection engine, alert management, event log, and behavioral baselines.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers.events import router as events_router
from routers.alerts import router as alerts_router
from routers.baselines import router as baselines_router
from routers.ingest import router as ingest_router

app = FastAPI(title="SECP SIEM Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(events_router)
app.include_router(alerts_router)
app.include_router(baselines_router)
app.include_router(ingest_router)


@app.get("/health")
def health():
    return {"status": "ok", "service": "siem", "port": 8005}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8005, reload=True)