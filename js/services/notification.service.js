/**
 * KELO — Notification / Review Service (Phase 7)
 * Reviews, problem reports, and provider discovery for offers map.
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

  async function createReview(input) {
    var data = input || {};
    var user = currentUser();
    var userId = data.userId || (user && user.id);
    if (!userId) return Result.fail(Errors.CODES.UNAUTHORIZED, Errors.messageFor(Errors.CODES.UNAUTHORIZED));
    if (!data.dealId) return Result.fail(Errors.CODES.VALIDATION, 'شناسه معامله مشخص نیست.');
    var ratings = data.ratings || {};
    var note = String(data.note || '').slice(0, 2000);
    var cleanRatings = {};
    Object.keys(ratings).forEach(function (k) {
      var v = Number(ratings[k]);
      if (v >= 1 && v <= 5) cleanRatings[k] = v;
    });
    if (Object.keys(cleanRatings).length === 0 && !note.trim()) {
      return Result.fail(Errors.CODES.VALIDATION, 'لطفاً حداقل به یک مورد امتیاز بدهید یا نظر بنویسید');
    }
    var adapter = getAdapter();
    if (!adapter || typeof adapter.createReview !== 'function') {
      return Result.fail(Errors.CODES.UNKNOWN, 'Adapter گزارش در دسترس نیست.');
    }
    return adapter.createReview({
      dealId: data.dealId,
      userId: userId,
      ratings: cleanRatings,
      note: note
    });
  }

  async function reportProblem(input) {
    var data = input || {};
    var user = currentUser();
    var userId = data.userId || (user && user.id);
    if (!userId) return Result.fail(Errors.CODES.UNAUTHORIZED, Errors.messageFor(Errors.CODES.UNAUTHORIZED));
    if (!data.dealId) return Result.fail(Errors.CODES.VALIDATION, 'شناسه معامله مشخص نیست.');
    if (!data.reason) return Result.fail(Errors.CODES.VALIDATION, 'لطفاً یک مورد را انتخاب کنید');
    var adapter = getAdapter();
    if (!adapter || typeof adapter.reportProblem !== 'function') {
      return Result.fail(Errors.CODES.UNKNOWN, 'Adapter گزارش مشکل در دسترس نیست.');
    }
    return adapter.reportProblem({
      dealId: data.dealId,
      userId: userId,
      reason: data.reason,
      note: data.note || ''
    });
  }


  async function markNotificationsRead(ids) {
    var list = Array.isArray(ids) ? ids.filter(Boolean) : [];
    var adapter = getAdapter();
    if (!adapter || typeof adapter.markNotificationsRead !== 'function') {
      // Local soft path via query mirror
      var q = global.KeloQueryService;
      var notifs = (q && typeof q.qdb === 'function' ? q.qdb().notifications : null)
        || (typeof global.qdb === 'function' ? global.qdb().notifications : null)
        || [];
      if (list.length && Array.isArray(notifs)) {
        var now = new Date().toISOString();
        notifs.forEach(function (n) {
          if (list.indexOf(String(n.id)) >= 0) n.readAt = now;
        });
      }
      return Result.ok({ ids: list });
    }
    return adapter.markNotificationsRead({ ids: list });
  }

  async function getProviders(input) {
    var data = input || {};
    if (!data.requestId) return Result.fail(Errors.CODES.VALIDATION, 'شناسه درخواست مشخص نیست.');
    var adapter = getAdapter();
    if (!adapter) {
      return Result.fail(Errors.CODES.UNKNOWN, 'Adapter پیشنهاددهندگان در دسترس نیست.');
    }
    // Prefer Domain eligibility over adapter-side business logic (Group C)
    if (typeof adapter.getMarketplaceSnapshot === 'function') {
      var snapRes = await adapter.getMarketplaceSnapshot();
      var snap = (snapRes && snapRes.data) ? snapRes.data : (snapRes || {});
      var req = (snap.requests || []).find(function (r) {
        return String(r.id) === String(data.requestId);
      });
      if (!req) return Result.fail(Errors.CODES.REQUEST_NOT_FOUND, 'درخواست پیدا نشد');
      var E = (global.KeloDomain && global.KeloDomain.eligibility) || {};
      var candidates = [];
      if (E.getEligibleProviders) {
        candidates = E.getEligibleProviders({
          request: req,
          listings: snap.listings || [],
          machines: snap.machines || [],
          users: snap.users || [],
          bookings: snap.bookings || [],
          parseDate: global.KeloDomain && global.KeloDomain.pricing && global.KeloDomain.pricing.parseIsoishDate,
          geo: {
            nearestCityFromCoords: global.nearestCityFromCoords || null,
            provinceFromCity: global.provinceFromCity || null,
            formatActivityArea: global.formatActivityArea || null
          }
        }) || [];
      }
      return Result.ok({ providers: candidates, request: req });
    }
    if (typeof adapter.getProviders !== 'function') {
      return Result.fail(Errors.CODES.UNKNOWN, 'Adapter پیشنهاددهندگان در دسترس نیست.');
    }
    return adapter.getProviders({ requestId: data.requestId });
  }

  var notificationService = {
    createReview: createReview,
    reportProblem: reportProblem,
    getProviders: getProviders,
    markNotificationsRead: markNotificationsRead
  };

  global.KeloNotificationService = notificationService;
  if (global.KeloService) global.KeloService.notifications = notificationService;
})(typeof window !== 'undefined' ? window : globalThis);
