# KELO PostgreSQL

## Current step
This native PostgreSQL layer implements real user persistence, server-side sessions, and the Marketplace persistence layer for VPS deployment.

### Tables
- Auth: `users`, `profiles`, `user_roles`, `user_sessions`
- Marketplace: `service_types`, `machines`, `service_listings`, `requests`, `request_recipients`, `bookings`, `deals`, `payments`, `notifications`, `reviews`, `support_tickets`, `audit_logs`, `app_settings`

Commercial roles are not stored on a user. A single account can later create requests and/or service listings.

## Apply on a VPS
```bash
export DATABASE_URL='postgresql://kelo:YOUR_PASSWORD@127.0.0.1:5432/kelo'
node server/migrate.js
```

The session store uses the schema expected by `connect-pg-simple` and is also safe to be auto-created by the application if needed.
