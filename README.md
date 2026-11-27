# Saraban Play Area

A premium, demo-ready management app for a children's indoor play area:
registration and QR passes, live play timers with alerts, automatic billing,
printable 80 mm bills, daily reports, and an owner dashboard.

Built as a monorepo with a **FastAPI + SQLite** backend and a **React + Vite +
TypeScript** frontend. The backend is the single source of truth for time and
money; the browser never calculates a bill on its own.

![Palette](https://img.shields.io/badge/palette-teal%20%231C93A0%20%2F%20navy%20%231C202B-1C93A0)
![Status](https://img.shields.io/badge/status-demo%20build-16A34A)

## Features

### Front desk
- **Login** with hashed passwords and JWT sessions (`admin` / `reception`).
- **Child registration** with parental consent, 10-digit phone validation and
  duplicate-child protection. Each child gets a unique QR pass, printable from
  a dedicated dialog.
- **Phone lookup** so returning families and siblings are found instantly.
- **QR or manual check-in**: pick a plan (30 min / 1 hour / full day) and the
  server snapshots the price on the visit and starts the timer.
- **Live floor** with per-second timers, sorted by least time left. Cards turn
  **amber at 10 minutes** and **red when overdue**; header bell and toasts
  surface new alerts.
- **Checkout** with a server-calculated bill preview, optional flat or
  percentage discount (capped safely), Cash/UPI selection, and a confirmation
  dialog.
- **80 mm thermal receipt** with business header, visit details, overtime,
  discount, total and payment method. Print-ready CSS hides everything else.

### Owner
- **Dashboard**: inside now, ending-soon/overdue counts, today's collection
  split (cash/UPI), visits, average play time, 7-day visits + collection chart,
  recent payments, and inline plan price editing.
- **Demo clock**: move the application clock forward or back 15 minutes (or
  reset) to demonstrate overtime, alerts and billing instantly.
- **Settings**: business name/tagline/address/phone, receipt footer, closing
  time, grace period, overtime rate and overtime block size; plan prices and
  active/hidden toggles.
- **Daily reports**: collection, bills, visits, playtime, cash/UPI split,
  average bill, every receipt for the selected IST day, and CSV export.
- Reception is blocked from the dashboard, settings, plan editing and demo
  clock controls, both in navigation and on the server.

### UX
- Teal / navy / amber palette with Inter, rounded cards, soft shadows and
  subtle Framer Motion transitions.
- Desktop/tablet sidebar; phone bottom navigation and full-screen menu dialog.
- Large reception-friendly buttons, loading skeletons, empty states, error
  states with retry, toasts, inline validation, confirmation dialogs.
- ₹ amounts with Indian digit grouping; all dates and times in Asia/Kolkata.

## Stack

| Layer | Technology |
| --- | --- |
| Backend | Python 3.11+, FastAPI, SQLAlchemy 2, Pydantic 2, SQLite, PyJWT, bcrypt |
| Frontend | React 19, Vite 7, TypeScript 5.9, Tailwind CSS 3.4 |
| Routing / data | React Router 7, TanStack Query 5 |
| UI / motion | Framer Motion, lucide-react, Recharts |
| QR | `html5-qrcode` (camera scanner), `qrcode.react` (pass generator) |
| Money | `Decimal` / `NUMERIC(12,2)`, JSON numbers, ₹ formatter |
| Time | naive UTC in SQLite, IST (`Asia/Kolkata`) in the API and UI |

## Quick start

Run the backend and frontend in two terminals.

### 1. Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt

# Create and fill the demo database (drops existing data)
python -m app.seed

# Start the API on http://127.0.0.1:8000
python -m uvicorn app.main:app --reload --port 8000
```

macOS/Linux equivalents use `source .venv/bin/activate`. If PowerShell blocks
activation, run once:
`Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

Copy `backend/.env.example` to `backend/.env` only if you want to change the
secret, CORS origins or database URL. The built-in demo defaults work as-is.

### 2. Frontend

```powershell
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**.

The frontend reads `VITE_API_URL` and defaults to
`http://localhost:8000/api`. To point at another API:

```powershell
$env:VITE_API_URL = "http://127.0.0.1:8000/api"
npm run dev
```

### Demo accounts

| Username | Password | Role |
| --- | --- | --- |
| `admin` | `admin123` | Owner / admin |
| `reception` | `reception123` | Reception staff |

Both are listed on the login screen; click a card to fill the form.

## Demo walkthrough

1. Sign in as **admin** to see the dashboard: 6 children inside, a 7-day chart,
   today's collection, recent bills and prices.
2. Use **+15 min** on the demo clock, then open **Live floor** — timers jump,
   cards turn amber/red and alert toasts/bell update. Press **Reset to real
   time** when done.
3. Open **Check in**, search `9830012345` (Aarav/Rhea Mehta) or scan a pass.
   Pick a plan and start the timer.
4. Open any live card, apply a discount, choose Cash or UPI and check out.
   The receipt page prints at 80 mm.
5. Open **Reports** to see the new bill in today's totals and export the CSV.
6. Sign out and sign in as **reception** — dashboard/settings disappear and
   direct URLs redirect back to the live floor.

`python -m app.seed` restores the original 17 children, 6 active visits and 28
bills at any time.

## Business rules

- **Plans**: 30 min ₹150, 1 hour ₹250, full day ₹500 (editable by the owner).
  The full-day plan runs until the configured closing time.
- **Price snapshot**: each visit stores `plan_code`, `plan_name` and
  `plan_price` at check-in. Later price edits never change old visits or bills.
- **Grace period**: default 5 minutes free after the booked time.
- **Overtime**: after grace, every **started** 15-minute block is ₹50.
  Example: 60-min plan played 65 min → free; 66 min → ₹50; 81 min → ₹100.
- **Discounts**: flat is capped at the subtotal; percentage is capped at 100%;
  the total can never be negative.
- **One active visit per child** is enforced by a partial unique index plus API
  checks, so double check-in returns a clear `409`.
- **Bills are immutable snapshots** of the child, parent, plan and totals, with
  a stable number `SB-YYYYMMDD-VISITID`.
- **Day boundaries** use the Asia/Kolkata calendar day, not the server's local
  time zone.
- **Demo clock** is a persisted global offset. The API reports `server_now`
  with a `+05:30` offset so the UI can anchor its timers.

## API overview

Base URL: `http://127.0.0.1:8000/api` · interactive docs at `/docs`.

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/auth/login` | `{ username, password }` → token + user |
| `GET` | `/auth/me` | Current staff profile |
| `GET` | `/children?phone=&q=` | Lookup by phone or name |
| `POST` | `/children` | Register child (consent required) |
| `GET` | `/children/qr/{qr}` | Resolve a scanned pass |
| `GET` | `/plans` | Active/inactive plans |
| `PATCH` | `/plans/{id}` | Admin: price, name, duration, visibility |
| `GET` | `/visits/active` | Live visits + counts + server time |
| `POST` | `/visits/check-in` | `{ child_id, plan_id }` |
| `GET` | `/visits/{id}` | Visit detail |
| `GET` | `/visits/{id}/quote` | `?discount_type=&discount_value=` |
| `POST` | `/visits/{id}/checkout` | Payment + discount → bill |
| `GET` | `/bills?limit=` | Recent bills |
| `GET` | `/bills/{id}` | Reprint a bill |
| `GET` | `/reports/daily?date=YYYY-MM-DD` | Daily totals + bills |
| `GET` | `/reports/daily.csv?date=` | CSV with BOM (Excel-friendly) |
| `GET` | `/dashboard` | Admin: KPIs, week, recent bills, plans |
| `GET` / `PATCH` | `/settings` | Read all staff / write admin |
| `POST` | `/demo/fast-forward` | Admin: `{ minutes }` |
| `POST` | `/demo/reset-clock` | Admin: offset back to 0 |

All endpoints except login require `Authorization: Bearer <token>`.
Admin-only routes return `403` for reception.

## Project structure

```text
.
├── README.md
├── render.yaml                   # Render Blueprint (API + static site)
├── backend/
│   ├── requirements.txt
│   ├── requirements-dev.txt
│   ├── .env.example
│   └── app/
│       ├── main.py               # FastAPI app + lifespan bootstrap
│       ├── models.py             # users, children, plans, visits, bills, settings
│       ├── schemas.py            # Pydantic I/O, IST & money serializers
│       ├── security.py           # bcrypt + JWT
│       ├── deps.py               # auth / admin dependencies
│       ├── seed.py               # realistic demo data
│       ├── core/
│       │   ├── clock.py          # IST <-> stored UTC + demo offset
│       │   ├── config.py
│       │   ├── database.py
│       │   └── defaults.py
│       ├── routers/              # auth, children, plans, visits, bills,
│       │                         # reports, dashboard, settings, demo
│       ├── services/             # billing engine, presenters, bootstrap
│       └── tests/                # billing unit tests + API flow tests
│   └── saraban.db                # generated, git-ignored
└── frontend/
    ├── index.html
    ├── package.json
    ├── tailwind.config.js
    ├── tsconfig.json
    ├── vite.config.ts
    ├── public/logo.png
    └── src/
        ├── components/           # buttons, cards, fields, dialogs, states…
        ├── context/              # auth + toast providers
        ├── features/             # live card, QR dialog, receipt, week chart
        ├── hooks/                # live polling, ticking, debouncing
        ├── layouts/AppLayout.tsx # sidebar, top bar, bottom nav, alerts
        ├── lib/                  # API client, types, formatters, utils
        ├── pages/                # login, children, check-in, live, checkout,
        │                         # bill, reports, dashboard, settings, 404
        ├── App.tsx               # routes + role guards
        ├── main.tsx              # QueryClient + providers
        └── index.css             # Tailwind layers + 80 mm print rules
```

## Verification

Backend tests (billing edge cases, role guards, full check-in → checkout →
report flow):

```powershell
cd backend
pip install -r requirements-dev.txt
python -m pytest -q
```

Frontend type-check and production build:

```powershell
cd frontend
npm run build
```

## Deploy to Render

The repository includes a [`render.yaml`](render.yaml) Blueprint with two free
services:

| Service | Type | URL |
| --- | --- | --- |
| `saraban-play-area-api` | Python web service (FastAPI + SQLite) | `https://saraban-play-area-api.onrender.com` |
| `saraban-play-area` | Static site (React build) | `https://saraban-play-area.onrender.com` |

1. Push the repository to GitHub.
2. In Render: **New → Blueprint**, connect the repository and apply the
   Blueprint. Render creates both services and wires `VITE_API_URL` to the API's
   public URL.
3. Wait for both builds to finish, then open the static site URL and sign in
   with the demo accounts.

Deployment notes:

- `DEMO_SEED_ON_STARTUP=true` re-creates the demo dataset whenever the free
  web service starts with an empty database, because Render's free tier uses
  ephemeral disk. The app also calls the idempotent bootstrap on every start.
- `CORS_ORIGIN_REGEX` allows any `*.onrender.com` origin, so the frontend can
  call the API without knowing its URL in advance.
- Free web services sleep after inactivity; the first request may take up to a
  minute. Data added during a session is lost when the service restarts. For a
  persistent deployment, attach a Render disk and point `DATABASE_URL` at it,
  or use a managed PostgreSQL database.

## Printing

The receipt page uses `@media print` with `@page { size: 80mm auto }`. Choose
the 80 mm thermal printer, disable browser headers/footers, and print. Only the
`.print-area` receipt is visible; buttons and page chrome are hidden.

## Notes for production

This is a demo build. Before real use: change `SECRET_KEY`, disable the demo
clock endpoints, replace SQLite with a production database, add audit logging
and backups, and serve the frontend build behind HTTPS.
