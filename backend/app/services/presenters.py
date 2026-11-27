"""Presenters: convert ORM objects to API payloads without leaking internals."""

from __future__ import annotations

import math
from datetime import datetime

from app.core.clock import minutes_between, stored_to_utc
from app.models import Bill, Child, Visit, VisitStatus
from app.schemas import (
    ActiveVisitBrief,
    BillOut,
    ChildOut,
    LiveVisitOut,
    VisitDetailOut,
)


def parse_qr(raw: str) -> str:
    """Accept a bare token or a URL/path containing the token."""
    value = (raw or "").strip().strip("/")
    if "/" in value:
        value = value.rsplit("/", 1)[-1]
    return value


def normalize_phone(raw: str | None) -> str | None:
    if not raw:
        return None
    digits = "".join(ch for ch in raw if ch.isdigit())
    if len(digits) == 12 and digits.startswith("91"):
        digits = digits[2:]
    return digits or None


def live_visit_out(visit: Visit, now: datetime) -> LiveVisitOut:
    elapsed_seconds = max(
        0,
        int((stored_to_utc(now) - stored_to_utc(visit.check_in_at)).total_seconds()),
    )
    remaining_seconds = int(
        (stored_to_utc(visit.planned_end_at) - stored_to_utc(now)).total_seconds()
    )

    if remaining_seconds < 0:
        alert = "overdue"
    elif remaining_seconds <= 10 * 60:
        alert = "warning"
    else:
        alert = "ok"

    booked_seconds = max(1, visit.booked_minutes * 60)
    progress = min(100.0, max(0.0, elapsed_seconds / booked_seconds * 100.0))

    child = visit.child
    return LiveVisitOut(
        id=visit.id,
        child_id=visit.child_id,
        child_name=visit.child_name,
        child_age=child.age if child else 0,
        parent_name=child.parent_name if child else "",
        phone=child.phone if child else "",
        qr_code=child.qr_code if child else "",
        plan_code=visit.plan_code,
        plan_name=visit.plan_name,
        plan_price=visit.plan_price,
        booked_minutes=visit.booked_minutes,
        check_in_at=visit.check_in_at,
        planned_end_at=visit.planned_end_at,
        elapsed_seconds=elapsed_seconds,
        elapsed_minutes=elapsed_seconds // 60,
        remaining_seconds=remaining_seconds,
        remaining_minutes=math.ceil(remaining_seconds / 60) if remaining_seconds > 0 else 0,
        progress_percent=round(progress, 1),
        alert=alert,
    )


def child_out(child: Child, active_visit: Visit | None) -> ChildOut:
    payload = ChildOut.model_validate(child)
    if active_visit is not None:
        payload.active_visit = ActiveVisitBrief(
            id=active_visit.id,
            plan_name=active_visit.plan_name,
            check_in_at=active_visit.check_in_at,
            planned_end_at=active_visit.planned_end_at,
        )
    return payload


def visit_detail_out(visit: Visit) -> VisitDetailOut:
    child = visit.child
    return VisitDetailOut(
        id=visit.id,
        status=visit.status,
        child_id=visit.child_id,
        child_name=visit.child_name,
        child_age=child.age if child else 0,
        parent_name=child.parent_name if child else "",
        phone=child.phone if child else "",
        qr_code=child.qr_code if child else "",
        plan_code=visit.plan_code,
        plan_name=visit.plan_name,
        plan_price=visit.plan_price,
        booked_minutes=visit.booked_minutes,
        check_in_at=visit.check_in_at,
        planned_end_at=visit.planned_end_at,
        check_out_at=visit.check_out_at,
        overtime_minutes=visit.overtime_minutes,
        overtime_amount=visit.overtime_amount,
        subtotal=visit.subtotal,
        discount_type=visit.discount_type,
        discount_value=visit.discount_value,
        discount_amount=visit.discount_amount,
        total_amount=visit.total_amount,
        bill_id=visit.bill.id if visit.bill else None,
    )


def bill_out(bill: Bill, visit: Visit, staff_name: str) -> BillOut:
    check_out = visit.check_out_at or visit.check_in_at
    return BillOut(
        id=bill.id,
        bill_number=bill.bill_number,
        visit_id=bill.visit_id,
        child_name=bill.child_name,
        parent_name=bill.parent_name,
        phone=bill.phone,
        plan_name=bill.plan_name,
        staff_name=staff_name,
        payment_method=bill.payment_method,
        paid_at=bill.paid_at,
        check_in_at=visit.check_in_at,
        check_out_at=check_out,
        play_minutes=minutes_between(visit.check_in_at, check_out),
        plan_price=visit.plan_price,
        booked_minutes=visit.booked_minutes,
        overtime_minutes=visit.overtime_minutes,
        overtime_amount=visit.overtime_amount,
        subtotal=visit.subtotal,
        discount_type=visit.discount_type,
        discount_value=visit.discount_value,
        discount_amount=visit.discount_amount,
        total_amount=visit.total_amount,
        amount=bill.amount,
    )


def alert_counts(visits: list[Visit], now: datetime) -> tuple[int, int]:
    warning = 0
    overdue = 0
    for visit in visits:
        if visit.status != VisitStatus.ACTIVE:
            continue
        remaining = (
            stored_to_utc(visit.planned_end_at) - stored_to_utc(now)
        ).total_seconds()
        if remaining < 0:
            overdue += 1
        elif remaining <= 600:
            warning += 1
    return warning, overdue
