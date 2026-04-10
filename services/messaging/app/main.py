from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from core.database import db


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manages application startup and teardown routines."""
    await db.connect()
    yield
    await db.disconnect()


app = FastAPI(
    title="SECP Messaging Service",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    # dev-friendly: allow local Vite + containerized frontend
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from rooms.router import router as rooms_router
from websocket.router import router as websocket_router
from messages.router import router as messages_router
from presence.router import router as presence_router

app.include_router(rooms_router)
app.include_router(websocket_router)
app.include_router(messages_router)
app.include_router(presence_router)


@app.get("/health")
async def health_check() -> dict:
    """Basic service health check."""
    return {"status": "healthy"}

# Explanation: Creates the FastAPI application instance and manages async database pooling lifecycle.
# Note: WebSocket router is included in teammate's main.py — not duplicated here.