/**
 * KELO — Payment Service (Phase 6)
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

  /**
   * @param {{ id: string, method?: 'cash'|'online'|'generic', userId?: string }} input
   */
  async function pay(input) {
    var data = input || {};
    var user = currentUser();
    var userId = data.userId || (user && user.id);
    if (!userId) return Result.fail(Errors.CODES.UNAUTHORIZED, Errors.messageFor(Errors.CODES.UNAUTHORIZED));
    if (!data.id) return Result.fail(Errors.CODES.VALIDATION, 'شناسه معامله مشخص نیست.');

    var method = data.method || 'generic';
    if (method === 'online') {
      // Keep product message consistent across Local/Server until gateway exists.
      return Result.fail(Errors.CODES.NOT_IMPLEMENTED, 'پرداخت آنلاین به‌زودی متصل می‌شود.');
    }

    var adapter = getAdapter();
    if (!adapter || typeof adapter.payDeal !== 'function') {
      return Result.fail(Errors.CODES.UNKNOWN, 'Adapter پرداخت در دسترس نیست.');
    }
    return adapter.payDeal({ id: data.id, userId: userId, method: method });
  }

  var paymentService = { pay: pay };
  global.KeloPaymentService = paymentService;
  if (global.KeloService) global.KeloService.payments = paymentService;
})(typeof window !== 'undefined' ? window : globalThis);
