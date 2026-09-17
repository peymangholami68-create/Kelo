# KELO production architecture

## 1. Account model

Kelo has one user account. The user does **not** choose a commercial role at login.

- Creating a Request makes the account the requester for that transaction.
- Creating a Service Listing / Machine makes the account a provider for that transaction.
- The same account may do both.
- System roles only (`admin`, `support`, `superadmin`) control privileged operations.

This distinction must be preserved in both the API and database.

## 2. Deployment model

### Development / prototype

`GitHub -> Vercel -> kelo-marketplace.vercel.app`

Vercel remains useful as a fast preview/test environment.

### Production target

`GitHub -> VPS Iran -> Nginx -> Node/Express -> PostgreSQL/PostGIS`

`kelo.ir` will point directly to the VPS when the production server is ready. Vercel is not required for production.

## 3. Storage model

- Persistent business data: PostgreSQL/PostGIS.
- Uploaded images/documents: object/file storage on the VPS or an S3-compatible storage service later.
- Browser `localStorage`: compatibility/demo only, not the production source of truth.

## 4. Backend boundary

The browser talks to `window.KeloBackend` rather than knowing database details.

Current default remains `mode: local` so the existing UI can still be previewed on Vercel.

Production switches to `mode: api`, pointing to the Node backend. This is an adapter change, not a UI rewrite.

## 5. Critical marketplace rule

Acceptance is serialized in PostgreSQL using a transaction and the `accept_request_recipient()` function. The shared Request row is the serialization point. This prevents two providers from winning the same request concurrently.

The API, not the browser, owns financial and state-changing business rules.

## 6. Secrets

No passwords, API keys, payment secrets, SMS secrets or database passwords belong in GitHub. They live in the VPS `.env`/secret store.
