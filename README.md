# KELO | بازار خدمات کشاورزی

این نسخه، مبنای Production کِلو برای استقرار روی VPS است و از UI فعلی `Final_1_osm_fixed2` ساخته شده است.

## مدل حساب کاربری

کِلو فقط **یک حساب کاربری** دارد. در زمان ورود، کاربر نقش «کشاورز» یا «ماشین‌دار» انتخاب نمی‌کند.

- ثبت درخواست => کاربر در آن تراکنش درخواست‌دهنده است.
- ثبت ماشین/ارائه خدمت => کاربر در آن تراکنش ارائه‌دهنده است.
- یک حساب می‌تواند هر دو فعالیت را داشته باشد.
- فقط نقش‌های سیستمی مانند `admin` برای authorization نگهداری می‌شوند.

## وضعیت فعلی

- UI اصلی حفظ شده است.
- Login/Session/Users به Backend واقعی متصل شده‌اند.
- در Production، session به‌صورت HttpOnly cookie مدیریت می‌شود و session در PostgreSQL نگهداری می‌شود.
- `users` و `sessions` در PostgreSQL قرار دارند.
- Profile و profileLocation از طریق `/api/me` در PostgreSQL ذخیره می‌شوند.
- در Vercel preview اگر API در دسترس نباشد، برنامه برای تست UI به حالت local برمی‌گردد.
- OTP واقعی هنوز مرحله بعدی است؛ UI فعلی همچنان شماره موبایل + کد ملی را می‌گیرد تا مسیر فعلی بدون بازطراحی حفظ شود.

## Production architecture

```text
GitHub
  ↓
Vercel (current preview/test)

Production:
kelo.ir
  ↓
Nginx
  ↓
Node / Express API
  ↓
PostgreSQL
```

فایل‌ها:

```text
server/index.js       API + static host
server/auth.js        Session/cookie/auth logic
server/db.js          PostgreSQL pool
server/migrate.js     Migration runner
server/create-admin.js Admin bootstrap

database/migrations/  SQL migrations
nginx/                 Reverse proxy example
```

برای وب‌اپلیکیشن، `node-postgres` با connection pool استفاده شده است؛ pool الگوی توصیه‌شده برای queryهای متعدد و همزمان است. citeturn342144search0turn342144search1

## راه‌اندازی روی VPS

1. PostgreSQL را آماده کنید یا `docker-compose.yml` را اجرا کنید.
2. `.env.example` را به `.env` تبدیل و مقدارهای واقعی را وارد کنید.
3. `npm install`
4. `npm run db:migrate`
5. برای ساخت مدیر: متغیرهای `KELO_ADMIN_NAME`, `KELO_ADMIN_PHONE`, `KELO_ADMIN_NATIONAL_ID` را موقتاً در محیط اجرای دستور قرار دهید و `npm run admin:create` را اجرا کنید.
6. `npm start`
7. Nginx را طبق `nginx/kelo.conf.example` تنظیم کنید و HTTPS را فعال کنید.

## نکته امنیتی

- `.env` نباید وارد GitHub شود.
- session در `HttpOnly` cookie است؛ JavaScript مرورگر token session را نمی‌بیند.
- `service_role` یا پسورد دیتابیس نباید در Frontend قرار بگیرد.
- OTP واقعی در مرحله بعد جایگزین ورود فعلی خواهد شد.
