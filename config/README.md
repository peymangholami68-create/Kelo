# Configuration

`config/kelo-config.js` فقط تنظیمات عمومی اجرای Frontend را دارد و هیچ secret واقعی نباید در آن قرار بگیرد.

- `mode: auto` برای همان Repository مشترک بین Vercel Test و VPS Production است.
- در Vercel که `/api/health` وجود ندارد، برنامه به Prototype محلی fallback می‌کند.
- روی VPS که `/api/health` موجود است، Login/Session واقعی فعال می‌شود.

Secretهای Backend فقط در `.env` روی VPS قرار می‌گیرند و `.env` نباید وارد GitHub شود.
