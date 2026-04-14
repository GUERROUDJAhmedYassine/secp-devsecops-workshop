"""
Mail Service — Database
SQLAlchemy engine, session factory, and base model.
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from config import DATABASE_URL

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,   # reconnect after DB restart
    pool_size=5,
    max_overflow=10
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """
    FastAPI dependency — yields a DB session and closes it after the request.
    Usage: db: Session = Depends(get_db)

    FIX applied: was previously Depends(SessionLocal) which is wrong.
    SessionLocal is a factory, not a dependency. This function is the correct
    pattern — it yields the session and guarantees it closes even on exception.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
