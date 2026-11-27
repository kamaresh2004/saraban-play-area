"""SQLAlchemy engine, session factory and declarative base."""

from __future__ import annotations

import os
from collections.abc import Generator

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings

_connect_args: dict[str, object] = {}
if settings.is_sqlite:
    # FastAPI may touch the same SQLite file from worker threads.
    # On PythonAnywhere's free tier the filesystem is networked; WAL can
    # cause hangs, so default to "delete" journal mode.
    _connect_args = {"check_same_thread": False, "timeout": 30,
                     "journal_mode": os.environ.get("SQLITE_JOURNAL_MODE", "delete")}

engine = create_engine(
    settings.database_url,
    connect_args=_connect_args,
    pool_pre_ping=True,
    future=True,
)

# No per-connection event listener needed — the mode is set at creation.


SessionLocal = sessionmaker(
    bind=engine,
    class_=Session,
    autoflush=False,
    autocommit=False,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """Base class for all ORM models."""


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency that yields one session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Create all tables. Safe to call repeatedly (demo convenience)."""
    import app.models  # noqa: F401  (registers mappers)

    Base.metadata.create_all(bind=engine)
