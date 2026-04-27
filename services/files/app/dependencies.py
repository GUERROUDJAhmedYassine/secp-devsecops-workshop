import asyncpg
from fastapi import Request


async def get_db(request: Request) -> asyncpg.Pool:
    pool = request.app.state.db_pool
    if pool is None:
        raise RuntimeError("DB pool not initialized")
    return pool
