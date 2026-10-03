# KELO Architecture Freeze

**Baseline version:** `Kelo68-ArchitectureFrozen`  
**Status:** 🔒 FROZEN for structural refactor  
**Date:** 2026-10-02

After Phases 0–18 (layering / modularization) and 19A–19C (boundary cleanup),
the architecture is stable enough for feature work (OTP, Zarinpal, production hardening).

Do **not** start a new “Phase 21 refactor” unless a boundary is actually broken.

---

## Target layers (must not be bypassed)

```
┌─────────────────────────────┐
│             UI              │
│ Auth / Profile / Request…   │
│ js/ui/*.ui.js               │
└──────────────┬──────────────┘
               ↓
┌─────────────────────────────┐
│        Application          │
│ KeloApp.init (kelo-app.js)  │
│ app.js shell / DB mirror    │
└──────────────┬──────────────┘
               ↓
┌─────────────────────────────┐
│    Services + Query         │
│ KeloService.* / query / qdb │
└──────────────┬──────────────┘
               ↓
┌─────────────────────────────┐
│           Domain            │
│ eligibility / pricing /     │
│ booking / proposal / deal   │
└──────────────┬──────────────┘
               ↓
┌─────────────────────────────┐
│          Adapters           │
│      Local / API            │
└──────────────┬──────────────┘
               ↓
        Local DB  ·  Backend API → PostgreSQL
```

---

## Hard rules for new features

1. **Mutations** go through `KeloService.<domain>.*` — never `db.*` writes from UI.
2. **Reads** in UI go through `qdb()` / `KeloService.query.*` — not raw `db` (except temporary bridges).
3. **Domain rules** (eligibility, price, booking conflict, proposal/deal validity) live in `js/domain/*`.
4. **Services** must not branch on `mode() === 'server'` for business logic.
   - Adapter selection stays in `kelo-service.js` + `KeloSync`.
5. **KeloApp** must not call `KeloBackend` directly — use `KeloService.bootstrap()` / `KeloSync`.
6. **Adapters**
   - Local: persistence / plan-apply / CRUD
   - API: HTTP only
7. **Compatibility bridges** (`window.db`, `window.currentUser`, `window.renderApp`) stay until all consumers are migrated. Do not remove in feature PRs.

---

## Entry point

```text
index.html
  → … scripts …
  → js/app/kelo-app.js
       KeloApp.init()
         bindDataLayer
         bindUiModules
         bootstrap (Sync)
         restoreSessionAndPaint
```

Event: `kelo:ready`

---

## Known acceptable debt (do not “fix” without a bug)

| Item | Why allowed for now |
|------|---------------------|
| LocalAdapter still has some orchestration leftovers | Works; full purity is low ROI vs regression risk |
| HTML `onclick` → `window.fn` | Mobile UI contract; not a layer violation |
| `window.db` / `currentUser` bridges | Legacy consumers; remove only after zero callers |
| Auth `server-error` via mode | Transport availability, not domain branching |

---

## Verification checklist (run before claiming freeze green)

### Static
- [ ] No `mode() === 'server'` in domain services except `kelo-service` adapter pick
- [ ] No `KeloBackend` call from `kelo-app.js` (except comments)
- [ ] No raw `db.` collection access in `js/ui/*.js` (use `qdb()`)

### Local
- [ ] Login / logout / refresh session
- [ ] Create request → open proposals map
- [ ] Send / accept / reject proposal
- [ ] Deal cancel / complete / pay path

### Server (Docker)
- [ ] Health OK, migrations including `008_fix_reviews_schema`
- [ ] Same two-user flow
- [ ] No `column … does not exist` on reviews/snapshot

---

## What comes after freeze

Feature tracks only, e.g.:

- OTP / stronger auth
- Zarinpal payments
- Production security / rate limits
- Observability

Each feature must respect the layers above. If a feature needs a new domain rule, add it under `js/domain/` and call it from a service — not from UI or raw SQL in the client.
