"""SQLAlchemy engine, session factory and declarative base."""

from __future__ import annotations

import os
from collections.abc import Generator

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings

_connect_args: dict[str, object] = {}
_journal_mode = os.environ.get("SQLITE_JOURNAL_MODE", "delete").strip().lower()

if settings.is_sqlite:
    # FastAPI may touch the same SQLite file from worker threads.
    # On networked filesystems (e.g. free-tier hosts) WAL can hang, so the
    # default journal mode is "delete"; override with SQLITE_JOURNAL_MODE.
    _connect_args = {"check_same_thread": False, "timeout": 30}

engine = create_engine(
    settings.database_url,
    connect_args=_connect_args,
    pool_pre_ping=True,
    future=True,
)


if settings.is_sqlite:

    @event.listens_for(engine, "connect")
    def _apply_sqlite_pragmas(dbapi_connection, connection_record) -> None:  # noqa: ANN001
        """Apply pragmas that sqlite3.connect() cannot accept as keyword args."""
        cursor = dbapi_connection.cursor()
        try:
            cursor.execute("PRAGMA foreign_keys=ON")
            if _journal_mode in {"delete", "truncate", "persist", "memory", "wal", "off"}:
                cursor.execute(f"PRAGMA journal_mode={_journal_mode}")
            cursor.execute("PRAGMA busy_timeout=30000")
        finally:
            cursor.close()


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
