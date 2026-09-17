# KELO API contract (foundation)

Base URL in production: `https://kelo.ir` (same-origin) or a dedicated API hostname later.

## Public endpoints

`GET /api/health`  
Returns service and database health.

`GET /api/ready`  
Returns 200 only when the API can reach PostgreSQL.

`GET /api/config`  
Returns non-secret runtime metadata.

`GET /api/services`  
Returns the active service catalog.

`GET /api/settings/public`  
Returns public app settings only.

## Reserved business endpoints

These are intentionally listed now so the frontend/backend boundary has stable names before full authentication is implemented:

- `POST /api/auth/request-otp`
- `POST /api/auth/verify-otp`
- `GET /api/me`
- `PATCH /api/me`
- `POST /api/requests`
- `GET /api/requests`
- `PATCH /api/requests/:id`
- `DELETE /api/requests/:id`
- `GET /api/requests/:id/matches`
- `POST /api/request-recipients`
- `POST /api/request-recipients/:id/accept`
- `POST /api/deals/:id/pay`
- `POST /api/deals/:id/cancel`
- `POST /api/deals/:id/complete`
- `GET /api/notifications`
- `POST /api/notifications/:id/read`

These are not exposed as unauthenticated placeholder endpoints. They will be implemented behind the real session/auth layer.
