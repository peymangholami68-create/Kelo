# KELO | بازار خدمات کشاورزی

This repository is the **VPS-ready production foundation** of Kelo, built from the latest `Final_1_osm_fixed2` UI.

## Account model

Kelo has one user account. There is no commercial role selection at login.

A user can:
- create a Request and act as requester;
- create a Service Listing / Machine and act as provider;
- do both with the same account.

Only system roles such as `admin`, `support`, and `superadmin` are security/authorization roles.

## Environments

### Current test

`GitHub -> Vercel -> kelo-marketplace.vercel.app`

The current prototype stays in `mode=local`, so the existing UI can still be tested without an external database.

### Final production target

`GitHub -> VPS Iran -> Nginx -> Node/Express -> PostgreSQL/PostGIS -> kelo.ir`

Vercel is not required for the production deployment.

## What changed in this version

- Removed Supabase from the **active** architecture. The old Supabase foundation is kept under `legacy/supabase-foundation/` only for reference/rollback.
- Added a real Node/Express backend foundation.
- Added PostgreSQL/PostGIS migrations.
- Added migration runner and DB status scripts.
- Added Docker + Docker Compose for VPS deployment.
- Added Nginx reverse-proxy example for `kelo.ir`.
- Added browser `KeloBackend` adapter so UI code has a stable boundary between local prototype persistence and the future API.
- Added health/readiness endpoints and a public service catalog endpoint.
- Added rate limiting and security headers on the API server.
- Kept the visible UI and current local test behavior intact.

## Important current limitation

The frontend is **not yet switched to API persistence**. That is intentional. This release establishes the architecture first so we can migrate authentication/data operations without redesigning the UI.

## Local server

Requirements: Node 22+.

```bash
cp .env.example .env
# Set DATABASE_URL
npm install
npm run db:migrate
npm start
```

The web app will be served from `http://127.0.0.1:3000`.

## Docker / VPS

```bash
cp .env.example .env
# Set POSTGRES_PASSWORD and other production values

docker compose up -d --build
```

The app binds to `127.0.0.1:3000`; place Nginx in front of it and terminate TLS there.

## Secrets

Never commit:
- `.env`
- database passwords
- SMS API keys
- payment credentials
- session secrets
- provider service-role keys

Only `.env.example` belongs in Git.

## Source of truth

The current UI source is:
- `index.html`
- `css/kelo.css`
- `js/app.js`
- `js/preloader.js`

The old single-file source is kept in `legacy/Final_1_osm_fixed2.html`.
