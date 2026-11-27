"""Bill lookup and reprints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.database import get_db
from app.deps import get_current_user
from app.models import Bill, User
from app.schemas import BillOut
from app.services.presenters import bill_out

router = APIRouter(prefix="/bills", tags=["bills"])

_BILL_OPTIONS = (selectinload(Bill.visit), selectinload(Bill.created_by))


@router.get("", response_model=list[BillOut])
def list_bills(
    limit: int = Query(default=10, ge=1, le=100),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> list[BillOut]:
    bills = db.scalars(
        select(Bill)
        .options(*_BILL_OPTIONS)
        .order_by(Bill.paid_at.desc(), Bill.id.desc())
        .limit(limit)
    ).all()
    return [bill_out(bill, bill.visit, bill.created_by.full_name) for bill in bills]


@router.get("/{bill_id}", response_model=BillOut)
def get_bill(
    bill_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> BillOut:
    bill = db.scalar(select(Bill).where(Bill.id == bill_id).options(*_BILL_OPTIONS))
    if bill is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bill not found.")
    return bill_out(bill, bill.visit, bill.created_by.full_name)
