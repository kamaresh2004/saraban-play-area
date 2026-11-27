"""Daily report and CSV export, grouped by Asia/Kolkata calendar day."""

from __future__ import annotations

import csv
import io
from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.clock import (
    local_day_bounds_utc,
    minutes_between,
    now_stored,
    stored_to_local,
    today_local,
)
from app.core.database import get_db
from app.deps import get_current_user
from app.models import Bill, PaymentMethod, User, Visit, VisitStatus
from app.schemas import BillOut, CollectionSplit, DailyReportOut
from app.services.billing import to_money
from app.services.presenters import bill_out

router = APIRouter(prefix="/reports", tags=["reports"])


def _parse_day(raw: str | None) -> date:
    if not raw:
        return today_local()
    try:
        return date.fromisoformat(raw)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid date. Use YYYY-MM-DD.",
        )


def _collect(db: Session, day: date) -> tuple[DailyReportOut, list[BillOut]]:
    start, end = local_day_bounds_utc(day)

    visits = list(
        db.scalars(
            select(Visit).where(Visit.check_in_at >= start, Visit.check_in_at < end)
        ).all()
    )
    completed = [visit for visit in visits if visit.status == VisitStatus.COMPLETED]
    active = [visit for visit in visits if visit.status == VisitStatus.ACTIVE]

    now = now_stored()
    playtime = 0
    for visit in completed:
        if visit.check_out_at is not None:
            playtime += minutes_between(visit.check_in_at, visit.check_out_at)
    for visit in active:
        playtime += minutes_between(visit.check_in_at, now)

    bills = list(
        db.scalars(
            select(Bill)
            .where(Bill.paid_at >= start, Bill.paid_at < end)
            .options(selectinload(Bill.visit), selectinload(Bill.created_by))
            .order_by(Bill.paid_at.asc(), Bill.id.asc())
        ).all()
    )

    cash = Decimal("0.00")
    upi = Decimal("0.00")
    bill_payloads: list[BillOut] = []
    for bill in bills:
        if bill.payment_method == PaymentMethod.CASH:
            cash += bill.amount
        else:
            upi += bill.amount
        bill_payloads.append(bill_out(bill, bill.visit, bill.created_by.full_name))

    collection = CollectionSplit(
        cash=to_money(cash),
        upi=to_money(upi),
        total=to_money(cash + upi),
    )

    report = DailyReportOut(
        date=day.isoformat(),
        visits_count=len(visits),
        completed_visits=len(completed),
        active_visits=len(active),
        total_playtime_minutes=playtime,
        bills_count=len(bills),
        collection=collection,
        bills=bill_payloads,
    )
    return report, bill_payloads


@router.get("/daily", response_model=DailyReportOut)
def daily_report(
    date_str: str | None = Query(default=None, alias="date"),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> DailyReportOut:
    day = _parse_day(date_str)
    report, _ = _collect(db, day)
    return report


@router.get("/daily.csv")
def daily_report_csv(
    date_str: str | None = Query(default=None, alias="date"),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> Response:
    day = _parse_day(date_str)
    report, bills = _collect(db, day)

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        [
            "Bill No",
            "Child",
            "Parent",
            "Phone",
            "Plan",
            "Check-in",
            "Check-out",
            "Play (min)",
            "Plan Price",
            "Overtime (min)",
            "Overtime Amount",
            "Discount",
            "Total",
            "Payment",
            "Staff",
            "Paid At",
        ]
    )
    for bill in bills:
        writer.writerow(
            [
                bill.bill_number,
                bill.child_name,
                bill.parent_name,
                bill.phone,
                bill.plan_name,
                stored_to_local(bill.check_in_at).strftime("%d-%m-%Y %I:%M %p"),
                stored_to_local(bill.check_out_at).strftime("%d-%m-%Y %I:%M %p"),
                bill.play_minutes,
                f"{bill.plan_price:.2f}",
                bill.overtime_minutes,
                f"{bill.overtime_amount:.2f}",
                f"{bill.discount_amount:.2f}",
                f"{bill.total_amount:.2f}",
                bill.payment_method.value.upper(),
                bill.staff_name,
                stored_to_local(bill.paid_at).strftime("%d-%m-%Y %I:%M %p"),
            ]
        )
    writer.writerow([])
    writer.writerow(
        [
            "TOTAL",
            "",
            "",
            "",
            "",
            "",
            "",
            report.total_playtime_minutes,
            "",
            "",
            "",
            "",
            f"{report.collection.total:.2f}",
            f"Cash {report.collection.cash:.2f} / UPI {report.collection.upi:.2f}",
            "",
            "",
        ]
    )

    content = "\ufeff" + buffer.getvalue()
    filename = f"saraban-report-{day.isoformat()}.csv"
    return Response(
        content=content,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
