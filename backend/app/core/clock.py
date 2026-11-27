"""Time zone and clock helpers.

Rules enforced by this module:

* Everything persisted to SQLite is a **naive UTC** datetime.
* Everything shown to staff is **Asia/Kolkata** (IST).
* The demo "fast forward" feature shifts a single in-process offset, so every
  timestamp (in-time, out-time, bills, reports) stays internally consistent.
* Day boundaries for reports are computed on IST calendar days.
"""

from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
from threading import Lock
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

try:
    IST = ZoneInfo("Asia/Kolkata")
except ZoneInfoNotFoundError:  # Windows without the optional tzdata package
    # India has no daylight saving, so a fixed offset is exactly equivalent.
    IST = timezone(timedelta(hours=5, minutes=30), name="IST")

UTC = timezone.utc

_offset_minutes: int = 0
_offset_lock = Lock()


# ---------------------------------------------------------------------------
# Demo clock
# ---------------------------------------------------------------------------


def set_offset_minutes(minutes: int) -> None:
    """Shift the application clock. Used by the admin fast-forward demo button."""
    global _offset_minutes
    with _offset_lock:
        _offset_minutes = int(minutes)


def get_offset_minutes() -> int:
    return _offset_minutes


def add_offset_minutes(minutes: int) -> int:
    """Add to the current demo offset and return the new total."""
    global _offset_minutes
    with _offset_lock:
        _offset_minutes += int(minutes)
        return _offset_minutes


# ---------------------------------------------------------------------------
# Now
# ---------------------------------------------------------------------------


def now_utc() -> datetime:
    """Current application time as an aware UTC datetime."""
    return datetime.now(tz=UTC) + timedelta(minutes=_offset_minutes)


def now_local() -> datetime:
    """Current application time in Asia/Kolkata."""
    return now_utc().astimezone(IST)


def now_stored() -> datetime:
    """Current application time in the storage format (naive UTC)."""
    return utc_to_stored(now_utc())


def today_local() -> date:
    return now_local().date()


# ---------------------------------------------------------------------------
# Conversions
# ---------------------------------------------------------------------------


def utc_to_stored(value: datetime) -> datetime:
    """Convert an aware UTC datetime to naive UTC for SQLite."""
    if value.tzinfo is None:
        return value
    return value.astimezone(UTC).replace(tzinfo=None)


def stored_to_utc(value: datetime) -> datetime:
    """Interpret a stored naive datetime as UTC and attach the timezone."""
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def stored_to_local(value: datetime) -> datetime:
    """Convert a stored naive UTC datetime to aware IST."""
    return stored_to_utc(value).astimezone(IST)


def local_to_stored(value: datetime) -> datetime:
    """Convert an IST (or aware) datetime to stored naive UTC.

    Naive datetimes are interpreted as IST because every naive value coming
    from the application itself is already in storage format.
    """
    if value.tzinfo is None:
        value = value.replace(tzinfo=IST)
    return value.astimezone(UTC).replace(tzinfo=None)


# ---------------------------------------------------------------------------
# Reporting helpers
# ---------------------------------------------------------------------------


def local_day_bounds_utc(day: date) -> tuple[datetime, datetime]:
    """Return [start, end) of an IST calendar day as naive UTC datetimes."""
    start_local = datetime.combine(day, time.min, tzinfo=IST)
    end_local = start_local + timedelta(days=1)
    return local_to_stored(start_local), local_to_stored(end_local)


def minutes_between(start_stored: datetime, end_stored: datetime) -> int:
    """Whole minutes elapsed between two stored datetimes (never negative)."""
    delta = stored_to_utc(end_stored) - stored_to_utc(start_stored)
    return max(0, int(delta.total_seconds() // 60))


# ---------------------------------------------------------------------------
# Plans and closing time
# ---------------------------------------------------------------------------


def parse_hhmm(value: str) -> time:
    """Parse 'HH:MM' (24-hour) into a time object."""
    raw = (value or "").strip()
    try:
        hour_text, minute_text = raw.split(":", 1)
        hour = int(hour_text)
        minute = int(minute_text)
    except (ValueError, AttributeError) as exc:
        raise ValueError(f"Invalid time '{value}'. Expected HH:MM in 24-hour format.") from exc

    if not (0 <= hour <= 23 and 0 <= minute <= 59):
        raise ValueError(f"Invalid time '{value}'. Expected HH:MM in 24-hour format.")
    return time(hour=hour, minute=minute)


def closing_datetime_for(check_in_stored: datetime, closing_hhmm: str) -> datetime:
    """Compute the next closing time after a check-in, in naive UTC.

    A full-day plan checked in before closing ends at closing time the same IST
    day. A check-in at or after closing rolls over to the next day, so the
    plan always has a positive duration.
    """
    check_in_local = stored_to_local(check_in_stored)
    closing_local = datetime.combine(
        check_in_local.date(), parse_hhmm(closing_hhmm), tzinfo=IST
    )
    if closing_local <= check_in_local:
        closing_local += timedelta(days=1)
    return local_to_stored(closing_local)


def full_day_minutes(check_in_stored: datetime, closing_hhmm: str) -> int:
    """Booked minutes for a full-day plan (at least one minute)."""
    end = closing_datetime_for(check_in_stored, closing_hhmm)
    return max(1, minutes_between(check_in_stored, end))
