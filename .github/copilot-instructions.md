# Copilot Instructions for wxmap

## Project Overview

**wxmap** is a full-featured weather map and dashboard inspired by the Windy app. It displays real-time and historical weather data from multiple providers on an interactive map with animated radar overlays, color-smoothed metric visualizations, and a fully customizable user control panel.

### Key Goals
- Interactive weather map with zoom/pan and smooth color-gradient metric overlays
- Full-motion animated radar loop from NOAA/NWS tiles, fully user-configurable
- Live weather station data aggregated from multiple third-party providers
- Local database storage of observations at 5- and 10-minute intervals for historical charting
- WebSocket-based real-time updates to connected clients
- Multi-role authentication (standard users and admins)
- Admin panel for system configuration and data-source management

---

## Repository Structure

```
wxmap/
├── .github/
│   └── copilot-instructions.md   # This file
├── packages/
│   ├── backend/                  # Express.js + SQLite API server
│   │   ├── src/
│   │   │   ├── db/               # Database schema, migrations, queries
│   │   │   ├── providers/        # One module per weather data source
│   │   │   ├── routes/           # REST API route handlers
│   │   │   ├── services/         # Background collector, WebSocket broadcaster
│   │   │   ├── middleware/       # Auth (JWT), error handling, validation
│   │   │   └── index.ts          # Entry point
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── frontend/                 # React + Vite + TypeScript + Tailwind
│       ├── src/
│       │   ├── components/       # Reusable UI components
│       │   ├── pages/            # Route-level page components
│       │   ├── hooks/            # Custom React hooks
│       │   ├── store/            # State management (Zustand or Redux Toolkit)
│       │   ├── services/         # API client, WebSocket client
│       │   └── main.tsx          # Entry point
│       ├── package.json
│       └── vite.config.ts
├── package.json                  # Root workspace config (npm workspaces or pnpm)
└── README.md
```

> **Note:** This structure is the intended layout. Add files inside the appropriate package as development progresses.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend runtime | Node.js (LTS) |
| Backend framework | Express.js |
| Backend language | TypeScript |
| Database | SQLite via `better-sqlite3` |
| Authentication | JWT (`jsonwebtoken`) + bcrypt for password hashing |
| Real-time | `ws` WebSocket library |
| Frontend framework | React 18+ |
| Frontend build | Vite |
| Frontend language | TypeScript |
| Styling | Tailwind CSS |
| Map rendering | Leaflet.js (`react-leaflet`) |
| Charts | Chart.js (`react-chartjs-2`) |
| HTTP client (FE) | `axios` or native `fetch` |

---

## Weather Data Providers

Priority order for integration:

1. **Wunderground (PWS)** — Personal Weather Station Network (requires API key)
2. **Ambient Weather** — Personal weather stations (requires API key + Application key)
3. **AcuRite** — Personal weather stations (requires AcuRite Atlas account)
4. **CWOP** — Citizen Weather Observer Program (free APRS feed)
5. **MADIS** — Meteorological Assimilation Data Ingest System (NOAA; free with registration)
6. **NWS / NOAA** — Official US observations, forecasts, and radar tiles (free, no key required)
7. Additional sources (lower priority): Open-Meteo, MesoWest/Synoptic, FindU, Gladstone

Each provider lives in its own module under `packages/backend/src/providers/`. A provider module **must** export:
- A `fetchObservations(stationId?: string): Promise<Observation[]>` function
- A `listStations(bbox?: BoundingBox): Promise<Station[]>` function (where applicable)

---

## Database Schema (SQLite)

Core tables to implement:

- **`stations`** — `id`, `provider`, `external_id`, `name`, `lat`, `lng`, `elevation_m`, `active`, `created_at`
- **`observations`** — `id`, `station_id` (FK), `observed_at`, `temp_c`, `humidity_pct`, `pressure_hpa`, `wind_speed_ms`, `wind_dir_deg`, `precip_mm`, `raw_json`
- **`users`** — `id`, `username`, `email`, `password_hash`, `role` (`user`|`admin`), `created_at`
- **`settings`** — `key` (PK), `value`, `updated_at`

Observations are written on every collection cycle (5- or 10-minute intervals). Index `observations(station_id, observed_at)` for efficient range queries.

---

## Background Data Collector

- A scheduler (use `node-cron` or `setInterval`) in `packages/backend/src/services/collector.ts` fetches all active providers on their configured intervals.
- New observations are upserted into the `observations` table.
- After each cycle, the WebSocket broadcaster pushes a lightweight update event to all connected clients.
- The collection interval per provider is configurable via the `settings` table (default: 5 minutes for PWS providers, 10 minutes for MADIS/NWS).

