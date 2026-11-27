"""First-run bootstrap: settings, default plans and demo staff accounts."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import clock
from app.core.defaults import DEFAULT_PLANS, DEFAULT_SETTINGS, DEMO_ACCOUNTS
from app.models import AppSetting, Plan, User, UserRole
from app.security import hash_password


def get_settings_row(db: Session) -> AppSetting:
    row = db.get(AppSetting, 1)
    if row is None:
        row = AppSetting(id=1, **DEFAULT_SETTINGS)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def ensure_bootstrap(db: Session) -> AppSetting:
    """Idempotently create the settings row, plans and demo accounts."""
    settings_row = get_settings_row(db)

    for plan_default in DEFAULT_PLANS:
        code = str(plan_default["code"])
        exists = db.scalar(select(Plan.id).where(Plan.code == code))
        if exists is None:
            db.add(Plan(**plan_default))

    for account in DEMO_ACCOUNTS:
        exists = db.scalar(select(User.id).where(User.username == account["username"]))
        if exists is None:
            db.add(
                User(
                    username=account["username"],
                    full_name=account["full_name"],
                    hashed_password=hash_password(account["password"]),
                    role=UserRole(account["role"]),
                    is_active=True,
                )
            )

    db.commit()
    clock.set_offset_minutes(settings_row.clock_offset_minutes)
    return settings_row
