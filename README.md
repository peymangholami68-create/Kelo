# KELO | بازار خدمات کشاورزی

این Repository نسخه‌ی چندفایلی Kelo است و اکنون مرحله‌ی **Login → Session → Users → PostgreSQL** به‌صورت واقعی برای استقرار روی VPS آماده شده است.

## معماری

### تست فعلی
```text
GitHub
  ↓
Vercel
  ↓
kelo-marketplace.vercel.app
```

### هدف Production
```text
kelo.ir
   ↓
Nginx
   ↓
Node / Express
   ↓
PostgreSQL
```

## مدل حساب کاربری

Kelo فقط یک حساب کاربری دارد. در هنگام ورود، کاربر farmer/provider انتخاب نمی‌کند.

- ایجاد Request → نقش کاربر در آن معامله «درخواست‌دهنده» است.
- ایجاد Machine / Service Listing → نقش کاربر در آن فعالیت «ارائه‌دهنده» است.
- یک حساب می‌تواند هر دو را داشته باشد.
- فقط System Roleهایی مانند admin برای authorization وجود دارند.

## Login واقعی

UI فعلی تغییر اساسی نکرده و همچنان شماره موبایل + کد ملی را می‌گیرد. در VPS:

```text
POST /api/auth/login
       ↓
PostgreSQL users + profiles
       ↓
server-side session
       ↓
HttpOnly cookie: kelo.sid
```

Session در PostgreSQL نگهداری می‌شود و Browser فقط session ID را در cookie دارد. `express-session` برای production با store سمت سرور طراحی شده و `connect-pg-simple` session table مبتنی بر PostgreSQL را فراهم می‌کند.

## رفتار مشترک Vercel و VPS

`backend/kelo-backend.js` ابتدا `/api/health` را بررسی می‌کند:

- **API موجود** → Login واقعی و PostgreSQL.
- **API اصلاً وجود ندارد** → Prototype `localStorage` برای تست Vercel.
- **API وجود دارد ولی unhealthy است** → خطا؛ برنامه به دیتابیس جعلی fallback نمی‌کند.

بنابراین یک Repository می‌تواند برای هر دو محیط استفاده شود، بدون بازنویسی UI.

## دیتابیس فعلی

Migration فعلی:

```text
database/migrations/001_auth.sql
```

جداول:

```text
users
profiles
user_roles
user_sessions
```

کد ملی:
- `national_id_lookup` = HMAC برای uniqueness/lookup
- `national_id_verifier` = verifier کند برای احراز
- `national_id_ciphertext` = نسخه رمزگذاری‌شده برای زمانی که UI به مقدار نیاز دارد

## نصب روی VPS

### Docker

```bash
cp .env.example .env
# secretها را با مقادیر تصادفی واقعی جایگزین کنید
docker compose up --build -d
```

### بدون Docker

```bash
npm install
export DATABASE_URL='postgresql://kelo:YOUR_PASSWORD@127.0.0.1:5432/kelo'
export SESSION_SECRET='LONG_RANDOM_SECRET'
export NATIONAL_ID_ENCRYPTION_KEY='64_HEX_CHAR_SECRET'
psql "$DATABASE_URL" -f database/migrations/001_auth.sql
npm start
```

## نکته مهم برای Production

UI فعلی برای حفظ نسخه موجود هنوز **شماره موبایل + کد ملی** را به‌عنوان ورودی Login می‌گیرد. این مرحله اتصال واقعی PostgreSQL/Session را کامل می‌کند؛ برای انتشار عمومی، قدم بعدی باید جایگزینی کد ملی در Login با **SMS OTP** باشد.

هیچ `.env` واقعی، Password یا Secret نباید وارد GitHub شود؛ فقط `.env.example` باید در Repository باقی بماند.
