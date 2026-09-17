# KELO runtime configuration

The browser config contains public/non-secret values only.

Development / current Vercel preview:
- `mode: local`
- browser data is still stored locally for compatibility.

Production VPS:
- `mode: api`
- `api.baseUrl: ''` is preferred when Node serves the frontend and API on the same origin.
- secrets remain server-side in `.env` and are never placed in browser code.
