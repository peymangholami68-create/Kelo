# Kelo Architecture — Kelo113

## Target (locked)

```
UI → Service → Domain (rules) → Adapter (persist) → Data
```

Mode (Local/Server) is chosen only in `kelo-service.js`.

## What Kelo113 changed toward 100%

| Area | Change |
|------|--------|
| Deal cancel/complete | Domain.canCancel/canComplete in **DealService**, LocalAdapter only writes status |
| Pay | Domain.canPay in **PaymentService**, LocalAdapter only writes payment |
| Review | Domain.canReview in **DealService**, LocalAdapter inserts row |
| createRequest | Field + unpaid validation in **RequestService**; LocalAdapter only inserts |
| getDeal | Data read on LocalAdapter for Service orchestration |

## Still not pure-CRUD (honest residual)

- `applyAcceptPlan` / `applySendPlan` still apply multi-row writes (booking + deal + recipients). Domain builds the plan in ProposalService; Adapter executes the plan. That is acceptable Application/Persistence boundary.
- Login/profile uniqueness checks remain in LocalAdapter (auth data constraints).
- UI may still **read** via QueryService.qdb() for rendering.

## Regression checklist before claiming 100%

- [ ] Accept proposal → deal
- [ ] Cancel deal → request open again
- [ ] Complete (provider only)
- [ ] Pay (farmer only)
- [ ] Unpaid completed blocks new need
- [ ] Review only after completed
- [ ] Top providers via ProviderService only

## Feature freeze until checklist green

No new product features until the checklist above is verified on Local and Server.
