# wxmap

Weather map dashboard with a TypeScript backend and React frontend.

## Workspace layout

- `packages/backend` - Express API server
- `packages/frontend` - React + Vite web app

## Quick start

1. Install dependencies at the repo root.
2. Run backend and frontend dev servers from workspace scripts.

## Environment

Create and update:

- `packages/backend/.env`
- `packages/frontend/.env`

Both template files are included with safe placeholders.

### Optional dev admin bootstrap

For local testing of admin-only API/UI features, set these in `packages/backend/.env`:

- `DEV_BOOTSTRAP_ADMIN=true`
- `DEV_ADMIN_USERNAME=<username>`
- `DEV_ADMIN_EMAIL=<email>`
- `DEV_ADMIN_PASSWORD=<password with at least 8 chars>`

On startup, backend seeding will create an admin user if it does not already exist.
