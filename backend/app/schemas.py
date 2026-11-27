"""Pydantic request / response schemas.

All outgoing datetimes are serialized as IST ISO-8601 strings with an explicit
+05:30 offset, so the browser never has to guess a time zone. Money is
serialized as a JSON number while remaining ``Decimal`` on the server.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    PlainSerializer,
    field_validator,
    model_validator,
)

from app.core.clock import stored_to_local
from app.models import DiscountType, PaymentMethod, UserRole, VisitStatus


def _ist(value: datetime) -> str:
    return stored_to_local(value).isoformat(timespec="seconds")


def _money(value: Decimal) -> float:
    return round(float(value), 2)


ISTDateTime = Annotated[
    datetime, PlainSerializer(_ist, return_type=str, when_used="json")
]
ISTDateTimeOpt = Annotated[
    datetime | None,
    PlainSerializer(
        lambda value: None if value is None else _ist(value),
        return_type=str | None,
        when_used="json",
    ),
]
MoneyOut = Annotated[Decimal, PlainSerializer(_money, return_type=float, when_used="json")]


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=32)
    password: str = Field(min_length=1, max_length=128)

    @field_validator("username")
    @classmethod
    def clean_username(cls, value: str) -> str:
        cleaned = value.strip().lower()
        if not cleaned:
            raise ValueError("Username is required.")
        return cleaned


class UserOut(ORMModel):
    id: int
    username: str
    full_name: str
    role: UserRole


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ---------------------------------------------------------------------------
# Children
# ---------------------------------------------------------------------------


class ChildCreate(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    age: int = Field(ge=1, le=17)
    parent_name: str = Field(min_length=2, max_length=80)
    phone: str = Field(pattern=r"^\d{10}$")
    consent_given: bool

    @field_validator("name", "parent_name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        cleaned = " ".join(value.split())
        if len(cleaned) < 2:
            raise ValueError("Please enter a valid name.")
        return cleaned

    @field_validator("phone")
    @classmethod
    def clean_phone(cls, value: str) -> str:
        cleaned = "".join(ch for ch in value if ch.isdigit())
        if len(cleaned) != 10:
            raise ValueError("Phone number must be 10 digits.")
        return cleaned

    @field_validator("consent_given")
    @classmethod
    def consent_required(cls, value: bool) -> bool:
        if not value:
            raise ValueError("Parental consent is required.")
        return value


class ActiveVisitBrief(BaseModel):
    id: int
    plan_name: str
    check_in_at: ISTDateTime
    planned_end_at: ISTDateTime


class ChildOut(ORMModel):
    id: int
    name: str
    age: int
    parent_name: str
    phone: str
    consent_given: bool
    qr_code: str
    created_at: ISTDateTime
    active_visit: ActiveVisitBrief | None = None


# ---------------------------------------------------------------------------
# Plans
# ---------------------------------------------------------------------------


class PlanOut(ORMModel):
    id: int
    code: str
    name: str
    price: MoneyOut
    duration_minutes: int | None
    is_active: bool
    sort_order: int


class PlanUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=60)
    price: Decimal | None = Field(default=None, ge=0, le=100000)
    duration_minutes: int | None = Field(default=None, ge=1, le=1440)
    is_active: bool | None = None

    @field_validator("name")
    @classmethod
    def clean_plan_name(cls, value: str | None) -> str | None:
        return " ".join(value.split()) if value else value


# ---------------------------------------------------------------------------
# Visits and billing
# ---------------------------------------------------------------------------


class CheckInRequest(BaseModel):
    child_id: int = Field(gt=0)
    plan_id: int = Field(gt=0)


class CheckoutRequest(BaseModel):
    payment_method: PaymentMethod
    discount_type: DiscountType = DiscountType.NONE
    discount_value: Decimal = Field(default=Decimal("0.00"), ge=0, le=100000)

    @model_validator(mode="after")
    def validate_discount(self) -> "CheckoutRequest":
        if self.discount_type == DiscountType.NONE:
            self.discount_value = Decimal("0.00")
        if self.discount_type == DiscountType.PERCENT and self.discount_value > 100:
            raise ValueError("Percentage discount cannot exceed 100%.")
        return self


class QuoteOut(BaseModel):
    plan_price: MoneyOut
    booked_minutes: int
    elapsed_minutes: int
    overtime_minutes: int
    overtime_blocks: int
    overtime_amount: MoneyOut
    subtotal: MoneyOut
    discount_type: DiscountType
    discount_value: MoneyOut
    discount_amount: MoneyOut
    total: MoneyOut
    grace_minutes: int
    overtime_rate: MoneyOut
    overtime_block_minutes: int
    check_in_at: ISTDateTime
    planned_end_at: ISTDateTime
    check_out_at: ISTDateTimeOpt


class LiveVisitOut(BaseModel):
    id: int
    child_id: int
    child_name: str
    child_age: int
    parent_name: str
    phone: str
    qr_code: str
    plan_code: str
    plan_name: str
    plan_price: MoneyOut
    booked_minutes: int
    check_in_at: ISTDateTime
    planned_end_at: ISTDateTime
    elapsed_seconds: int
    elapsed_minutes: int
    remaining_seconds: int
    remaining_minutes: int
    progress_percent: float
    alert: Literal["ok", "warning", "overdue"]


class LiveResponse(BaseModel):
    server_now: ISTDateTime
    clock_offset_minutes: int
    warning_count: int
    overdue_count: int
    visits: list[LiveVisitOut]


class VisitDetailOut(BaseModel):
    id: int
    status: VisitStatus
    child_id: int
    child_name: str
    child_age: int
    parent_name: str
    phone: str
    qr_code: str
    plan_code: str
    plan_name: str
    plan_price: MoneyOut
    booked_minutes: int
    check_in_at: ISTDateTime
    planned_end_at: ISTDateTime
    check_out_at: ISTDateTimeOpt
    overtime_minutes: int
    overtime_amount: MoneyOut
    subtotal: MoneyOut
    discount_type: DiscountType
    discount_value: MoneyOut
    discount_amount: MoneyOut
    total_amount: MoneyOut
    bill_id: int | None = None


# ---------------------------------------------------------------------------
# Bills
# ---------------------------------------------------------------------------


class BillOut(BaseModel):
    id: int
    bill_number: str
    visit_id: int
    child_name: str
    parent_name: str
    phone: str
    plan_name: str
    staff_name: str
    payment_method: PaymentMethod
    paid_at: ISTDateTime
    check_in_at: ISTDateTime
    check_out_at: ISTDateTime
    play_minutes: int
    plan_price: MoneyOut
    booked_minutes: int
    overtime_minutes: int
    overtime_amount: MoneyOut
    subtotal: MoneyOut
    discount_type: DiscountType
    discount_value: MoneyOut
    discount_amount: MoneyOut
    total_amount: MoneyOut
    amount: MoneyOut


# ---------------------------------------------------------------------------
# Settings
# ---------------------------------------------------------------------------


class SettingsOut(ORMModel):
    business_name: str
    business_tagline: str
    business_address: str
    business_phone: str
    bill_footer: str
    closing_time: str
    grace_minutes: int
    overtime_rate: MoneyOut
    overtime_block_minutes: int
    clock_offset_minutes: int
    updated_at: ISTDateTime


class SettingsUpdate(BaseModel):
    business_name: str | None = Field(default=None, min_length=2, max_length=80)
    business_tagline: str | None = Field(default=None, max_length=120)
    business_address: str | None = Field(default=None, max_length=300)
    business_phone: str | None = Field(default=None, max_length=32)
    bill_footer: str | None = Field(default=None, max_length=300)
    closing_time: str | None = Field(
        default=None, pattern=r"^([01]\d|2[0-3]):[0-5]\d$"
    )
    grace_minutes: int | None = Field(default=None, ge=0, le=60)
    overtime_rate: Decimal | None = Field(default=None, ge=0, le=10000)
    overtime_block_minutes: int | None = Field(default=None, ge=1, le=120)


class DemoFastForwardRequest(BaseModel):
    minutes: int = Field(default=15, ge=-720, le=720)


class DemoClockOut(BaseModel):
    offset_minutes: int
    server_now: ISTDateTime


# ---------------------------------------------------------------------------
# Reports and dashboard
# ---------------------------------------------------------------------------


class CollectionSplit(BaseModel):
    cash: MoneyOut
    upi: MoneyOut
    total: MoneyOut


class DailyReportOut(BaseModel):
    date: str
    visits_count: int
    completed_visits: int
    active_visits: int
    total_playtime_minutes: int
    bills_count: int
    collection: CollectionSplit
    bills: list[BillOut]


class WeekPoint(BaseModel):
    date: str
    label: str
    visits: int
    collection: MoneyOut


class DashboardOut(BaseModel):
    inside_now: int
    warning_count: int
    overdue_count: int
    today_visits: int
    today_collection: MoneyOut
    today_cash: MoneyOut
    today_upi: MoneyOut
    average_play_minutes: int
    week: list[WeekPoint]
    recent_bills: list[BillOut]
    plans: list[PlanOut]
