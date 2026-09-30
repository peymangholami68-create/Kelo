/**
 * KELO — Service Layer entry (Phase 1)
 *
 * UI  →  KeloService.*  →  Adapter (Local | API)
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
    requests: null,
    proposals: null,
    deals: null,
    payments: null,
    notifications: null
  };

  global.KeloService = KeloService;

  if (global.KeloAuthService) {
    KeloService.auth = global.KeloAuthService;
  }
  if (global.KeloProfileService) {
    KeloService.profile = global.KeloProfileService;
  }
})(typeof window !== 'undefined' ? window : globalThis);