/**
 * KELO — Proposal Service (Phase 19A)
 *
 * Service does NOT know Local vs Server.
 * Capability-based:
 *   - Adapter with getMarketplaceSnapshot + apply*Plan → Domain plan then persist
 *   - Otherwise thin adapter.sendProposal / acceptProposal (e.g. HTTP)
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

  function currentUser() {
    if (State && typeof State.getCurrentUser === 'function') return State.getCurrentUser();
    return null;
  }

  function supportsLocalPlan(adapter) {
    return adapter &&
      typeof adapter.getMarketplaceSnapshot === 'function' &&
      typeof adapter.applySendPlan === 'function' &&
      typeof adapter.applyAcceptPlan === 'function';
  }

  function geoHelpers() {
    return {
      nearestCityFromCoords: global.nearestCityFromCoords || null,
      provinceFromCity: global.provinceFromCity || null,
      formatActivityArea: global.formatActivityArea || null
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

    var thinPayload = {
      userId: userId,
      requestId: data.requestId,
      providerId: data.providerId,
      machineId: data.machineId,
      listingId: data.listingId,
      unitPrice: data.unitPrice,
      priceUnit: data.priceUnit,
      location: data.location
    };

    // Domain orchestration when adapter can snapshot + apply plan
    if (supportsLocalPlan(adapter)) {
      var snapRes = await adapter.getMarketplaceSnapshot();
      if (!snapRes || !snapRes.ok) {
        return snapRes || Result.fail(Errors.CODES.UNKNOWN, 'خواندن داده ناموفق بود.');
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

      var eligibleList = E.getEligibleProviders
        ? E.getEligibleProviders({
            request: request,
            listings: snap.listings || [],
            machines: snap.machines || [],
            users: snap.users || [],
            bookings: snap.bookings || [],
            parseDate: global.parseStoredDate || (P && P.parseIsoishDate),
            geo: geoHelpers()
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
            alreadyMessage: (typeof global.sendOfferAlreadyToast === 'function')
              ? global.sendOfferAlreadyToast(request) : null,
            successMessage: (typeof global.sendOfferSuccessToast === 'function')
              ? global.sendOfferSuccessToast(request) : 'پیشنهاد ارسال شد'
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

    // Thin transport (API Adapter, etc.)
    if (typeof adapter.sendProposal !== 'function') {
      return Result.fail(Errors.CODES.UNKNOWN, 'Adapter پیشنهاد در دسترس نیست.');
    }
    return adapter.sendProposal(thinPayload);
  }

  async function accept(input) {
    var data = input || {};
    var user = currentUser();
    var userId = data.userId || (user && user.id);
    if (!userId) return Result.fail(Errors.CODES.UNAUTHORIZED, Errors.messageFor(Errors.CODES.UNAUTHORIZED));
    if (!data.id) return Result.fail(Errors.CODES.VALIDATION, 'شناسه پیشنهاد مشخص نیست.');
    var adapter = getAdapter();
    if (!adapter) return Result.fail(Errors.CODES.UNKNOWN, 'Adapter پیشنهاد در دسترس نیست.');

    var thinPayload = {
      id: data.id,
      userId: userId,
      userName: data.userName || (user && user.name) || ''
    };

    if (supportsLocalPlan(adapter)) {
      var snapRes = await adapter.getMarketplaceSnapshot();
      if (!snapRes || !snapRes.ok) {
        return snapRes || Result.fail(Errors.CODES.UNKNOWN, 'خواندن داده ناموفق بود.');
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
      var range = (request && B.getRequestDateRange)
        ? B.getRequestDateRange(request, parseDate)
        : { start: null, end: null };
      var machineUnavailable = false;
      if (recipient && request && E.getEligibleProviders) {
        var freshList = E.getEligibleProviders({
          request: request,
          listings: snap.listings || [],
          machines: snap.machines || [],
          users: snap.users || [],
          bookings: snap.bookings || [],
          parseDate: parseDate,
          geo: geoHelpers()
        });
        var freshCandidate = (freshList || []).find(function (x) {
          return String(x.providerId) === String(userId) &&
            String(x.machineId) === String(recipient.machineId);
        });
        var conflict = range.start && B.hasProviderBookingConflict
          ? B.hasProviderBookingConflict(
            snap.bookings, userId, recipient.machineId, range.start, range.end, parseDate
          )
          : false;
        machineUnavailable = !freshCandidate || !!conflict;
      }

      var unfinished = Deal.providerHasUnfinishedDeal
        ? Deal.providerHasUnfinishedDeal(snap.deals, userId)
        : false;
      var unfinishedMessage = unfinished
        ? 'برای پذیرش خدمت جدید ابتدا اتمام کار قبلی را ثبت کنید.'
        : null;

      var plan = D.planAccept
        ? D.planAccept({
            recipient: recipient,
            request: request,
            deals: snap.deals || [],
            recipients: snap.requestRecipients || [],
            userId: userId,
            userName: thinPayload.userName,
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

    if (typeof adapter.acceptProposal !== 'function') {
      return Result.fail(Errors.CODES.UNKNOWN, 'Adapter پیشنهاد در دسترس نیست.');
    }
    return adapter.acceptProposal(thinPayload);
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
