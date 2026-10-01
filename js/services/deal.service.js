/**
 * KELO — Deal Service (Phase 5/9 — rules live in KeloDomain.deal; adapter persists)
 */
(function (global) {
  'use strict';

  var Result = global.KeloResult;
  var Errors = global.KeloErrors;
  var State = global.KeloState;

  function getAdapter() {
    if (global.KeloService && typeof global.KeloService.adapter === 'function') {
      return global.KeloService.adapter();
    }
    // Fallback only if facade not loaded yet — never resolve transport mode here.
    return global.KeloLocalAdapter || global.KeloApiAdapter || null;
  }

  function currentUser() {
    if (State && typeof State.getCurrentUser === 'function') return State.getCurrentUser();
    return null;
  }

  async function cancel(input) {
    var data = input || {};
    var user = currentUser();
    var userId = data.userId || (user && user.id);
    if (!userId) return Result.fail(Errors.CODES.UNAUTHORIZED, Errors.messageFor(Errors.CODES.UNAUTHORIZED));
    if (!data.id) return Result.fail(Errors.CODES.VALIDATION, 'شناسه معامله مشخص نیست.');
    var adapter = getAdapter();
    if (!adapter || typeof adapter.cancelDeal !== 'function') {
      return Result.fail(Errors.CODES.UNKNOWN, 'Adapter معامله در دسترس نیست.');
    }
    return adapter.cancelDeal({ id: data.id, userId: userId });
  }

  async function complete(input) {
    var data = input || {};
    var user = currentUser();
    var userId = data.userId || (user && user.id);
    if (!userId) return Result.fail(Errors.CODES.UNAUTHORIZED, Errors.messageFor(Errors.CODES.UNAUTHORIZED));
    if (!data.id) return Result.fail(Errors.CODES.VALIDATION, 'شناسه معامله مشخص نیست.');
    var adapter = getAdapter();
    if (!adapter || typeof adapter.completeDeal !== 'function') {
      return Result.fail(Errors.CODES.UNKNOWN, 'Adapter معامله در دسترس نیست.');
    }
    return adapter.completeDeal({ id: data.id, userId: userId });
  }

  var dealService = { cancel: cancel, complete: complete };
  global.KeloDealService = dealService;
  if (global.KeloService) global.KeloService.deals = dealService;
})(typeof window !== 'undefined' ? window : globalThis);
