# KELO config

`kelo-config.js` contains browser-safe configuration only.

- `backendMode: 'auto'` => use `/api/*` when the VPS backend responds; otherwise keep local demo mode.
- `apiBaseUrl: ''` => same-origin API in production (`kelo.ir/api/...`).

No database URL, password or service secret belongs here.
