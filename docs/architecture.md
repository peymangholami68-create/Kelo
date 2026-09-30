# KELO architecture decisions

## Account model

Kelo یک حساب کاربری واحد دارد. کاربر هنگام ورود نقش تجاری «کشاورز» یا «ماشین‌دار» انتخاب نمی‌کند.

- ثبت Request => کاربر در آن transaction درخواست‌دهنده است.
- ثبت Service Listing / Machine => کاربر در آن transaction ارائه‌دهنده است.
- یک حساب می‌تواند هر دو نوع فعالیت را داشته باشد.
- فقط نقش‌های سیستمی مانند `admin` / `support` / `superadmin` برای authorization نگهداری می‌شوند.

## Deployment model

### Current test
```text
GitHub → Vercel → kelo-marketplace.vercel.app
```
Vercel می‌تواند برای تست استاتیک استفاده شود؛ در صورت وجود API هم‌مبدأ، Frontend به حالت server می‌رود.

### Target production
```text
kelo.ir → VPS → Nginx → Node/Express → PostgreSQL
```

## Authentication flow

```text
Browser
  → POST /api/auth/login
  → Express
  → PostgreSQL users/profiles
  → server-side session in user_sessions
  → HttpOnly cookie: kelo.sid
```

در Production، session و PostgreSQL منبع حقیقت سمت سرور هستند. `localStorage` فقط برای draft/UI است و منبع داده Marketplace نیست.

## Current frontend compatibility

`backend/kelo-backend.js` ابتدا `/api/health` را بررسی می‌کند:

- اگر API در دسترس باشد → حالت `server` و Login واقعی فعال می‌شود.
- اگر API اصلاً وجود نداشته باشد (نسخه استاتیک فعلی Vercel) → حالت `local` و Prototype فعلی حفظ می‌شود.
- اگر API وجود داشته باشد ولی unhealthy باشد → fallback به دیتابیس جعلی انجام نمی‌شود.

## Current authentication credential

UI فعلی به‌منظور حفظ ظاهر و جریان موجود همچنان شماره موبایل + کد ملی را می‌گیرد. کد ملی در Backend به‌صورت lookup HMAC + verifier کند + ciphertext رمزگذاری‌شده نگهداری می‌شود.

برای انتشار عمومی Kelo، مرحله بعدی تبدیل ورود به SMS OTP است؛ session architecture فعلی حفظ می‌شود.

## Marketplace data flow (V06)

```text
Browser
  → Express API
  → PostgreSQL
  → requests / service_listings / request_recipients
  → atomic accept
  → bookings / deals
```

پذیرش درخواست با قفل سطری روی Request و Transaction سمت PostgreSQL انجام می‌شود تا دو ارائه‌دهنده نتوانند یک درخواست را همزمان قبول کنند.

---

## Frontend layered architecture (from Phase 0)

```text
UI (app.js / pages / sheets)
        │
        ▼
KeloService  (services/*)
        │
   ┌────┴────┐
   ▼         ▼
LocalAdapter  ApiAdapter
   │         │
 local DB   KeloBackend → REST API
```

Phase 0 only introduces the skeleton (`core/`, `adapters/` stubs, `services/kelo-service.js`).
Baseline for this refactor: **Kelo36-CG2**.
Domain migration starts at Phase 1 (Auth).
