"""Password hashing and JWT helpers.

Uses bcrypt directly (no passlib) and PyJWT. Passwords are demo credentials, but
they are still hashed at rest and never returned by the API.
"""

from __future__ import annotations

from datetime import timedelta

import bcrypt
import jwt
from jwt.exceptions import InvalidTokenError

from app.core.clock import now_utc
from app.core.config import settings
from app.models import User


def hash_password(password: str) -> str:
    # bcrypt only considers the first 72 bytes; truncate explicitly so long
    # inputs never raise on newer bcrypt releases.
    raw = password.encode("utf-8")[:72]
    return bcrypt.hashpw(raw, bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8")[:72], hashed_password.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def create_access_token(user: User) -> str:
    issued_at = now_utc()
    payload = {
        "sub": user.username,
        "uid": user.id,
        "role": user.role.value,
        "iat": issued_at,
        "exp": issued_at + timedelta(minutes=settings.access_token_expire_minutes),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def decode_access_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    except InvalidTokenError as exc:
        raise ValueError("Invalid or expired token") from exc
