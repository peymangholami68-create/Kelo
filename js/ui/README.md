# KELO UI modules

Each module:
1. Assigns handlers to `window` (onclick compatibility)
2. Exposes `KeloXxxUI.init()` for Phase 18 bootstrap

| Module | Facade |
|--------|--------|
| auth.ui.js | KeloAuthUI |
| profile.ui.js | KeloProfileUI |
| request.ui.js | KeloRequestUI |
| proposal.ui.js | KeloProposalUI |
| deal.ui.js | KeloDealUI |
| payment.ui.js | KeloPaymentUI |
| map.ui.js | KeloMapUI |
| sheet.ui.js | KeloSheetUI |

Load order: `app.js` → `ui/*.js` → `app/kelo-app.js`
