/**
 * KELO — Deal Service
 * Orchestration: Domain rules → Adapter persistence only.
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
    return global.KeloLocalAdapter || global.KeloApiAdapter || null;
  }

  function domain() {
    return (global.KeloDomain && global.KeloDomain.deal) || global.KeloDealDomain || {};
  }

  function currentUser() {
    if (State && typeof State.getCurrentUser === 'function') return State.getCurrentUser();
    return null;
  }


  function isServerAdapter(adapter) {
    return !!(adapter && adapter !== global.KeloLocalAdapter && global.KeloApiAdapter && adapter === global.KeloApiAdapter);
  }

  async function loadDeal(adapter, id) {
    if (!id) return null;
    // 1) Explicit getDeal
    if (adapter && typeof adapter.getDeal === 'function') {
      try {
        var r = await adapter.getDeal({ id: id });
        if (r && r.ok) {
          if (r.data && r.data.deal) return r.data.deal;
          if (r.data && r.data.id) return r.data;
        }
        // Local "not found" is definitive only if we are on local adapter
        if (r && !r.ok && adapter === global.KeloLocalAdapter) {
          // still try mirrors below
        }
      } catch (e) { /* fall through */ }
    }
    // 2) Marketplace snapshot
    if (adapter && typeof adapter.getMarketplaceSnapshot === 'function') {
      try {
        var snap = await adapter.getMarketplaceSnapshot();
        var data = (snap && snap.ok && snap.data) ? snap.data : (snap && snap.data) || snap;
        var deals = (data && data.deals) || [];
        var found = deals.find(function (d) { return String(d.id) === String(id); });
        if (found) return found;
      } catch (e2) { /* fall through */ }
    }
    // 3) Query mirror / legacy db (same process as UI cards)
    try {
      if (global.KeloQueryService && typeof global.KeloQueryService.qdb === 'function') {
        var q = global.KeloQueryService.qdb();
        if (q && q.deals) {
          var f2 = q.deals.find(function (d) { return String(d.id) === String(id); });
          if (f2) return f2;
        }
      }
    } catch (e3) {}
    try {
      if (global.db && global.db.deals) {
        var f3 = global.db.deals.find(function (d) { return String(d.id) === String(id); });
        if (f3) return f3;
      }
    } catch (e4) {}
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
    var deal = await loadDeal(adapter, data.id);
    if (deal) {
      var gate = domain().canCancelDeal ? domain().canCancelDeal(deal, userId) : { ok: true };
      if (!gate.ok) {
        return Result.fail(Errors.CODES.FORBIDDEN, gate.reason || 'لغو مجاز نیست.');
      }
    } else if (adapter === global.KeloLocalAdapter) {
      return Result.fail(Errors.CODES.DEAL_NOT_FOUND, 'معامله برای لغو پیدا نشد یا قابل لغو نیست.');
    }
    // Server: let API enforce if deal not mirrored locally
    return adapter.cancelDeal({ id: data.id, userId: userId, _domainChecked: true });
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
    var deal = await loadDeal(adapter, data.id);
    if (deal) {
      var gate = domain().canCompleteDeal ? domain().canCompleteDeal(deal, userId) : { ok: true };
      if (!gate.ok) {
        return Result.fail(Errors.CODES.FORBIDDEN, gate.reason || 'اتمام مجاز نیست.');
      }
    } else if (adapter === global.KeloLocalAdapter) {
      return Result.fail(Errors.CODES.DEAL_NOT_FOUND, 'معامله برای اتمام پیدا نشد یا مجاز نیستید.');
    }
    return adapter.completeDeal({ id: data.id, userId: userId, _domainChecked: true });
  }

  async function createReview(input) {
    var data = input || {};
    var user = currentUser();
    var userId = data.userId || (user && user.id);
    if (!userId) return Result.fail(Errors.CODES.UNAUTHORIZED, Errors.messageFor(Errors.CODES.UNAUTHORIZED));
    if (!data.dealId) return Result.fail(Errors.CODES.VALIDATION, 'شناسه توافق مشخص نیست.');
    var adapter = getAdapter();
    if (!adapter || typeof adapter.createReview !== 'function') {
      return Result.fail(Errors.CODES.UNKNOWN, 'Adapter نظر در دسترس نیست.');
    }
    var deal = await loadDeal(adapter, data.dealId);
    if (deal) {
      var gate = domain().canReviewDeal ? domain().canReviewDeal(deal, userId) : { ok: true };
      if (!gate.ok) {
        return Result.fail(Errors.CODES.FORBIDDEN, gate.reason || 'ثبت نظر مجاز نیست.');
      }
    } else if (adapter === global.KeloLocalAdapter) {
      return Result.fail(Errors.CODES.DEAL_NOT_FOUND, 'توافق پیدا نشد');
    }
    return adapter.createReview({
      dealId: data.dealId,
      userId: userId,
      ratings: data.ratings || {},
      note: data.note || '',
      _domainChecked: true
    });
  }

  var dealService = { cancel: cancel, complete: complete, createReview: createReview };
  global.KeloDealService = dealService;
  if (global.KeloService) global.KeloService.deals = dealService;
})(typeof window !== 'undefined' ? window : globalThis);