---

## REST API Routes

All routes are prefixed with `/api/v1`.

| Method | Path | Description |
|---|---|---|
| GET | `/weather/stations` | List stations (supports `bbox`, `provider`, `limit` query params) |
| GET | `/weather/stations/:id/observations` | Historical observations for a station |
| GET | `/weather/current` | Current conditions for all active stations |
| GET | `/radar/frames` | Available NWS radar frame URLs for a given `lat`/`lng` |
| POST | `/auth/register` | Register a new user |
| POST | `/auth/login` | Login and receive JWT |
| GET | `/admin/settings` | Retrieve all settings (admin only) |
| PUT | `/admin/settings/:key` | Update a setting (admin only) |
| GET | `/admin/providers` | List provider status and last-sync time (admin only) |

---

## Frontend Map Features

- **Base map:** OpenStreetMap tiles via Leaflet
- **Station markers:** Clustered icons colored by the selected metric (e.g., temperature heatmap)
- **Metric overlay:** Interpolated color gradient rendered on a `<canvas>` layer using IDW (Inverse Distance Weighting) or kriging
- **Radar overlay:** Animated NOAA/NWS CONUS and regional radar tiles played as a configurable loop
  - User can adjust: playback speed, time range (1 h / 3 h / 6 h / 12 h), radar site, opacity
- **User control panel (sidebar/bottom drawer):** Metric selector, provider filter, radar controls, time scrubber
- **Historical charts:** On station popup click, show a Chart.js line chart of the last N hours

---

## Development Setup

```bash
# Install dependencies (run from repo root)
npm install          # or: pnpm install

# Start backend dev server (with hot-reload)
npm run dev --workspace=packages/backend

# Start frontend dev server
npm run dev --workspace=packages/frontend

# Run all tests
npm test

# Lint all packages
npm run lint
```

> Update these commands as the build system is configured.

---

## Coding Conventions

- **Language:** TypeScript everywhere; avoid `any` — use proper interfaces and `unknown` with type guards.
- **File naming:** `camelCase` for modules, `PascalCase` for React components and their files.
- **Functions:** Single responsibility — one function does one thing. Keep functions short (< 40 lines where practical).
- **Async:** Always use `async/await`; avoid raw `.then()` chains.
- **Error handling:** Use typed error classes; surface meaningful HTTP status codes from API routes; log unexpected errors with a structured logger (e.g., `pino`).
- **Comments:** Write comments for *why*, not *what*. Self-documenting code preferred.
- **Tests:** Co-locate unit tests as `*.test.ts` next to the source file. Integration tests live in `tests/`.
- **Imports:** Use absolute path aliases (`@backend/`, `@frontend/`) configured in each `tsconfig.json`.

---

## Security

- **Never** commit API keys, passwords, or secrets to the repository.
- All sensitive configuration (API keys, JWT secret, DB path) must come from **environment variables** (use a `.env` file locally; `.env` is gitignored).
- Validate and sanitize **all** data received from external weather APIs before writing to the database — do not trust provider field shapes.
- Use parameterized queries (`better-sqlite3` prepared statements) — never string-interpolate SQL.
- JWT tokens must be short-lived (e.g., 15 min access + 7 day refresh). Enforce HTTPS in production.
- Admin routes must verify `role === 'admin'` server-side in middleware; never rely on the client to restrict access.
- Rate-limit outbound API calls to respect provider ToS; use exponential back-off on errors.

---

## Environment Variables

Create `packages/backend/.env` (gitignored) with at least:

```
PORT=3001
JWT_SECRET=<random-256-bit-hex>
DATABASE_PATH=./data/wxmap.db

# Weather provider API keys
WUNDERGROUND_API_KEY=
AMBIENT_WEATHER_API_KEY=
AMBIENT_WEATHER_APP_KEY=
ACURITE_USERNAME=
ACURITE_PASSWORD=
```

The frontend uses a `.env` file at `packages/frontend/.env`:

```
VITE_API_BASE_URL=http://localhost:3001/api/v1
VITE_WS_URL=ws://localhost:3001
```

---

## Contribution Workflow

1. Open an issue before starting significant work.
2. Branch from `main`; name branches `feature/<short-description>` or `fix/<short-description>`.
3. Keep PRs focused — one feature or fix per PR.
4. All PRs must pass lint and tests before merging.
5. Squash-merge to keep the `main` history clean.
