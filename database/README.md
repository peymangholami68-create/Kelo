# KELO PostgreSQL / PostGIS

This is the active database source of truth for the VPS architecture.

The schema uses PostgreSQL + PostGIS because Kelo's matching and map features depend on geographic points/areas.

## Migration runner

Set `DATABASE_URL` and run:

```bash
npm run db:migrate
```

Migrations are applied in filename order and tracked in `schema_migrations`.

## Docker / VPS

`docker compose up -d --build` starts:

1. PostgreSQL/PostGIS
2. a one-shot migration container
3. the Kelo Node backend

The migration container is deliberately separate from PostgreSQL's first-boot init scripts, so migration history remains explicit and repeatable.

## Current browser limitation

The UI is intentionally still in `mode=local` for Vercel testing. `localStorage` is not the production source of truth. The next integration phase will move authentication and business data behind the API.
