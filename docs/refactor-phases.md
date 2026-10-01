# Cleanup C — Query layer (current)

**Version:** `Kelo57-CleanupC`

## Rule

```text
UI  →  KeloService.query.*  →  DB mirror
UI  →  Domain services      →  mutations
```

## Added

```text
js/services/query.service.js
  bindDataAccess / snapshot
  getMyRequest / getMyDeal
  requests / deals / recipients / machines / listings
```

UI modules (map, sheet, proposal, payment, request) no longer reference `db.*` directly.

`app.js` may still read `db` for remaining render helpers — acceptable residual.
