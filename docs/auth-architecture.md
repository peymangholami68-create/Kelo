# KELO Authentication → Session → Users → PostgreSQL

## Browser
The existing login UI is preserved. It still asks for mobile number + national ID so the current design does not change.

## Production/VPS flow
```text
Browser
  → POST /api/auth/login
  → Express validates phone/national ID
  → PostgreSQL users/profiles
  → server-side session in user_sessions
  → HttpOnly kelo.sid cookie
```

The browser never stores the authenticated user ID as the source of truth in production.

## Static Vercel test
If `/api/health` is not present, the frontend automatically falls back to the existing localStorage prototype. This keeps the current Vercel test environment usable until the VPS is deployed.

## Production note
The current UI still uses phone + national ID because that is the flow already present in the supplied Kelo code. Before public launch, replace the national-ID-as-login-secret with SMS OTP while keeping the same server-side session architecture.
