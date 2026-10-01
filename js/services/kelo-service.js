/**
 * KELO — Service Layer entry (Phase 1)
 *
 * UI  →  KeloService.*  →  Adapter (Local | API)
 *
 * Cleanup A: only this facade (and ApiAdapter/Sync) may inspect mode via backend bridge.
 * Domain services must NOT import KeloBackend.
 */
(function (global) {
  'use strict';

  function getActiveAdapter() {
    var backend = global.KeloBackend;
    if (backend && typeof backend.isServerMode === 'function' && backend.isServerMode()) {
      return global.KeloApiAdapter;
    }
    return global.KeloLocalAdapter;
  }

  function getMode() {
    var backend = global.KeloBackend;
    if (backend && typeof backend.getMode === 'function') return backend.getMode();
    if (backend && typeof backend.isServerMode === 'function' && backend.isServerMode()) return 'server';
    return 'local';
  }

  var KeloService = {
    adapter: getActiveAdapter,
    mode: getMode,
    auth: global.KeloAuthService || null,
    profile: global.KeloProfileService || null,
    requests: global.KeloRequestService || null,
    proposals: global.KeloProposalService || null,
    deals: global.KeloDealService || null,
    payments: global.KeloPaymentService || null,
    notifications: global.KeloNotificationService || null,
    query: global.KeloQueryService || null
  };

  global.KeloService = KeloService;

  if (global.KeloAuthService) {
    KeloService.auth = global.KeloAuthService;
  }
  if (global.KeloProfileService) {
    KeloService.profile = global.KeloProfileService;
  }
  if (global.KeloRequestService) {
    KeloService.requests = global.KeloRequestService;
  }
  if (global.KeloProposalService) {
    KeloService.proposals = global.KeloProposalService;
  }
  if (global.KeloDealService) {
    KeloService.deals = global.KeloDealService;
  }
  if (global.KeloPaymentService) {
    KeloService.payments = global.KeloPaymentService;
  }
  if (global.KeloNotificationService) {
    KeloService.notifications = global.KeloNotificationService;
  }
  if (global.KeloQueryService) {
    KeloService.query = global.KeloQueryService;
  }
})(typeof window !== 'undefined' ? window : globalThis);