# KELO architecture decisions

## Account model

Kelo یک حساب کاربری واحد دارد. کاربر هنگام ورود نقش تجاری «کشاورز» یا «ماشین‌دار» انتخاب نمی‌کند.

- ثبت Request => کاربر در آن transaction درخواست‌دهنده است.
- ثبت Service Listing / Machine => کاربر در آن transaction ارائه‌دهنده است.
- یک حساب می‌تواند هر دو نوع فعالیت را داشته باشد.
- فقط نقش‌های سیستمی مانند admin/support/superadmin برای authorization نگهداری می‌شوند.

## Deployment model

### Development / preview

- GitHub: source control
- Vercel: preview / UI testing
- اگر `/api/health` در دسترس نباشد، UI به local demo fallback می‌کند.

### Production target

- Domain: `kelo.ir`
- Nginx: TLS termination + reverse proxy
- Node/Express: frontend host + API
- PostgreSQL: persistent data

## Authentication phase

Current phase is the first real persistence step:

`Login → Server Session Cookie → users table → PostgreSQL`

- session token is random and stored hashed in PostgreSQL.
- browser receives only an HttpOnly cookie.
- profile updates go to `/api/me` and PostgreSQL.
- commercial roles remain context-based, not account-level.

The current UI still uses phone + national ID to avoid changing the existing form. Production OTP/SMS is a separate next step.

## Later phases

1. OTP/SMS
2. Domain tables for machines/listings/requests/bookings/deals
3. Atomic acceptance in PostgreSQL
4. Payment gateway
5. Admin panel
6. notifications, audit, monitoring, backups
