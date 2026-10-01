/**
 * KELO — Server snapshot sync helper (Phase 8)
 * UI still owns applyServerSnapshot + db mirror; this centralizes mode checks.
 */
(function (global) {
  'use strict';

  function isServer() {
    if (global.KeloService && typeof global.KeloService.mode === 'function') {
      return global.KeloService.mode() === 'server';
    }
    var b = global.KeloBackend;
    return !!(b && typeof b.isServerMode === 'function' && b.isServerMode());
  }

  async function bootstrapSnapshot() {
    if (!isServer()) return null;
    var b = global.KeloBackend;
    if (!b || typeof b.bootstrap !== 'function') return null;
    return b.bootstrap();
  }

  global.KeloSync = {
    isServer: isServer,
    bootstrapSnapshot: bootstrapSnapshot
  };
})(typeof window !== 'undefined' ? window : globalThis);
