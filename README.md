# wxmap

Weather map dashboard with a TypeScript backend and React frontend.

## Workspace layout

- `packages/backend` - Express API server
- `packages/frontend` - React + Vite web app

## Quick start

1. Install dependencies at the repo root.
2. Create local `.env` files from tracked templates.
3. Start backend and frontend in separate terminals.
4. Verify health and open the app in your browser.

### Setup commands (PowerShell)

- `npm install`
- `Copy-Item .env.example .env -Force`
- `Copy-Item packages/backend/.env.example packages/backend/.env -Force`
- `Copy-Item packages/frontend/.env.example packages/frontend/.env -Force`
- `npm run dev:backend`
- `npm run dev:frontend`

Frontend: `http://localhost:5173/`

Backend health: `npm run health:backend`

## Run instructions

Use two terminals from the repository root:

- Terminal 1: `npm run dev:backend`
- Terminal 2: `npm run dev:frontend`

When both are running:

- Frontend UI: `http://localhost:5173/`
- Backend health: `http://localhost:3001/api/v1/health`

## Verify everything is working

- Health check command: `npm run health:backend`
- Type-check/lint: `npm run lint`
- Tests: `npm test`
- Production build: `npm run build`

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

## Deploy on Linux (Ubuntu/Debian)

Node.js 20 LTS + nginx are recommended for both approaches below.

### Shared prep (both approaches)

- Clone repo to a deploy path (example: `/opt/wxmap`).
- Install dependencies from repo root: `npm install`.
- Create env files from templates:
  - `cp .env.example .env`
  - `cp packages/backend/.env.example packages/backend/.env`
  - `cp packages/frontend/.env.example packages/frontend/.env`
- Build production assets: `npm run build`.

### Option A: Single-box deployment (frontend + backend on one Linux host)

1. Run backend with systemd.

Service file: `/etc/systemd/system/wxmap-backend.service`

```ini
[Unit]
Description=wxmap backend
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/wxmap/packages/backend
Environment=NODE_ENV=production
EnvironmentFile=-/opt/wxmap/packages/backend/.env
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=3
User=www-data
Group=www-data

[Install]
WantedBy=multi-user.target
```

2. Enable/start backend service:

- `sudo systemctl daemon-reload`
- `sudo systemctl enable wxmap-backend`
- `sudo systemctl start wxmap-backend`
- `sudo systemctl status wxmap-backend`

3. Serve frontend via nginx from `packages/frontend/dist`.
4. In nginx, proxy `/api/` and `/ws` to `http://127.0.0.1:3001`.
5. Set frontend env for same-host routing (example values):

- `VITE_API_BASE_URL=/api/v1`
- `VITE_WS_URL=/ws`

Single-box nginx site example (`/etc/nginx/sites-available/wxmap`):

```nginx
server {
  listen 80;
  server_name _;

  root /opt/wxmap/packages/frontend/dist;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }

  location /api/ {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location /ws {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
  }
}
```

### Option B: Split deployment (frontend and backend on separate hosts)

1. Deploy backend host:

- Use systemd steps above on backend server.
- Expose backend via TLS domain (example: `https://api.example.com`).

2. Deploy frontend host:

- Serve `packages/frontend/dist` from nginx/static hosting.

3. Set frontend env for remote API/WebSocket:

- `VITE_API_BASE_URL=https://api.example.com/api/v1`
- `VITE_WS_URL=wss://api.example.com/ws`

4. Configure backend CORS to allow the frontend origin(s).
5. Ensure reverse proxy/load balancer forwards WebSocket upgrade headers.

Backend nginx reverse proxy example (`api.example.com`):

```nginx
server {
  listen 80;
  server_name api.example.com;

  location /api/ {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location /ws {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
  }
}
```

Frontend nginx static host example (`app.example.com`):

```nginx
server {
  listen 80;
  server_name app.example.com;

  root /var/www/wxmap;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

### Post-deploy checks

- `https://<backend-host>/api/v1/health` returns healthy response.
- Frontend loads without console CORS or network errors.
- WebSocket connection succeeds and receives live updates.

## Troubleshooting

### Backend falls back to in-memory store

If backend logs mention SQLite bindings are unavailable, rebuild the native dependency from repo root:

- `npm run rebuild:sqlite`

If the rebuild fails with a Windows `EBUSY`/`EPERM` lock on `better_sqlite3.node`, stop the running backend dev server first, then run the rebuild command again.

Then restart the backend dev server.

### Quick backend health check

From repo root, print the current backend health payload:

- `npm run health:backend`

## Additional documentation

- Local development runbook: `docs/running-locally.md`
