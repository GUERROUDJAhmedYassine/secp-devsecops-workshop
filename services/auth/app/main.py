"""
SECP — Authentication Service
Port: 8001
"""

from fastapi import FastAPI
from routers import auth, admin

app = FastAPI(title="SECP Auth Service", version="1.0.0")

app.include_router(auth.router)
app.include_router(admin.router)

# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok"}

# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
