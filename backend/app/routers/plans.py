"""Plan listing and admin price editing."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.deps import get_current_user, require_admin
from app.models import Plan, User
from app.schemas import PlanOut, PlanUpdate
from app.services.billing import to_money

router = APIRouter(prefix="/plans", tags=["plans"])


@router.get("", response_model=list[PlanOut])
def list_plans(
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> list[Plan]:
    return list(db.scalars(select(Plan).order_by(Plan.sort_order.asc(), Plan.id.asc())).all())


@router.patch("/{plan_id}", response_model=PlanOut)
def update_plan(
    plan_id: int,
    payload: PlanUpdate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> Plan:
    plan = db.get(Plan, plan_id)
    if plan is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found.")

    updates = payload.model_dump(exclude_unset=True, exclude_none=True)
    if "price" in updates:
        plan.price = to_money(updates["price"])
    if "name" in updates:
        plan.name = updates["name"]
    if "duration_minutes" in updates:
        plan.duration_minutes = updates["duration_minutes"]
    if "is_active" in updates:
        plan.is_active = updates["is_active"]

    db.commit()
    db.refresh(plan)
    return plan
