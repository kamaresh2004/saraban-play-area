"""FastAPI application entry point."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select

from app.core.config import settings
from app.core.database import SessionLocal, init_db
from app.models import Child
from app.routers import (
    auth,
    bills,
    children,
    dashboard,
    plans,
    reports,
)
from app.routers import settings as settings_routes
from app.routers import visits
from app.seed import seed
from app.services.bootstrap import ensure_bootstrap


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    with SessionLocal() as db:
        ensure_bootstrap(db)
        needs_demo_seed = (
            settings.demo_seed_on_startup
            and db.scalar(select(func.count(Child.id))) == 0
        )
    if needs_demo_seed:
        # Ephemeral hosts (Render free tier) start with an empty database.
        # seed() recreates every table and restores the full demo dataset.
        seed()
    yield


app = FastAPI(
    title=settings.app_name,
    description="Demo API for the Saraban Play Area management app.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_origin_regex=settings.cors_origin_regex or None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for router in (
    auth.router,
    children.router,
    plans.router,
    visits.router,
    bills.router,
    reports.router,
    dashboard.router,
    settings_routes.router,
    settings_routes.demo_router,
):
    app.include_router(router, prefix=settings.api_prefix)


@app.get(f"{settings.api_prefix}/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok", "app": settings.app_name}
