"""Database models for Saraban Play Area.

Design rules enforced here and in the service layer:

* Money columns are NUMERIC(12, 2) and handled as ``Decimal`` in Python.
* Timestamps are stored as naive UTC (see :mod:`app.core.clock`); the frontend
  renders them in Asia/Kolkata.
* A visit snapshots the plan code, name and price. Editing a plan later must
  never change an existing visit or bill.
* Only one *active* visit may exist per child, backed by a partial unique index
  in SQLite as well as application-level validation.
* A completed visit owns exactly one immutable bill.
"""

from __future__ import annotations

import enum
from datetime import datetime
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.clock import now_stored
from app.core.database import Base

MONEY = Numeric(12, 2)


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    RECEPTION = "reception"


class VisitStatus(str, enum.Enum):
    ACTIVE = "active"
    COMPLETED = "completed"


class PaymentMethod(str, enum.Enum):
    CASH = "cash"
    UPI = "upi"


class DiscountType(str, enum.Enum):
    NONE = "none"
    FLAT = "flat"
    PERCENT = "percent"


def enum_column(enum_cls: type[enum.Enum], name: str) -> SAEnum:
    """Portable string enum: stores the enum *value*, not its Python name."""
    return SAEnum(
        enum_cls,
        name=name,
        native_enum=False,
        length=24,
        values_callable=lambda members: [member.value for member in members],
        validate_strings=True,
    )


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(32), unique=True, index=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(80), nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        enum_column(UserRole, "user_role"), nullable=False, default=UserRole.RECEPTION
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=now_stored)

    visits: Mapped[list["Visit"]] = relationship(
        back_populates="created_by",
        foreign_keys="Visit.created_by_id",
    )
    bills: Mapped[list["Bill"]] = relationship(
        back_populates="created_by",
        foreign_keys="Bill.created_by_id",
    )

    def __repr__(self) -> str:  # pragma: no cover - debugging helper
        return f"<User {self.username} ({self.role.value})>"


class Child(Base):
    __tablename__ = "children"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    age: Mapped[int] = mapped_column(Integer, nullable=False)
    parent_name: Mapped[str] = mapped_column(String(80), nullable=False)
    phone: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    consent_given: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    qr_code: Mapped[str] = mapped_column(
        String(36), unique=True, index=True, nullable=False, default=lambda: str(uuid4())
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=now_stored)

    visits: Mapped[list["Visit"]] = relationship(
        back_populates="child",
        cascade="all, delete-orphan",
        order_by="Visit.id.desc()",
    )

    def __repr__(self) -> str:  # pragma: no cover - debugging helper
        return f"<Child {self.name} phone={self.phone}>"


class Plan(Base):
    __tablename__ = "plans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(24), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(60), nullable=False)
    price: Mapped[Decimal] = mapped_column(MONEY, nullable=False)
    # NULL duration means "full day, until closing time".
    duration_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    visits: Mapped[list["Visit"]] = relationship(back_populates="plan")

    def __repr__(self) -> str:  # pragma: no cover - debugging helper
        return f"<Plan {self.code} {self.price}>"


