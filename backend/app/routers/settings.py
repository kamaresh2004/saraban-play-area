"""Settings (owner only for writes) and demo clock controls."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core import clock
from app.core.clock import parse_hhmm
from app.core.database import get_db
from app.deps import get_current_user, require_admin
from app.models import User
from app.schemas import (
    DemoClockOut,
    DemoFastForwardRequest,
    SettingsOut,
    SettingsUpdate,
)
from app.services.billing import to_money
from app.services.bootstrap import get_settings_row

router = APIRouter(prefix="/settings", tags=["settings"])
demo_router = APIRouter(prefix="/demo", tags=["demo"])


@router.get("", response_model=SettingsOut)
def get_settings(
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> SettingsOut:
    # Read access is open to all staff because receipts print the business
    # header. Only the owner may change values.
    return SettingsOut.model_validate(get_settings_row(db))


@router.patch("", response_model=SettingsOut)
def update_settings(
    payload: SettingsUpdate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> SettingsOut:
    row = get_settings_row(db)
    updates = payload.model_dump(exclude_unset=True, exclude_none=True)

    if "closing_time" in updates:
        try:
            parse_hhmm(str(updates["closing_time"]))
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=str(exc),
            )
    if "overtime_rate" in updates:
        updates["overtime_rate"] = to_money(updates["overtime_rate"])

    for field, value in updates.items():
        setattr(row, field, value)

    db.commit()
    db.refresh(row)
    return SettingsOut.model_validate(row)


@demo_router.post("/fast-forward", response_model=DemoClockOut)
def fast_forward(
    payload: DemoFastForwardRequest,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> DemoClockOut:
    row = get_settings_row(db)
    offset = clock.add_offset_minutes(payload.minutes)
    row.clock_offset_minutes = offset
    db.commit()
    return DemoClockOut(offset_minutes=offset, server_now=clock.now_stored())


@demo_router.post("/reset-clock", response_model=DemoClockOut)
def reset_clock(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> DemoClockOut:
    row = get_settings_row(db)
    clock.set_offset_minutes(0)
    row.clock_offset_minutes = 0
    db.commit()
    return DemoClockOut(offset_minutes=0, server_now=clock.now_stored())
