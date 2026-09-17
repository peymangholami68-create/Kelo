# KELO Supabase foundation

این پوشه قرارداد Backend کلو را نگه می‌دارد. در این مرحله Frontend هنوز در حالت `local` کار می‌کند تا UI فعلی بدون credential خارجی قابل تست بماند؛ اما Schema و منطق اتمیک پذیرش از قبل برای Backend واقعی آماده شده‌اند.

## ترتیب راه‌اندازی

1. یک پروژه Supabase بسازید.
2. Supabase CLI را نصب کنید.
3. پروژه را با CLI به پروژه Supabase متصل کنید.
4. migration داخل `migrations/202609170001_initial_schema.sql` را به‌عنوان اولین migration ثبت/اعمال کنید.
5. Phone Auth/OTP را در Supabase تنظیم کنید.
6. Storage buckets موردنیاز را بسازید.
7. فقط URL و anon key را در config/environment قرار دهید. `service_role` هرگز نباید در Frontend قرار بگیرد.

Supabase توصیه می‌کند schema changes در migration files نسخه‌بندی شوند و migrationها در Git نگهداری شوند.
