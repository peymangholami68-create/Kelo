# KELO production checklist

## Completed in V06
- Native PostgreSQL marketplace schema aligned with the existing auth schema.
- Requests, service listings, recipients, bookings, deals, payments and notifications tables.
- Transactional first-acceptance function with request row locking.
- Express API for requests, listings, matching, recipients, accept/reject, cancel and complete.
- Frontend marketplace writes use the API when the server is available; localStorage remains only a prototype/draft cache.
- Server bootstrap endpoint hydrates the UI from PostgreSQL after login/session restore.
- A two-browser smoke-test script is included: `npm run smoke:two-users`.

## Still requires real credentials/infrastructure
- Kavenegar OTP.
- Zarinpal initiation/callback/verify.
- VPS + Nginx + TLS.
- `kelo.ir` DNS/domain.
- Production file/object storage for machine/listing photos.
- Admin dashboard API/UI hardening.
- Final browser acceptance test against the real VPS/PostgreSQL instance.
