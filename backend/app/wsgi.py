"""WSGI entry point for hosts that only provide a WSGI server.

PythonAnywhere's standard web apps are WSGI-based, so this module wraps the
FastAPI application with :mod:`a2wsgi` and makes sure the database is created,
bootstrapped and (optionally) seeded *before* the first request. The normal
FastAPI lifespan is still used when running under uvicorn.

Point the host at ``app.wsgi:application``.
"""

from __future__ import annotations

from sqlalchemy import func, select

from a2wsgi import ASGIMiddleware

from app.core.config import settings
from app.core.database import SessionLocal, init_db
from app.models import Child
from app.services.bootstrap import ensure_bootstrap


def _prepare_database() -> None:
    """Idempotent startup work shared by WSGI hosts."""
    init_db()
    with SessionLocal() as db:
        ensure_bootstrap(db)
        needs_demo_seed = (
            settings.demo_seed_on_startup
            and db.scalar(select(func.count(Child.id))) == 0
        )
    if needs_demo_seed:
        # Imported lazily so a normal uvicorn start does not pay for it.
        from app.seed import seed

        seed()


_prepare_database()

from app.main import app  # noqa: E402  (must import after bootstrap)

application = ASGIMiddleware(app)
