"""Check-in, live status, checkout quotes and checkout."""

from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.core import clock
from app.core.clock import (
    closing_datetime_for,
    minutes_between,
    now_stored,
    stored_to_utc,
    utc_to_stored,
)
from app.core.database import get_db
from app.deps import get_current_user
from app.models import (
    Bill,
    Child,
    DiscountType,
    Plan,
    User,
    Visit,
    VisitStatus,
)
from app.schemas import (
    BillOut,
    CheckInRequest,
    CheckoutRequest,
    LiveResponse,
    LiveVisitOut,
    QuoteOut,
    VisitDetailOut,
)
from app.services.billing import calculate_bill, make_bill_number
from app.services.bootstrap import get_settings_row
from app.services.presenters import (
    bill_out,
    live_visit_out,
    visit_detail_out,
)

router = APIRouter(prefix="/visits", tags=["visits"])


def _load_visit(db: Session, visit_id: int) -> Visit:
    visit = db.scalar(
        select(Visit)
        .where(Visit.id == visit_id)
        .options(selectinload(Visit.child), selectinload(Visit.bill))
    )
    if visit is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Visit not found.")
    return visit


def _active_visit_for_child(db: Session, child_id: int) -> Visit | None:
    return db.scalar(
        select(Visit).where(
            Visit.child_id == child_id,
            Visit.status == VisitStatus.ACTIVE,
        )
    )


def _quote(
    visit: Visit,
    at,
    discount_type: DiscountType,
    discount_value: Decimal,
    settings_row,
) -> QuoteOut:
    breakdown = calculate_bill(
        plan_price=visit.plan_price,
        booked_minutes=visit.booked_minutes,
        check_in_at=visit.check_in_at,
        check_out_at=at,
        grace_minutes=settings_row.grace_minutes,
        overtime_rate=settings_row.overtime_rate,
        overtime_block_minutes=settings_row.overtime_block_minutes,
        discount_type=discount_type,
        discount_value=discount_value,
    )
    return QuoteOut(
        plan_price=breakdown.plan_price,
        booked_minutes=breakdown.booked_minutes,
        elapsed_minutes=breakdown.elapsed_minutes,
        overtime_minutes=breakdown.overtime_minutes,
        overtime_blocks=breakdown.overtime_blocks,
        overtime_amount=breakdown.overtime_amount,
        subtotal=breakdown.subtotal,
        discount_type=breakdown.discount_type,
        discount_value=breakdown.discount_value,
        discount_amount=breakdown.discount_amount,
        total=breakdown.total,
        grace_minutes=settings_row.grace_minutes,
        overtime_rate=settings_row.overtime_rate,
        overtime_block_minutes=settings_row.overtime_block_minutes,
        check_in_at=visit.check_in_at,
        planned_end_at=visit.planned_end_at,
        check_out_at=at,
    )


@router.get("/active", response_model=LiveResponse)
def live_visits(
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> LiveResponse:
    now = now_stored()
    visits = list(
        db.scalars(
            select(Visit)
            .where(Visit.status == VisitStatus.ACTIVE)
            .options(selectinload(Visit.child))
        ).all()
    )
    payloads = [live_visit_out(visit, now) for visit in visits]
    payloads.sort(key=lambda item: item.remaining_seconds)

    warning_count = sum(1 for item in payloads if item.alert == "warning")
    overdue_count = sum(1 for item in payloads if item.alert == "overdue")

    return LiveResponse(
        server_now=now,
        clock_offset_minutes=clock.get_offset_minutes(),
        warning_count=warning_count,
        overdue_count=overdue_count,
        visits=payloads,
    )


@router.post("/check-in", response_model=LiveVisitOut, status_code=status.HTTP_201_CREATED)
def check_in(
    payload: CheckInRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> LiveVisitOut:
    child = db.get(Child, payload.child_id)
    if child is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Child not found.")

    plan = db.get(Plan, payload.plan_id)
    if plan is None or not plan.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This plan is not available.",
        )

    if _active_visit_for_child(db, child.id) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"{child.name} is already checked in. Please check them out first.",
        )

    settings_row = get_settings_row(db)
    now = now_stored()

    if plan.duration_minutes is None:
        planned_end = closing_datetime_for(now, settings_row.closing_time)
        booked_minutes = max(1, minutes_between(now, planned_end))
    else:
        booked_minutes = plan.duration_minutes
        planned_end = utc_to_stored(stored_to_utc(now) + timedelta(minutes=booked_minutes))

    visit = Visit(
        child_id=child.id,
        plan_id=plan.id,
        created_by_id=user.id,
        child_name=child.name,
        plan_code=plan.code,
        plan_name=plan.name,
        plan_price=plan.price,
        booked_minutes=booked_minutes,
        check_in_at=now,
        planned_end_at=planned_end,
        status=VisitStatus.ACTIVE,
        subtotal=plan.price,
        total_amount=plan.price,
    )
    db.add(visit)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"{child.name} is already checked in. Please check them out first.",
        )

    db.refresh(visit)
    visit.child = child
    return live_visit_out(visit, now)


@router.get("/{visit_id}", response_model=VisitDetailOut)
def get_visit(
    visit_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> VisitDetailOut:
    return visit_detail_out(_load_visit(db, visit_id))


@router.get("/{visit_id}/quote", response_model=QuoteOut)
def quote_visit(
    visit_id: int,
    discount_type: DiscountType = Query(default=DiscountType.NONE),
    discount_value: Decimal = Query(default=Decimal("0.00"), ge=0, le=100000),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> QuoteOut:
    visit = _load_visit(db, visit_id)
    if visit.status != VisitStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This visit has already been checked out.",
        )
    if discount_type == DiscountType.PERCENT and discount_value > 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Percentage discount cannot exceed 100%.",
        )

    return _quote(
        visit,
        now_stored(),
        discount_type,
        discount_value,
        get_settings_row(db),
    )


@router.post("/{visit_id}/checkout", response_model=BillOut)
def checkout(
    visit_id: int,
    payload: CheckoutRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> BillOut:
    visit = _load_visit(db, visit_id)
    if visit.status != VisitStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This visit has already been checked out.",
        )

    settings_row = get_settings_row(db)
    now = now_stored()
    breakdown = calculate_bill(
        plan_price=visit.plan_price,
        booked_minutes=visit.booked_minutes,
        check_in_at=visit.check_in_at,
        check_out_at=now,
        grace_minutes=settings_row.grace_minutes,
        overtime_rate=settings_row.overtime_rate,
        overtime_block_minutes=settings_row.overtime_block_minutes,
        discount_type=payload.discount_type,
        discount_value=payload.discount_value,
    )

    visit.check_out_at = now
    visit.status = VisitStatus.COMPLETED
    visit.overtime_minutes = breakdown.overtime_minutes
    visit.overtime_amount = breakdown.overtime_amount
    visit.subtotal = breakdown.subtotal
    visit.discount_type = breakdown.discount_type
    visit.discount_value = breakdown.discount_value
    visit.discount_amount = breakdown.discount_amount
    visit.total_amount = breakdown.total

    child = visit.child
    bill = Bill(
        bill_number=make_bill_number(visit.id, now),
        visit_id=visit.id,
        child_name=visit.child_name,
        parent_name=child.parent_name if child else "",
        phone=child.phone if child else "",
        plan_name=visit.plan_name,
        amount=breakdown.total,
        payment_method=payload.payment_method,
        paid_at=now,
        created_by_id=user.id,
    )
    bill.created_by = user
    db.add(bill)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This visit already has a bill.",
        )

    db.refresh(bill)
    return bill_out(bill, visit, user.full_name)
