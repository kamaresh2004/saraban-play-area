"""Unit tests for the pure billing engine."""

from __future__ import annotations

from datetime import datetime, timedelta
from decimal import Decimal

from app.models import DiscountType
from app.services.billing import calculate_bill

BASE = datetime(2026, 1, 15, 10, 0, 0)


def bill(minutes: int, **overrides):
    params = {
        "plan_price": Decimal("250.00"),
        "booked_minutes": 60,
        "check_in_at": BASE,
        "check_out_at": BASE + timedelta(minutes=minutes),
        "grace_minutes": 5,
        "overtime_rate": Decimal("50.00"),
        "overtime_block_minutes": 15,
        "discount_type": DiscountType.NONE,
        "discount_value": Decimal("0.00"),
    }
    params.update(overrides)
    return calculate_bill(**params)


def test_plan_price_within_booked_time():
    result = bill(60)
    assert result.overtime_blocks == 0
    assert result.overtime_amount == Decimal("0.00")
    assert result.subtotal == Decimal("250.00")
    assert result.total == Decimal("250.00")


def test_grace_period_is_free():
    result = bill(65)
    assert result.overtime_minutes == 0
    assert result.overtime_blocks == 0
    assert result.total == Decimal("250.00")


def test_first_started_block_after_grace():
    result = bill(66)
    assert result.overtime_minutes == 1
    assert result.overtime_blocks == 1
    assert result.overtime_amount == Decimal("50.00")
    assert result.total == Decimal("300.00")


def test_started_blocks_round_up():
    assert bill(80).overtime_blocks == 1
    assert bill(81).overtime_blocks == 2
    assert bill(81).overtime_amount == Decimal("100.00")


def test_flat_discount_cannot_be_negative_total():
    result = bill(
        60,
        discount_type=DiscountType.FLAT,
        discount_value=Decimal("1000.00"),
    )
    assert result.discount_amount == Decimal("250.00")
    assert result.total == Decimal("0.00")


def test_percentage_discount():
    result = bill(
        66,
        discount_type=DiscountType.PERCENT,
        discount_value=Decimal("10"),
    )
    assert result.subtotal == Decimal("300.00")
    assert result.discount_amount == Decimal("30.00")
    assert result.total == Decimal("270.00")


def test_percentage_discount_is_capped_at_100():
    result = bill(
        60,
        discount_type=DiscountType.PERCENT,
        discount_value=Decimal("150"),
    )
    assert result.discount_value == Decimal("100.00")
    assert result.total == Decimal("0.00")


def test_full_day_plan_overtime():
    result = bill(
        486,
        plan_price=Decimal("500.00"),
        booked_minutes=480,
        grace_minutes=5,
        overtime_rate=Decimal("50.00"),
        overtime_block_minutes=15,
    )
    assert result.overtime_minutes == 1
    assert result.overtime_blocks == 1
    assert result.total == Decimal("550.00")


def test_checkout_before_checkin_is_safe():
    result = calculate_bill(
        plan_price=Decimal("150.00"),
        booked_minutes=30,
        check_in_at=BASE,
        check_out_at=BASE - timedelta(minutes=10),
        grace_minutes=5,
        overtime_rate=Decimal("50.00"),
        overtime_block_minutes=15,
    )
    assert result.elapsed_minutes == 0
    assert result.total == Decimal("150.00")
