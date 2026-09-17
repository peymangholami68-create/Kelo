# Kelo production checklist

This repository now targets the final self-hosted architecture. The checklist below shows what remains before opening `kelo.ir` to real users.

## Foundation already in the repo

- [x] One account model; no commercial role selection at login
- [x] Frontend/backend boundary
- [x] Node/Express server foundation
- [x] PostgreSQL/PostGIS schema
- [x] Atomic first-acceptance database function
- [x] Docker + Nginx deployment foundation
- [x] Vercel-compatible static test mode
- [x] No secrets committed

## Still required before real production

- [ ] Real phone OTP provider
- [ ] Real session/auth implementation
- [ ] Move user/request/machine persistence from localStorage to the API
- [ ] Server-side authorization for every private endpoint
- [ ] File/object storage for photos and documents
- [ ] Complete request matching API
- [ ] Complete booking/deal state APIs
- [ ] Payment gateway + callback verification
- [ ] SMS notifications
- [ ] Admin web module
- [ ] Backups and restore drill
- [ ] HTTPS certificates and DNS for `kelo.ir`
- [ ] Monitoring, logs and alerting
- [ ] Rate-limit tuning and abuse controls
- [ ] Privacy/terms/legal pages

Do not mark Kelo as production-ready merely because the Docker stack starts. The browser must stop being the source of truth before live transactions are enabled.
