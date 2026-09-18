# KELO PostgreSQL

## Current step
This native PostgreSQL layer implements real user persistence and server-side sessions for the VPS deployment.

### Tables in this step
- `users`
- `profiles`
- `user_roles`
- `user_sessions`

Commercial roles are not stored on a user. A single account can later create requests and/or service listings.

## Apply on a VPS
```bash
export DATABASE_URL='postgresql://kelo:YOUR_PASSWORD@127.0.0.1:5432/kelo'
psql "$DATABASE_URL" -f database/migrations/001_auth.sql
```

The session store uses the schema expected by `connect-pg-simple` and is also safe to be auto-created by the application if needed.
