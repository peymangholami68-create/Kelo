/**
 * KELO — Provider Service
 * UI must call this, never Adapter.getTopProviders directly.
 */
(function (global) {
  'use strict';

  var Result = global.KeloResult;
  var Errors = global.KeloErrors;

  function getAdapter() {
    if (global.KeloService && typeof global.KeloService.adapter === 'function') {
      return global.KeloService.adapter();
    }
    return global.KeloLocalAdapter || global.KeloApiAdapter || null;
  }

  /**
   * @param {{ minReviews?: number, limit?: number, service?: string, userId?: string }} input
   */
  function getTopProviders(input) {
    var adapter = getAdapter();
    if (!adapter || typeof adapter.getTopProviders !== 'function') {
      return Promise.resolve(Result.ok({ providers: [], minReviews: 1 }));
    }
    var p = input || {};
    return Promise.resolve(adapter.getTopProviders({
      minReviews: p.minReviews == null ? 1 : p.minReviews,
      limit: p.limit == null ? 12 : p.limit,
      service: p.service || null,
      userId: p.userId || null
    })).then(function (res) {
      if (!res) return Result.ok({ providers: [], minReviews: 1 });
      if (res.ok && res.data) return res;
      if (res.providers) return Result.ok({ providers: res.providers, minReviews: res.minReviews || 1 });
      return res;
    }).catch(function (err) {
      return Result.fail(Errors.CODES.UNKNOWN, (err && err.message) || 'دریافت برترین‌ها انجام نشد.');
    });
  }

  global.KeloProviderService = {
    getTopProviders: getTopProviders
  };
})(typeof window !== 'undefined' ? window : globalThis);
