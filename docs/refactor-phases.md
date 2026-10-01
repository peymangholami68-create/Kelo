# Phase 18 — App bootstrap complete

**Version:** `Kelo64-P18-AppInit`

## Entry

```js
KeloApp.init()  // js/app/kelo-app.js — last script in index.html
```

### init stages

1. `bindDataLayer()` — LocalAdapter + Query → db
2. `bindUiModules()` — KeloAuthUI.init … KeloSheetUI.init
3. `installPwaManifest()`
4. `applyImageFallbacks()`
5. `restoreSessionAndPaint()` — KeloBackend.init + auth restore + first render

Event: `kelo:ready` when finished.

## app.js role

Shared state, DB helpers, shell render (`renderApp` / home). **No** DOMContentLoaded bootstrap.

## UI modules

Each exposes:

```js
KeloAuthUI / KeloProfileUI / KeloRequestUI / KeloProposalUI
KeloDealUI / KeloPaymentUI / KeloMapUI / KeloSheetUI
  .init() .isReady() .name
```

HTML `onclick` handlers remain on `window.*` for compatibility.

## Do not rework

Architecture layers are complete. Further changes should be features/bugs, not structural refactor.
