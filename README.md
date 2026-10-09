# CareRoster — NDIS Care & Rostering Platform

Phase 1 web app for an NDIS support organisation: rostering, participant/worker
management, shift check-in/out with geolocation, progress notes, incidents,
client requests, timesheets and a problems-first manager dashboard.

## Stack

- **Backend** — FastAPI + SQLite (SQLAlchemy), session-cookie auth, role-based
  access (admin / manager / worker / participant), org-scoped data, audit log.
- **Frontend** — React 19 + TypeScript + Vite + Tailwind v4, built into
  `app/static` and served by the same FastAPI app (one deploy, one URL).

## Local dev

```bash
# backend (port 8000)
python3 -m venv .venv && .venv/bin/pip install -e .
.venv/bin/python -m uvicorn app.main:app --reload

# frontend dev server (port 5173, proxies /api to 8000)
cd web && npm install && npm run dev

# production build: builds SPA into app/static
cd web && npm run build
```

Demo org "Demo Care Co" is seeded on first boot. Demo logins (password
`demo1234`): `admin@demo.care`, `manager@demo.care`, `sarah@demo.care`,
`dave@demo.care` (workers), `john@demo.care` (participant).

## Deploy

Single service: FastAPI serves `/api/*` plus the built SPA. Set
`NDIS_DB_PATH` (default `data/app.db`) to a path on a persistent volume.
