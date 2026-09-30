/**
 * KELO — Result contract (Phase 0)
 *
 * تمام Serviceها باید نتیجه را با این شکل برگردانند تا UI
 * بین Local و Server تفاوتی نبیند.
 *
 * موفق:
 *   { ok: true, data: any, message?: string }
 *
 * ناموفق:
 *   { ok: false, code: string, message: string, details?: any }
 */
(function (global) {
  'use strict';

  function ok(data, message) {
    var result = { ok: true, data: data == null ? null : data };
    if (message) result.message = String(message);
    return result;
  }

  function fail(code, message, details) {
    var result = {
      ok: false,
      code: String(code || 'UNKNOWN'),
      message: String(message || 'خطای ناشناخته')
    };
    if (details !== undefined) result.details = details;
    return result;
  }

  function fromError(err, fallbackCode, fallbackMessage) {
    if (!err) return fail(fallbackCode || 'UNKNOWN', fallbackMessage || 'خطای ناشناخته');
    var code = err.code || (err.body && err.body.code) || fallbackCode || 'UNKNOWN';
    var message =
      (err.body && err.body.error) ||
      err.message ||
      fallbackMessage ||
      'خطای ناشناخته';
    return fail(code, message, err.body || null);
  }

  function isResult(value) {
    return !!(value && typeof value === 'object' && typeof value.ok === 'boolean');
  }

  global.KeloResult = {
    ok: ok,
    fail: fail,
    fromError: fromError,
    isResult: isResult
  };
})(typeof window !== 'undefined' ? window : globalThis);
