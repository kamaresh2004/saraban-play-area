"""Seed the demo database with realistic fictional data.

Usage (from the backend folder):

    python -m app.seed

This DROPS and recreates every table. It creates the two demo accounts, the
three default plans, 17 children (including siblings sharing a phone number),
6 children inside right now, and 7 days of completed visits and bills.
"""

from __future__ import annotations

import random
from datetime import datetime, time, timedelta
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import clock
from app.core.clock import (
    IST,
    closing_datetime_for,
    local_to_stored,
    minutes_between,
    now_stored,
    stored_to_local,
    today_local,
)
from app.core.database import Base, SessionLocal, engine, init_db
from app.models import (
    AppSetting,
    Bill,
    Child,
    DiscountType,
    PaymentMethod,
    Plan,
    User,
    Visit,
    VisitStatus,
)
from app.services.billing import calculate_bill, make_bill_number
from app.services.bootstrap import ensure_bootstrap

CHILDREN = [
    ("Aarav Mehta", 6, "Rohit Mehta", "9830012345"),
    ("Rhea Mehta", 4, "Rohit Mehta", "9830012345"),
    ("Diya Sharma", 5, "Neha Sharma", "9831023456"),
    ("Kabir Banerjee", 7, "Ananya Banerjee", "9832034567"),
    ("Kiara Banerjee", 3, "Ananya Banerjee", "9832034567"),
    ("Anaya Das", 5, "Sudipta Das", "9833045678"),
    ("Vivaan Ghosh", 3, "Rupa Ghosh", "9834056789"),
    ("Myra Chatterjee", 6, "Arindam Chatterjee", "9835067890"),
    ("Advik Roy", 8, "Moumita Roy", "9836078901"),
    ("Sara Khan", 5, "Imran Khan", "9837089012"),
    ("Reyansh Singh", 4, "Pooja Singh", "9838090123"),
    ("Ishani Bose", 7, "Kaushik Bose", "9839001234"),
    ("Ayaan Paul", 6, "Riya Paul", "9840012345"),
    ("Zara Dutta", 4, "Sohini Dutta", "9841023456"),
    ("Dev Malhotra", 9, "Kunal Malhotra", "9842034567"),
    ("Nitya Verma", 5, "Shalini Verma", "9843045678"),
    ("Aarohi Sen", 3, "Tanya Sen", "9844056789"),
]


def _closing_for(check_in, closing_hhmm: str) -> tuple[datetime, int]:
    planned_end = closing_datetime_for(check_in, closing_hhmm)
    return planned_end, max(1, minutes_between(check_in, planned_end))


def _add_completed(
    db: Session,
    *,
    child: Child,
    plan: Plan,
    staff: User,
    check_in,
    extra_minutes: int,
    payment: PaymentMethod,
    discount_type: DiscountType,
    discount_value: Decimal,
    settings_row: AppSetting,
) -> Bill:
    if plan.duration_minutes is None:
        planned_end, booked = _closing_for(check_in, settings_row.closing_time)
    else:
        booked = plan.duration_minutes
        planned_end = check_in + timedelta(minutes=booked)

    check_out = check_in + timedelta(minutes=booked + extra_minutes)
    breakdown = calculate_bill(
        plan_price=plan.price,
        booked_minutes=booked,
        check_in_at=check_in,
        check_out_at=check_out,
        grace_minutes=settings_row.grace_minutes,
        overtime_rate=settings_row.overtime_rate,
        overtime_block_minutes=settings_row.overtime_block_minutes,
        discount_type=discount_type,
        discount_value=discount_value,
    )

    visit = Visit(
        child_id=child.id,
        plan_id=plan.id,
        created_by_id=staff.id,
        child_name=child.name,
        plan_code=plan.code,
        plan_name=plan.name,
        plan_price=plan.price,
        booked_minutes=booked,
        check_in_at=check_in,
        planned_end_at=planned_end,
        check_out_at=check_out,
        status=VisitStatus.COMPLETED,
        overtime_minutes=breakdown.overtime_minutes,
        overtime_amount=breakdown.overtime_amount,
        subtotal=breakdown.subtotal,
        discount_type=breakdown.discount_type,
        discount_value=breakdown.discount_value,
        discount_amount=breakdown.discount_amount,
        total_amount=breakdown.total,
    )
    db.add(visit)
    db.flush()

    bill = Bill(
        bill_number=make_bill_number(visit.id, check_out),
        visit_id=visit.id,
        child_name=child.name,
        parent_name=child.parent_name,
        phone=child.phone,
        plan_name=plan.name,
        amount=breakdown.total,
        payment_method=payment,
        paid_at=check_out,
        created_by_id=staff.id,
    )
    db.add(bill)
    return bill


def _add_active(
    db: Session,
    *,
    child: Child,
    plan: Plan,
    staff: User,
    check_in,
    settings_row: AppSetting,
) -> Visit:
    if plan.duration_minutes is None:
        planned_end, booked = _closing_for(check_in, settings_row.closing_time)
    else:
        booked = plan.duration_minutes
        planned_end = check_in + timedelta(minutes=booked)

    visit = Visit(
        child_id=child.id,
        plan_id=plan.id,
        created_by_id=staff.id,
        child_name=child.name,
        plan_code=plan.code,
        plan_name=plan.name,
        plan_price=plan.price,
        booked_minutes=booked,
        check_in_at=check_in,
        planned_end_at=planned_end,
        status=VisitStatus.ACTIVE,
        subtotal=plan.price,
        total_amount=plan.price,
    )
    db.add(visit)
    return visit


