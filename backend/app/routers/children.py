"""Child registration and lookup by phone / QR."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.deps import get_current_user
from app.models import Child, User, Visit, VisitStatus
from app.schemas import ChildCreate, ChildOut
from app.services.presenters import child_out, normalize_phone, parse_qr

router = APIRouter(prefix="/children", tags=["children"])


def _active_map(db: Session, child_ids: list[int]) -> dict[int, Visit]:
    if not child_ids:
        return {}
    visits = db.scalars(
        select(Visit).where(
            Visit.status == VisitStatus.ACTIVE,
            Visit.child_id.in_(child_ids),
        )
    ).all()
    return {visit.child_id: visit for visit in visits}


@router.get("", response_model=list[ChildOut])
def list_children(
    q: str | None = Query(default=None, max_length=80),
    phone: str | None = Query(default=None, max_length=20),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> list[ChildOut]:
    stmt = select(Child)

    normalized_phone = normalize_phone(phone)
    if normalized_phone:
        stmt = stmt.where(Child.phone == normalized_phone)
    elif q:
        term = f"%{q.strip().lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(Child.name).like(term),
                func.lower(Child.parent_name).like(term),
                Child.phone.like(f"%{q.strip()}%"),
            )
        )

    children = db.scalars(stmt.order_by(Child.name.asc()).limit(50)).all()
    active = _active_map(db, [child.id for child in children])
    return [child_out(child, active.get(child.id)) for child in children]


@router.post("", response_model=ChildOut, status_code=status.HTTP_201_CREATED)
def create_child(
    payload: ChildCreate,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> ChildOut:
    duplicate = db.scalar(
        select(Child).where(
            Child.phone == payload.phone,
            func.lower(Child.name) == payload.name.lower(),
        )
    )
    if duplicate is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"{payload.name} is already registered with this phone number.",
        )

    child = Child(
        name=payload.name,
        age=payload.age,
        parent_name=payload.parent_name,
        phone=payload.phone,
        consent_given=True,
    )
    db.add(child)
    db.commit()
    db.refresh(child)
    return child_out(child, None)


@router.get("/qr/{qr_code}", response_model=ChildOut)
def get_child_by_qr(
    qr_code: str,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> ChildOut:
    token = parse_qr(qr_code)
    child = db.scalar(select(Child).where(Child.qr_code == token))
    if child is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="This QR code is not linked to a registered child.",
        )
    active = _active_map(db, [child.id]).get(child.id)
    return child_out(child, active)


@router.get("/{child_id}", response_model=ChildOut)
def get_child(
    child_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> ChildOut:
    child = db.get(Child, child_id)
    if child is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Child not found.")
    active = _active_map(db, [child.id]).get(child.id)
    return child_out(child, active)