class Visit(Base):
    __tablename__ = "visits"
    __table_args__ = (
        Index("ix_visits_status_planned_end", "status", "planned_end_at"),
        Index(
            "uq_visits_one_active_per_child",
            "child_id",
            unique=True,
            sqlite_where=text("status = 'active'"),
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    child_id: Mapped[int] = mapped_column(
        ForeignKey("children.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    plan_id: Mapped[int] = mapped_column(
        ForeignKey("plans.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    created_by_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )

    # Snapshot fields: safe from later edits to child or plan records.
    child_name: Mapped[str] = mapped_column(String(80), nullable=False)
    plan_code: Mapped[str] = mapped_column(String(24), nullable=False)
    plan_name: Mapped[str] = mapped_column(String(60), nullable=False)
    plan_price: Mapped[Decimal] = mapped_column(MONEY, nullable=False)

    booked_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    check_in_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=now_stored)
    planned_end_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    check_out_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    status: Mapped[VisitStatus] = mapped_column(
        enum_column(VisitStatus, "visit_status"),
        nullable=False,
        default=VisitStatus.ACTIVE,
        index=True,
    )

    overtime_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    overtime_amount: Mapped[Decimal] = mapped_column(MONEY, nullable=False, default=Decimal("0.00"))
    subtotal: Mapped[Decimal] = mapped_column(MONEY, nullable=False, default=Decimal("0.00"))

    discount_type: Mapped[DiscountType] = mapped_column(
        enum_column(DiscountType, "discount_type"),
        nullable=False,
        default=DiscountType.NONE,
    )
    discount_value: Mapped[Decimal] = mapped_column(MONEY, nullable=False, default=Decimal("0.00"))
    discount_amount: Mapped[Decimal] = mapped_column(MONEY, nullable=False, default=Decimal("0.00"))
    total_amount: Mapped[Decimal] = mapped_column(MONEY, nullable=False, default=Decimal("0.00"))

    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=now_stored)

    child: Mapped[Child] = relationship(back_populates="visits")
    plan: Mapped[Plan] = relationship(back_populates="visits")
    created_by: Mapped[User] = relationship(back_populates="visits", foreign_keys=[created_by_id])
    bill: Mapped["Bill | None"] = relationship(
        back_populates="visit",
        cascade="all, delete-orphan",
        uselist=False,
    )

    @property
    def is_active(self) -> bool:
        return self.status == VisitStatus.ACTIVE

    def __repr__(self) -> str:  # pragma: no cover - debugging helper
        return f"<Visit {self.id} child={self.child_name} status={self.status.value}>"


class Bill(Base):
    __tablename__ = "bills"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    bill_number: Mapped[str] = mapped_column(String(24), unique=True, index=True, nullable=False)

    visit_id: Mapped[int] = mapped_column(
        ForeignKey("visits.id", ondelete="CASCADE"), nullable=False, unique=True, index=True
    )

    # Self-contained snapshot for reprints, even if other records change.
    child_name: Mapped[str] = mapped_column(String(80), nullable=False)
    parent_name: Mapped[str] = mapped_column(String(80), nullable=False)
    phone: Mapped[str] = mapped_column(String(10), nullable=False)
    plan_name: Mapped[str] = mapped_column(String(60), nullable=False)

    amount: Mapped[Decimal] = mapped_column(MONEY, nullable=False)
    payment_method: Mapped[PaymentMethod] = mapped_column(
        enum_column(PaymentMethod, "payment_method"), nullable=False
    )
    paid_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=now_stored, index=True)
    created_by_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=now_stored)

    visit: Mapped[Visit] = relationship(back_populates="bill")
    created_by: Mapped[User] = relationship(back_populates="bills", foreign_keys=[created_by_id])

    def __repr__(self) -> str:  # pragma: no cover - debugging helper
        return f"<Bill {self.bill_number} {self.amount}>"


class AppSetting(Base):
    """Single-row settings table (id is always 1)."""

    __tablename__ = "app_settings"
    __table_args__ = (CheckConstraint("id = 1", name="ck_app_settings_singleton"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)

    business_name: Mapped[str] = mapped_column(String(80), nullable=False, default="Saraban Play Area")
    business_tagline: Mapped[str] = mapped_column(
        String(120), nullable=False, default="Play • Learn • Celebrate"
    )
    business_address: Mapped[str] = mapped_column(Text, nullable=False, default="")
    business_phone: Mapped[str] = mapped_column(String(32), nullable=False, default="")
    bill_footer: Mapped[str] = mapped_column(
        Text, nullable=False, default="Thank you for playing with us. See you soon!"
    )

    closing_time: Mapped[str] = mapped_column(String(5), nullable=False, default="20:00")
    grace_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    overtime_rate: Mapped[Decimal] = mapped_column(MONEY, nullable=False, default=Decimal("50.00"))
    overtime_block_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=15)
    clock_offset_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=now_stored, onupdate=now_stored
    )

    def __repr__(self) -> str:  # pragma: no cover - debugging helper
        return f"<AppSetting closing={self.closing_time}>"


__all__ = [
    "AppSetting",
    "Bill",
    "Child",
    "DiscountType",
    "PaymentMethod",
    "Plan",
    "User",
    "UserRole",
    "Visit",
    "VisitStatus",
]
