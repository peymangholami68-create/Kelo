# KELO architecture decisions

## Account model

Kelo یک حساب کاربری واحد دارد. کاربر هنگام ورود نقش تجاری «کشاورز» یا «ماشین‌دار» انتخاب نمی‌کند.

- ثبت Request => کاربر در آن transaction درخواست‌دهنده است.
- ثبت Service Listing / Machine => کاربر در آن transaction ارائه‌دهنده است.
- یک حساب می‌تواند هر دو نوع فعالیت را داشته باشد.
- فقط نقش‌های سیستمی مانند admin/support/superadmin برای authorization نگهداری می‌شوند.

## Deployment model

- GitHub: source control
- Vercel: frontend hosting / serverless edge
- Supabase: Postgres + Auth + Storage + RLS + backend functions
- Production domain: kelo.ir
- Current test deployment: kelo-marketplace.vercel.app

## Current phase

`Final_1_osm_fixed2.html` UI baseline بود. این بسته بدون تغییر اساسی در UI، آن را به ساختار چندفایلی تبدیل کرده و قرارداد Backend و schema واقعی Supabase را کنار آن قرار داده است.

The runtime remains `mode=local` until a real Supabase project is connected, so the current demo remains runnable.
