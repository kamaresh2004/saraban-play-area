"""Default pricing, settings and demo accounts.

The seed script (phase 2) copies these values into the database. Prices are a
snapshot on every visit, so admins can edit them later without changing old
bills. Passwords below are intentionally public demo credentials.
"""

from __future__ import annotations

from decimal import Decimal

DEFAULT_PLANS: tuple[dict[str, object], ...] = (
    {
        "code": "play-30",
        "name": "30 Minutes",
        "price": Decimal("150.00"),
        "duration_minutes": 30,
        "sort_order": 1,
    },
    {
        "code": "play-60",
        "name": "1 Hour",
        "price": Decimal("250.00"),
        "duration_minutes": 60,
        "sort_order": 2,
    },
    {
        "code": "play-day",
        "name": "Full Day",
        "price": Decimal("500.00"),
        "duration_minutes": None,  # until closing time
        "sort_order": 3,
    },
)

DEFAULT_SETTINGS: dict[str, object] = {
    "business_name": "Saraban Play Area",
    "business_tagline": "Play • Learn • Celebrate",
    "business_address": "2nd Floor, Lakeview Arcade, 14 Park Street, Kolkata 700016",
    "business_phone": "+91 98300 12345",
    "bill_footer": "Thank you for playing with us. See you soon!",
    "closing_time": "20:00",  # IST
    "grace_minutes": 5,
    "overtime_rate": Decimal("50.00"),  # per started block
    "overtime_block_minutes": 15,
    "clock_offset_minutes": 0,
}

# Demo-only credentials shown on the login screen.
DEMO_ACCOUNTS: tuple[dict[str, str], ...] = (
    {
        "username": "admin",
        "password": "admin123",
        "full_name": "Aarav Sen",
        "role": "admin",
    },
    {
        "username": "reception",
        "password": "reception123",
        "full_name": "Priya Nair",
        "role": "reception",
    },
)
