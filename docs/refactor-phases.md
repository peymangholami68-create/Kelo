# KELO Refactor Phases

**Baseline:** Kelo36-CG2

## Phase 0 — Core → `Kelo40-P0-Core`
## Phase 1 — Auth → `Kelo41-P1-Auth`

## Phase 2 — Profile (current)

**Version:** `Kelo42-P2-Profile`

### Added / changed

```text
js/services/profile.service.js   → KeloService.profile.save()
js/adapters/local.adapter.js     → saveProfile (local DB + uniqueness)
js/adapters/api.adapter.js       → saveProfile via KeloBackend.updateProfile
js/app.js                        → saveFirstProfile / saveProfile / saveProfileEdit thin UI
```

### Flow

```text
UI form
  → KeloService.profile.save({ name, profile, ... })
      → LocalAdapter.saveProfile  OR  ApiAdapter.saveProfile
  → upsertAuthenticatedUserMirror + render
```

### Next

Phase 3 — Request (`Kelo43-P3-Request`)
