# KELO | بازار خدمات کشاورزی

این بسته نسخه‌ی چندفایلی و Backend-ready پروژه Kelo است که از `Final_1_osm_fixed2.html` ساخته شده است.

## وضعیت فعلی

- ظاهر و جریان‌های UI نسخه مرجع حفظ شده‌اند.
- فایل تک‌صفحه‌ای به `index.html` + CSS + JS تفکیک شده است.
- نقش تجاری ثابت برای کاربر حذف شده است؛ کاربر با یک حساب واحد می‌تواند هم Request ایجاد کند و هم Service Listing/ماشین ثبت کند.
- فقط System Roleها مانند `admin` برای کنترل دسترسی باقی می‌مانند.
- قرارداد Backend در `backend/kelo-backend.js` قرار دارد.
- Schema و RLS و تابع Atomic Acceptance در `supabase/migrations/` قرار دارد.
- برنامه فعلاً در `mode=local` می‌ماند تا بدون credential خارجی اجرا شود.

## اجرای تست

این پروژه استاتیک است و می‌تواند روی Vercel با همان روش فعلی deploy شود.

## Production transition

بعد از ساخت پروژه Supabase:

1. migration را اعمال کنید.
2. Phone OTP را تنظیم کنید.
3. Storage را تنظیم کنید.
4. مقادیر URL و anon key را از Environment Variables/Config وارد کنید.
5. لایه persistence/auth را از local به Supabase متصل کنید.
6. domain را از `kelo-marketplace.vercel.app` به `kelo.ir` منتقل کنید.

Vercel خودش می‌تواند Frontend و Functions را اجرا کند؛ داده‌ی دائمی باید در یک datastore مانند Supabase/Postgres نگهداری شود.

## امنیت

هیچ secret واقعی داخل این repository قرار داده نشده است.
`service_role` نباید در کد مرورگر قرار بگیرد.
