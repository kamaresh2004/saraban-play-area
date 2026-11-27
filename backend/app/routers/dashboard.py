"""Owner dashboard: live counts, today's numbers, 7-day trend, recent bills."""

from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.core.clock import local_day_bounds_utc, minutes_between, now_stored, today_local
from app.core.database import get_db
from app.deps import require_admin
from app.models import Bill, PaymentMethod, Plan, User, Visit, VisitStatus
from app.schemas import BillOut, DashboardOut, PlanOut, WeekPoint
from app.services.billing import to_money
from app.services.presenters import alert_counts, bill_out

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def _sum_bills(db: Session, start, end) -> Decimal:
    value = db.scalar(
        select(func.coalesce(func.sum(Bill.amount), 0)).where(
            Bill.paid_at >= start, Bill.paid_at < end
        )
    )
    return to_money(value or 0)


@router.get("", response_model=DashboardOut)
def dashboard(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> DashboardOut:
    now = now_stored()
    today = today_local()
    start, end = local_day_bounds_utc(today)

    active_visits = list(
        db.scalars(select(Visit).where(Visit.status == VisitStatus.ACTIVE)).all()
    )
    warning_count, overdue_count = alert_counts(active_visits, now)

    today_visits = db.scalar(
        select(func.count(Visit.id)).where(
            Visit.check_in_at >= start, Visit.check_in_at < end
        )
    ) or 0

    today_bills = list(
        db.scalars(
            select(Bill).where(Bill.paid_at >= start, Bill.paid_at < end)
        ).all()
    )
    today_cash = sum(
        (bill.amount for bill in today_bills if bill.payment_method == PaymentMethod.CASH),
        Decimal("0.00"),
    )
    today_upi = sum(
        (bill.amount for bill in today_bills if bill.payment_method == PaymentMethod.UPI),
        Decimal("0.00"),
    )

    completed_today = list(
        db.scalars(
            select(Visit).where(
                Visit.status == VisitStatus.COMPLETED,
                Visit.check_in_at >= start,
                Visit.check_in_at < end,
                Visit.check_out_at.is_not(None),
            )
        ).all()
    )
    if completed_today:
        average_play = round(
            sum(
                minutes_between(visit.check_in_at, visit.check_out_at)  # type: ignore[arg-type]
                for visit in completed_today
            )
            / len(completed_today)
        )
    else:
        average_play = 0

    week: list[WeekPoint] = []
    for offset in range(6, -1, -1):
        day = today - timedelta(days=offset)
        day_start, day_end = local_day_bounds_utc(day)
        visits_count = db.scalar(
            select(func.count(Visit.id)).where(
                Visit.check_in_at >= day_start, Visit.check_in_at < day_end
            )
        ) or 0
        week.append(
            WeekPoint(
                date=day.isoformat(),
                label=day.strftime("%a"),
                visits=visits_count,
                collection=_sum_bills(db, day_start, day_end),
            )
        )

    recent_bills = list(
        db.scalars(
            select(Bill)
            .options(selectinload(Bill.visit), selectinload(Bill.created_by))
            .order_by(Bill.paid_at.desc(), Bill.id.desc())
            .limit(6)
        ).all()
    )

    plans = list(db.scalars(select(Plan).order_by(Plan.sort_order.asc())).all())

    return DashboardOut(
        inside_now=len(active_visits),
        warning_count=warning_count,
        overdue_count=overdue_count,
        today_visits=today_visits,
        today_collection=to_money(today_cash + today_upi),
        today_cash=to_money(today_cash),
        today_upi=to_money(today_upi),
        average_play_minutes=average_play,
        week=week,
        recent_bills=[
            bill_out(bill, bill.visit, bill.created_by.full_name)
            for bill in recent_bills
        ],
        plans=[PlanOut.model_validate(plan) for plan in plans],
    )


@router.get("/recent-bills", response_model=list[BillOut])
def recent_bills(
    limit: int = 6,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> list[BillOut]:
    bills = list(
        db.scalars(
            select(Bill)
            .options(selectinload(Bill.visit), selectinload(Bill.created_by))
            .order_by(Bill.paid_at.desc())
            .limit(max(1, min(limit, 50)))
        ).all()
    )
    return [bill_out(bill, bill.visit, bill.created_by.full_name) for bill in bills]
