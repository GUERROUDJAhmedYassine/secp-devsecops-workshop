from fastapi import FastAPI
from contextlib import asynccontextmanager
from core.database import db

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manages application startup and teardown routines."""
    await db.connect()
    yield
    await db.disconnect()

app = FastAPI(lifespan=lifespan)

from websocket.router import router as websocket_router
from rooms.router import router as rooms_router

app.include_router(websocket_router)
app.include_router(rooms_router)


@app.get("/health")
async def health_check() -> dict:
    """Basic service health check."""
    return {"status": "healthy"}

# Explanation: Creates the FastAPI application instance and manages async database pooling lifecycle.
# Security note: Centralized lifecycle avoids stale or unprotected database connections on startup and shutdown.
