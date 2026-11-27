"""Pure billing engine.

Rules (all amounts are decided on the server):

* The plan price is snapshotted on the visit at check-in.
* The first ``grace_minutes`` after the booked end are free.
* After grace, every *started* block of ``overtime_block_minutes`` costs
  ``overtime_rate``. Example with defaults: 60-minute plan, 65 minutes played
  -> free; 66 minutes -> 1 block (₹50); 81 minutes -> 2 blocks (₹100).
* A flat discount is capped at the subtotal; a percentage discount is capped
  at 100%. The total is never below zero.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from decimal import ROUND_HALF_UP, Decimal

from app.core.clock import minutes_between, stored_to_local
from app.models import DiscountType

TWOPLACES = Decimal("0.01")


def to_money(value: Decimal | int | float | str) -> Decimal:
    """Round a value to paise using commercial half-up rounding."""
    return Decimal(str(value)).quantize(TWOPLACES, rounding=ROUND_HALF_UP)


def make_bill_number(visit_id: int, paid_at: datetime) -> str:
    """Stable, sortable bill number: SB-YYYYMMDD-VISITID."""
    return f"SB-{stored_to_local(paid_at).strftime('%Y%m%d')}-{visit_id:04d}"


@dataclass(frozen=True)
class BillBreakdown:
    plan_price: Decimal
    booked_minutes: int
    elapsed_minutes: int
    overtime_minutes: int
    overtime_blocks: int
    overtime_amount: Decimal
    subtotal: Decimal
    discount_type: DiscountType
    discount_value: Decimal
    discount_amount: Decimal
    total: Decimal


def calculate_bill(
    *,
    plan_price: Decimal,
    booked_minutes: int,
    check_in_at: datetime,
    check_out_at: datetime,
    grace_minutes: int,
    overtime_rate: Decimal,
    overtime_block_minutes: int,
    discount_type: DiscountType = DiscountType.NONE,
    discount_value: Decimal = Decimal("0.00"),
) -> BillBreakdown:
    plan_price = to_money(plan_price)
    rate = to_money(overtime_rate)
    discount_value = to_money(discount_value)

    if plan_price < 0 or rate < 0:
        raise ValueError("Prices cannot be negative.")
    if overtime_block_minutes < 1:
        raise ValueError("Overtime block must be at least one minute.")
    if discount_value < 0:
        raise ValueError("Discount cannot be negative.")

    elapsed_minutes = minutes_between(check_in_at, check_out_at)
    chargeable_minutes = elapsed_minutes - max(0, booked_minutes) - max(0, grace_minutes)
    overtime_minutes = max(0, chargeable_minutes)

    if overtime_minutes == 0:
        overtime_blocks = 0
    else:
        overtime_blocks = (
            overtime_minutes + overtime_block_minutes - 1
        ) // overtime_block_minutes

    overtime_amount = to_money(rate * overtime_blocks)
    subtotal = to_money(plan_price + overtime_amount)

    if discount_type == DiscountType.PERCENT:
        percent = min(max(discount_value, Decimal("0")), Decimal("100"))
        discount_value = percent
        discount_amount = to_money(subtotal * percent / Decimal("100"))
    elif discount_type == DiscountType.FLAT:
        discount_amount = min(discount_value, subtotal)
    else:
        discount_value = Decimal("0.00")
        discount_amount = Decimal("0.00")

    total = subtotal - discount_amount
    if total < 0:
        total = Decimal("0.00")
    total = to_money(total)

    return BillBreakdown(
        plan_price=plan_price,
        booked_minutes=booked_minutes,
        elapsed_minutes=elapsed_minutes,
        overtime_minutes=overtime_minutes,
        overtime_blocks=overtime_blocks,
        overtime_amount=overtime_amount,
        subtotal=subtotal,
        discount_type=discount_type,
        discount_value=to_money(discount_value),
        discount_amount=to_money(discount_amount),
        total=total,
    )
