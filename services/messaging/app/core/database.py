import asyncpg
from typing import Optional
from core.config import settings

class Database:
    """Manages the async connection pool to PostgreSQL."""
    pool: Optional[asyncpg.Pool] = None

    @classmethod
    async def connect(cls) -> None:
        if cls.pool is None:
            cls.pool = await asyncpg.create_pool(
                dsn=settings.database_url, min_size=1, max_size=10
            )

    @classmethod
    async def disconnect(cls) -> None:
        if cls.pool is not None:
            await cls.pool.close()

db = Database()

def get_pool():
    return db.pool

# Explanation: Initializes and holds the asynchronous database connection pool.
# Security note: Hardcaps max connections to 10 to prevent database resource exhaustion attacks.
