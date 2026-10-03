/**
 * KELO — Sync / runtime bootstrap (Phase 19B)
 *
 * Only this module (and ApiAdapter) may talk to KeloBackend for transport.
 * KeloApp and UI should not call KeloBackend directly.
 */
(function (global) {
  'use strict';

  /**
   * Detect Local vs Server (health check). Idempotent.
   * @returns {Promise<'local'|'server'|'server-error'>}
   */
  async function initRuntime() {
    var b = global.KeloBackend;
    if (b && typeof b.init === 'function') {
      return b.init();
    }
    return 'local';
  }

  function isServer() {
    var b = global.KeloBackend;
    return !!(b && typeof b.isServerMode === 'function' && b.isServerMode());
  }

  function getMode() {
    var b = global.KeloBackend;
    if (b && typeof b.getMode === 'function') return b.getMode();
    if (isServer()) return 'server';
    return 'local';
  }

  /**
   * Load marketplace snapshot from server when in server mode.
   * @returns {Promise<object|null>}
   */
  async function bootstrapSnapshot() {
    if (!isServer()) return null;
    var b = global.KeloBackend;
    if (!b || typeof b.bootstrap !== 'function') return null;
    return b.bootstrap();
  }

  global.KeloSync = {
    initRuntime: initRuntime,
    isServer: isServer,
    getMode: getMode,
    bootstrapSnapshot: bootstrapSnapshot
  };
})(typeof window !== 'undefined' ? window : globalThis);