def seed() -> None:
    print("Resetting database...")
    Base.metadata.drop_all(bind=engine)
    init_db()
    clock.set_offset_minutes(0)

    rng = random.Random(42)
    today = today_local()

    with SessionLocal() as db:
        settings_row = ensure_bootstrap(db)
        settings_row.clock_offset_minutes = 0
        db.commit()

        admin = db.scalar(select(User).where(User.username == "admin"))
        reception = db.scalar(select(User).where(User.username == "reception"))
        assert admin is not None and reception is not None

        plans = {plan.code: plan for plan in db.scalars(select(Plan)).all()}
        plan_30 = plans["play-30"]
        plan_60 = plans["play-60"]
        plan_day = plans["play-day"]

        children: list[Child] = []
        for name, age, parent, phone in CHILDREN:
            child = Child(
                name=name,
                age=age,
                parent_name=parent,
                phone=phone,
                consent_given=True,
            )
            db.add(child)
            children.append(child)
        db.commit()
        for child in children:
            db.refresh(child)

        staff_cycle = [reception, admin]
        payment_cycle = [PaymentMethod.UPI, PaymentMethod.CASH]
        discount_cycle = [
            (DiscountType.NONE, Decimal("0")),
            (DiscountType.NONE, Decimal("0")),
            (DiscountType.PERCENT, Decimal("10")),
            (DiscountType.FLAT, Decimal("50")),
        ]

        bills_created = 0

        # ---- Previous six days -------------------------------------------------
        slots = [(11, 0), (12, 30), (15, 30), (17, 0), (18, 15)]
        for day_offset in range(6, 0, -1):
            day = today - timedelta(days=day_offset)
            visits_today = 3 + (day_offset % 3)
            for index in range(visits_today):
                hour, minute = slots[index]
                check_in = local_to_stored(
                    datetime.combine(day, time(hour, minute), tzinfo=IST)
                )
                child = children[(day_offset * 3 + index) % len(children)]
                if index == 0 and day_offset % 2 == 0:
                    plan = plan_day
                elif index % 2 == 0:
                    plan = plan_60
                else:
                    plan = plan_30
                extra = rng.choice([0, 0, 2, 7, 16, 31])
                discount_type, discount_value = discount_cycle[
                    (day_offset + index) % len(discount_cycle)
                ]
                _add_completed(
                    db,
                    child=child,
                    plan=plan,
                    staff=staff_cycle[index % 2],
                    check_in=check_in,
                    extra_minutes=extra,
                    payment=payment_cycle[(day_offset + index) % 2],
                    discount_type=discount_type,
                    discount_value=discount_value,
                    settings_row=settings_row,
                )
                bills_created += 1
            db.commit()

        # ---- Four completed visits earlier today --------------------------------
        now = now_stored()
        earlier_today = [
            (children[0], plan_60, 215, 55, PaymentMethod.UPI),
            (children[12], plan_30, 155, 34, PaymentMethod.CASH),
            (children[10], plan_60, 100, 66, PaymentMethod.UPI),
            (children[11], plan_30, 50, 27, PaymentMethod.CASH),
        ]
        for index, (child, plan, started_ago, played, payment) in enumerate(earlier_today):
            check_in = now - timedelta(minutes=started_ago)
            extra = max(0, played - int(plan.duration_minutes or played))
            discount_type, discount_value = discount_cycle[index % len(discount_cycle)]
            _add_completed(
                db,
                child=child,
                plan=plan,
                staff=staff_cycle[index % 2],
                check_in=check_in,
                extra_minutes=extra,
                payment=payment,
                discount_type=discount_type,
                discount_value=discount_value,
                settings_row=settings_row,
            )
            bills_created += 1
        db.commit()

        # ---- Six children inside right now -------------------------------------
        active_specs = [
            (children[7], plan_60, 52),   # 8 minutes left -> amber
            (children[6], plan_30, 24),   # 6 minutes left -> amber
            (children[8], plan_30, 38),   # 8 minutes overdue -> red
            (children[2], plan_60, 20),   # comfortable
            (children[3], plan_day, 95),  # full day
            (children[13], plan_30, 4),   # just arrived
        ]
        for index, (child, plan, started_ago) in enumerate(active_specs):
            _add_active(
                db,
                child=child,
                plan=plan,
                staff=staff_cycle[index % 2],
                check_in=now - timedelta(minutes=started_ago),
                settings_row=settings_row,
            )
        db.commit()

        total_bills = db.scalar(select(Bill.id).order_by(Bill.id.desc()).limit(1))
        collection = db.query(Bill).all()
        total_collection = sum((bill.amount for bill in collection), Decimal("0.00"))
        active_count = db.query(Visit).filter(Visit.status == VisitStatus.ACTIVE).count()

        print("")
        print("Saraban Play Area demo data ready")
        print(f"  Children registered : {len(children)}")
        print(f"  Active visits       : {active_count}")
        print(f"  Bills               : {bills_created} (last id {total_bills})")
        print(f"  Total collection    : Rs {total_collection:,.2f}")
        print(f"  Server time (IST)   : {stored_to_local(now_stored()).strftime('%d %b %Y, %I:%M %p')}")
        print("")
        print("  Login: admin / admin123  or  reception / reception123")


if __name__ == "__main__":
    seed()
