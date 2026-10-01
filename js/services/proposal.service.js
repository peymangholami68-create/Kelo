/**
 * KELO — Proposal Service (Cleanup B)
 *
 * Local path: Service orchestrates Domain → Adapter.apply*Plan
 * Server path: Adapter HTTP (ApiAdapter.sendProposal / acceptProposal)
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

  function mode() {
    if (global.KeloService && typeof global.KeloService.mode === 'function') {
      return global.KeloService.mode();
    }
    return 'local';
  }

  function currentUser() {
    if (State && typeof State.getCurrentUser === 'function') return State.getCurrentUser();
    return null;
  }

  function geoFromHelpers(h) {
    h = h || {};
    return {
      nearestCityFromCoords: h.nearestCityFromCoords || null,
      provinceFromCity: h.provinceFromCity || null,
      formatActivityArea: h.formatActivityArea || null
    };
  }

  async function send(input) {
    var data = input || {};
    var user = currentUser();
    var userId = data.userId || (user && user.id);
    if (!userId) return Result.fail(Errors.CODES.UNAUTHORIZED, Errors.messageFor(Errors.CODES.UNAUTHORIZED));
    if (!data.requestId || !data.providerId) {
      return Result.fail(Errors.CODES.VALIDATION, 'اطلاعات پیشنهاد ناقص است.');
    }
    var adapter = getAdapter();
    if (!adapter) return Result.fail(Errors.CODES.UNKNOWN, 'Adapter پیشنهاد در دسترس نیست.');

    // Server: HTTP path unchanged
    if (mode() === 'server') {
      if (typeof adapter.sendProposal !== 'function') {
        return Result.fail(Errors.CODES.UNKNOWN, 'Adapter پیشنهاد در دسترس نیست.');
      }
      return adapter.sendProposal({
        userId: userId,
        requestId: data.requestId,
        providerId: data.providerId,
        machineId: data.machineId,
        listingId: data.listingId,
        unitPrice: data.unitPrice,
        priceUnit: data.priceUnit,
        location: data.location
      });
    }

    // Local: Domain orchestration + persist
    if (typeof adapter.getMarketplaceSnapshot !== 'function' || typeof adapter.applySendPlan !== 'function') {
      if (typeof adapter.sendProposal === 'function') {
        return adapter.sendProposal(data);
      }
      return Result.fail(Errors.CODES.UNKNOWN, 'Local Adapter plan API در دسترس نیست.');
    }

    var snapRes = await adapter.getMarketplaceSnapshot();
    if (!snapRes || !snapRes.ok) {
      return snapRes || Result.fail(Errors.CODES.UNKNOWN, 'خواندن داده محلی ناموفق بود.');
    }
    var snap = snapRes.data || {};
    var D = (global.KeloDomain && global.KeloDomain.proposal) || {};
    var P = (global.KeloDomain && global.KeloDomain.pricing) || {};
    var E = (global.KeloDomain && global.KeloDomain.eligibility) || {};

    var request = (snap.requests || []).find(function (r) {
      return String(r.id) === String(data.requestId) && String(r.userId) === String(userId);
    });
    if (!request) {
      return Result.fail(Errors.CODES.REQUEST_NOT_FOUND, 'درخواست پیدا نشد');
    }

    var helpers = (global.KeloLocalAdapter && global.KeloLocalAdapter._helpers) || {};
    // helpers bound via dataAccess - read from adapter internal if exposed
    // Use window helpers if present (bound in app.js)
    var h = {
      parseStoredDate: global.parseStoredDate,
      nearestCityFromCoords: global.nearestCityFromCoords,
      provinceFromCity: global.provinceFromCity,
      formatActivityArea: global.formatActivityArea,
      sendOfferAlreadyToast: global.sendOfferAlreadyToast,
      sendOfferSuccessToast: global.sendOfferSuccessToast
    };

    var eligibleList = E.getEligibleProviders
      ? E.getEligibleProviders({
          request: request,
          listings: snap.listings || [],
          machines: snap.machines || [],
          users: snap.users || [],
          bookings: snap.bookings || [],
          parseDate: h.parseStoredDate || (P && P.parseIsoishDate),
          geo: geoFromHelpers(h)
        })
      : [];
    var candidate = (eligibleList || []).find(function (x) {
      return String(x.providerId) === String(data.providerId);
    }) || {
      providerId: data.providerId,
      listingId: data.listingId || null,
      machineId: data.machineId || null,
      unitPrice: data.unitPrice || 0,
      priceUnit: data.priceUnit || '',
      location: data.location || '',
      rating: null,
      data: {}
    };

    var effectiveForPrice = D.resolveEffectiveRequest
      ? D.resolveEffectiveRequest(snap.requests, request, data.providerId)
      : request;
    var total = P.calculateTotal
      ? P.calculateTotal(effectiveForPrice, candidate.data, candidate.unitPrice)
      : (Number(candidate.unitPrice) || 0);

    var plan = D.planSend
      ? D.planSend({
          request: request,
          requests: snap.requests || [],
          recipients: snap.requestRecipients || [],
          userId: userId,
          providerId: data.providerId,
          candidate: candidate,
          total: total,
          alreadyMessage: (typeof h.sendOfferAlreadyToast === 'function') ? h.sendOfferAlreadyToast(request) : null,
          successMessage: (typeof h.sendOfferSuccessToast === 'function') ? h.sendOfferSuccessToast(request) : 'پیشنهاد ارسال شد'
        })
      : null;

    if (!plan || !plan.ok) {
      return Result.fail(
        (plan && plan.code) || Errors.CODES.PROPOSAL_NOT_ALLOWED,
        (plan && plan.message) || 'ارسال پیشنهاد مجاز نیست'
      );
    }
    return adapter.applySendPlan({ plan: plan });
  }

  async function accept(input) {
    var data = input || {};
    var user = currentUser();
    var userId = data.userId || (user && user.id);
    if (!userId) return Result.fail(Errors.CODES.UNAUTHORIZED, Errors.messageFor(Errors.CODES.UNAUTHORIZED));
    if (!data.id) return Result.fail(Errors.CODES.VALIDATION, 'شناسه پیشنهاد مشخص نیست.');
    var adapter = getAdapter();
    if (!adapter) return Result.fail(Errors.CODES.UNKNOWN, 'Adapter پیشنهاد در دسترس نیست.');

    if (mode() === 'server') {
      if (typeof adapter.acceptProposal !== 'function') {
        return Result.fail(Errors.CODES.UNKNOWN, 'Adapter پیشنهاد در دسترس نیست.');
      }
      return adapter.acceptProposal({
        id: data.id,
        userId: userId,
        userName: data.userName || (user && user.name) || ''
      });
    }

    if (typeof adapter.getMarketplaceSnapshot !== 'function' || typeof adapter.applyAcceptPlan !== 'function') {
      if (typeof adapter.acceptProposal === 'function') return adapter.acceptProposal(data);
      return Result.fail(Errors.CODES.UNKNOWN, 'Local Adapter plan API در دسترس نیست.');
    }

    var snapRes = await adapter.getMarketplaceSnapshot();
    if (!snapRes || !snapRes.ok) {
      return snapRes || Result.fail(Errors.CODES.UNKNOWN, 'خواندن داده محلی ناموفق بود.');
    }
    var snap = snapRes.data || {};
    var D = (global.KeloDomain && global.KeloDomain.proposal) || {};
    var Deal = (global.KeloDomain && global.KeloDomain.deal) || {};
    var B = (global.KeloDomain && global.KeloDomain.booking) || {};
    var E = (global.KeloDomain && global.KeloDomain.eligibility) || {};
    var P = (global.KeloDomain && global.KeloDomain.pricing) || {};

    var recipient = (snap.requestRecipients || []).find(function (x) {
      return String(x.id) === String(data.id);
    });
    var existsNonPending = !!(recipient && recipient.status !== 'pending');
    if (recipient && (recipient.status !== 'pending' || String(recipient.providerId) !== String(userId))) {
      recipient = null;
    }
    var request = recipient
      ? (snap.requests || []).find(function (r) { return String(r.id) === String(recipient.requestId); })
      : null;

    var parseDate = global.parseStoredDate || (P && P.parseIsoishDate);
    var range = (request && B.getRequestDateRange) ? B.getRequestDateRange(request, parseDate) : { start: null, end: null };
    var machineUnavailable = false;
    if (recipient && request && E.getEligibleProviders) {
      var freshList = E.getEligibleProviders({
        request: request,
        listings: snap.listings || [],
        machines: snap.machines || [],
        users: snap.users || [],
        bookings: snap.bookings || [],
        parseDate: parseDate,
        geo: {
          nearestCityFromCoords: global.nearestCityFromCoords || null,
          provinceFromCity: global.provinceFromCity || null,
          formatActivityArea: global.formatActivityArea || null
        }
      });
      var freshCandidate = (freshList || []).find(function (x) {
        return String(x.providerId) === String(userId) && String(x.machineId) === String(recipient.machineId);
      });
      var conflict = range.start && B.hasProviderBookingConflict
        ? B.hasProviderBookingConflict(snap.bookings, userId, recipient.machineId, range.start, range.end, parseDate)
        : false;
      machineUnavailable = !freshCandidate || !!conflict;
    }

    var unfinished = Deal.providerHasUnfinishedDeal
      ? Deal.providerHasUnfinishedDeal(snap.deals, userId)
      : false;
    var unfinishedMessage = null;
    if (unfinished) {
      unfinishedMessage = 'برای پذیرش خدمت جدید ابتدا اتمام کار قبلی را ثبت کنید.';
    }

    var plan = D.planAccept
      ? D.planAccept({
          recipient: recipient,
          request: request,
          deals: snap.deals || [],
          recipients: snap.requestRecipients || [],
          userId: userId,
          userName: data.userName || (user && user.name) || '',
          existsNonPending: existsNonPending,
          providerHasUnfinished: unfinished,
          unfinishedMessage: unfinishedMessage,
          machineUnavailable: machineUnavailable
        })
      : null;

    return adapter.applyAcceptPlan({
      plan: plan,
      recipientId: data.id
    });
  }

  async function reject(input) {
    var data = input || {};
    var user = currentUser();
    var userId = data.userId || (user && user.id);
    if (!userId) return Result.fail(Errors.CODES.UNAUTHORIZED, Errors.messageFor(Errors.CODES.UNAUTHORIZED));
    if (!data.id) return Result.fail(Errors.CODES.VALIDATION, 'شناسه پیشنهاد مشخص نیست.');
    var adapter = getAdapter();
    if (!adapter || typeof adapter.rejectProposal !== 'function') {
      return Result.fail(Errors.CODES.UNKNOWN, 'Adapter پیشنهاد در دسترس نیست.');
    }
    return adapter.rejectProposal({ id: data.id, userId: userId });
  }

  async function cancel(input) {
    var data = input || {};
    var user = currentUser();
    var userId = data.userId || (user && user.id);
    if (!userId) return Result.fail(Errors.CODES.UNAUTHORIZED, Errors.messageFor(Errors.CODES.UNAUTHORIZED));
    if (!data.id) return Result.fail(Errors.CODES.VALIDATION, 'شناسه پیشنهاد مشخص نیست.');
    var adapter = getAdapter();
    if (!adapter || typeof adapter.cancelProposal !== 'function') {
      return Result.fail(Errors.CODES.UNKNOWN, 'Adapter پیشنهاد در دسترس نیست.');
    }
    return adapter.cancelProposal({ id: data.id, userId: userId });
  }

  var proposalService = {
    send: send,
    accept: accept,
    reject: reject,
    cancel: cancel
  };

  global.KeloProposalService = proposalService;
  if (global.KeloService) global.KeloService.proposals = proposalService;
})(typeof window !== 'undefined' ? window : globalThis);
