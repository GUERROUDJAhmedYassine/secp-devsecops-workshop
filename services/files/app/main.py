import asyncio
import asyncpg
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import env
from app.routers.files import router as files_router


SERVICE_NAME = "files"


app = FastAPI(title="SECP Files Service", version="0.1.0")

CORS_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(files_router)


@app.on_event("startup")
async def _startup() -> None:
    dsn = env("DATABASE_URL")
    last_err: Exception | None = None
    for _ in range(30):  # ~60s worst case
        try:
            app.state.db_pool = await asyncpg.create_pool(dsn=dsn, min_size=1, max_size=5)
            last_err = None
            break
        except Exception as e:  # pragma: no cover
            last_err = e
            await asyncio.sleep(2)
    if last_err is not None:
        raise last_err
    from app.config import uploads_root

    uploads_root().mkdir(parents=True, exist_ok=True)


@app.on_event("shutdown")
async def _shutdown() -> None:
    pool = getattr(app.state, "db_pool", None)
    if pool:
        await pool.close()


@app.get("/health")
async def health() -> dict:
    return {"ok": True, "service": SERVICE_NAME}
