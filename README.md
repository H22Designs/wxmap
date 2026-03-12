# wxmap

Weather map dashboard with a TypeScript backend and React frontend.

## Workspace layout

- `packages/backend` - Express API server
- `packages/frontend` - React + Vite web app

## Quick start

1. Install dependencies at the repo root.
2. Create local env files from the tracked templates.
3. Start backend and frontend dev servers.

### Setup commands (PowerShell)

- `npm install`
- `Copy-Item .env.example .env -Force`
- `Copy-Item packages/backend/.env.example packages/backend/.env -Force`
- `Copy-Item packages/frontend/.env.example packages/frontend/.env -Force`
- `npm run dev:backend`
- `npm run dev:frontend`

Frontend: `http://localhost:5173/`

Backend health: `npm run health:backend`

## Environment

Create and update (local only):

- `packages/backend/.env`
- `packages/frontend/.env`

Template files are committed with safe placeholders:

- `.env.example`
- `packages/backend/.env.example`
- `packages/frontend/.env.example`

### Optional dev admin bootstrap

For local testing of admin-only API/UI features, set these in `packages/backend/.env`:

- `DEV_BOOTSTRAP_ADMIN=true`
- `DEV_ADMIN_USERNAME=<username>`
- `DEV_ADMIN_EMAIL=<email>`
- `DEV_ADMIN_PASSWORD=<password with at least 8 chars>`

On startup, backend seeding will create an admin user if it does not already exist.

## Troubleshooting

### Backend falls back to in-memory store

If backend logs mention SQLite bindings are unavailable, rebuild the native dependency from repo root:

- `npm run rebuild:sqlite`

If the rebuild fails with a Windows `EBUSY`/`EPERM` lock on `better_sqlite3.node`, stop the running backend dev server first, then run the rebuild command again.

Then restart the backend dev server.

### Quick backend health check

From repo root, print the current backend health payload:

- `npm run health:backend`
