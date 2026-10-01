/**
 * KELO Domain — Proposal rules (Phase 9)
 * Pure checks on data snapshots. No DB writes. No UI.
 */
(function (global) {
  'use strict';

  var LOCKED_REQUEST = ['accepted', 'in_progress', 'completed', 'cancelled', 'expired'];

  function isRequestLocked(status) {
    return LOCKED_REQUEST.indexOf(status) >= 0;
  }

  /**
   * Active proposal between two users on a request (either direction).
   * @param {Array} recipients
   * @param {Array} requests
   */
  function hasActiveProposalBetween(recipients, requests, requestId, userA, userB) {
    if (!requestId || !userA || !userB) return false;
    var a = String(userA);
    var b = String(userB);
    if (a === b) return false;
    recipients = recipients || [];
    requests = requests || [];

    return recipients.some(function (rec) {
      if (String(rec.requestId) !== String(requestId)) return false;
      if (rec.status !== 'pending' && rec.status !== 'accepted') return false;
      var relatedRequest = requests.find(function (r) {
        return String(r.id) === String(requestId);
      });
      if (!relatedRequest) return false;
      var proposerId = rec.proposerId || relatedRequest.userId;
      var recipientId = rec.recipientId || rec.providerId;
      if (!proposerId || !recipientId) return false;
      var p = String(proposerId);
      var r = String(recipientId);
      return (p === a && r === b) || (p === b && r === a);
    });
  }

  /**
   * Duplicate pending/accepted on anchor ids between proposer and target.
   */
  function hasDuplicateProposal(recipients, anchorIds, proposerId, targetProviderId) {
    recipients = recipients || [];
    var me = String(proposerId);
    var target = String(targetProviderId);
    return recipients.some(function (x) {
      if (['pending', 'accepted'].indexOf(x.status) < 0) return false;
      if (!anchorIds[String(x.requestId)]) return false;
      var other = String(x.recipientId || x.providerId || '');
      var prop = String(x.proposerId || '');
      if (other === target) return true;
      if (prop && other && ((prop === me && other === target) || (prop === target && other === me))) return true;
      return false;
    });
  }

  /**
   * Resolve effective request when anchor is a provide ad.
   */
  function resolveEffectiveRequest(requests, anchorRequest, counterpartyId) {
    if (!anchorRequest || anchorRequest.requestKind !== 'provide') return anchorRequest;
    requests = requests || [];
    var farmerReq = requests
      .filter(function (r) {
        return String(r.userId) === String(counterpartyId) &&
          r.requestKind === 'need' &&
          r.service === anchorRequest.service &&
          r.status !== 'cancelled' && r.status !== 'completed' && r.status !== 'expired';
      })
      .sort(function (a, b) {
        return new Date(b.createdAt || b.created || 0) - new Date(a.createdAt || a.created || 0);
      })[0];
    return farmerReq || anchorRequest;
  }

  function canReject(recipient, userId) {
    if (!recipient) return { ok: false, reason: 'این پیشنهاد دیگر قابل رد نیست' };
    if (recipient.status !== 'pending') return { ok: false, reason: 'این پیشنهاد دیگر قابل رد نیست' };
    var recipientUid = String(recipient.recipientId || recipient.recipient_id || recipient.providerId || '');
    if (recipientUid && String(userId) && recipientUid !== String(userId)) {
      return { ok: false, reason: 'این پیشنهاد دیگر قابل رد نیست' };
    }
    return { ok: true };
  }

  function canCancel(recipient, userId) {
    if (!recipient) return { ok: false, reason: 'این پیشنهاد قابل لغو نیست' };
    if (recipient.status !== 'pending') return { ok: false, reason: 'این پیشنهاد قابل لغو نیست' };
    var proposerUid = String(recipient.proposerId || recipient.proposer_id || '');
    if (proposerUid && String(userId) && proposerUid !== String(userId)) {
      return { ok: false, reason: 'این پیشنهاد قابل لغو نیست' };
    }
    return { ok: true };
  }


  /**
   * Build a pure send plan (no writes).
   * @param {object} ctx
   *  request, requests, recipients, userId, providerId, candidate, total
   */
  function planSend(ctx) {
    ctx = ctx || {};
    var request = ctx.request;
    if (!request) return { ok: false, code: 'REQUEST_NOT_FOUND', message: 'درخواست پیدا نشد' };
    if (isRequestLocked(request.status)) {
      return { ok: false, code: 'REQUEST_INVALID_STATE', message: 'این درخواست قبلاً توافق شده است' };
    }
    var effectiveRequest = resolveEffectiveRequest(ctx.requests, request, ctx.providerId);
    var anchorIds = {};
    anchorIds[String(request.id)] = true;
    anchorIds[String(effectiveRequest.id)] = true;

    if (hasActiveProposalBetween(ctx.recipients, ctx.requests, request.id, request.userId, ctx.providerId) ||
        hasActiveProposalBetween(ctx.recipients, ctx.requests, effectiveRequest.id, request.userId, ctx.providerId)) {
      return { ok: false, code: 'PROPOSAL_NOT_ALLOWED', message: 'در این درخواست، بین شما و این کاربر یک پیشنهاد فعال وجود دارد' };
    }
    if (hasDuplicateProposal(ctx.recipients, anchorIds, ctx.userId, ctx.providerId)) {
      return { ok: false, code: 'PROPOSAL_NOT_ALLOWED', message: ctx.alreadyMessage || 'پیشنهاد فعال از قبل وجود دارد' };
    }

    var candidate = ctx.candidate || {
      providerId: ctx.providerId, listingId: null, machineId: null,
      unitPrice: 0, priceUnit: '', location: '', rating: null, data: {}
    };
    var total = ctx.total != null ? ctx.total : (Number(candidate.unitPrice) || 0);
    var recipient = {
      id: 'rr' + Date.now() + Math.random().toString(36).slice(2, 7),
      requestId: effectiveRequest.id,
      anchorRequestId: request.id,
      proposerId: ctx.userId,
      recipientId: candidate.providerId,
      providerId: candidate.providerId,
      provider: candidate.provider,
      machineId: candidate.machineId,
      listingId: candidate.listingId || null,
      service: request.service,
      unitPrice: candidate.unitPrice,
      priceUnit: candidate.priceUnit,
      total: total,
      rating: candidate.rating,
      location: candidate.location,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    return {
      ok: true,
      recipient: recipient,
      requestId: request.id,
      effectiveRequestId: effectiveRequest.id,
      setRequestPending: true,
      successMessage: ctx.successMessage || 'پیشنهاد ارسال شد'
    };
  }

  /**
   * Pure accept plan.
   * @param {object} ctx
   *  recipient, request, deals, recipients, userId, userName, allowAccept
   */
  function planAccept(ctx) {
    ctx = ctx || {};
    var recipient = ctx.recipient;
    var request = ctx.request;
    var userId = ctx.userId;

    if (!recipient || recipient.status !== 'pending' || String(recipient.providerId) !== String(userId)) {
      return {
        ok: false,
        code: 'PROPOSAL_ALREADY_HANDLED',
        message: ctx.existsNonPending ? 'این درخواست دیگر قابل پذیرش نیست' : 'پیشنهاد پیدا نشد'
      };
    }
    if (!request) {
      return { ok: false, code: 'REQUEST_NOT_FOUND', message: 'درخواست پیدا نشد' };
    }
    if (isRequestLocked(request.status)) {
      return {
        ok: false,
        code: 'REQUEST_INVALID_STATE',
        message: 'این درخواست قبلاً با ارائه‌دهنده دیگری توافق شده است',
        closeRecipient: true
      };
    }
    if (ctx.providerHasUnfinished) {
      return { ok: false, code: 'PROPOSAL_NOT_ALLOWED', message: ctx.unfinishedMessage || 'کار ناتمام قبلی وجود دارد' };
    }
    if (ctx.machineUnavailable) {
      return {
        ok: false,
        code: 'PROPOSAL_NOT_ALLOWED',
        message: 'این ماشین در این زمان دیگر در دسترس نیست',
        closeRecipient: true
      };
    }

    var stillOpen = (ctx.recipients || []).find(function (x) {
      return String(x.requestId) === String(request.id) && x.status === 'pending' && String(x.id) === String(recipient.id);
    });
    var anotherAccepted = (ctx.recipients || []).find(function (x) {
      return String(x.requestId) === String(request.id) && x.status === 'accepted';
    });
    if (!stillOpen || anotherAccepted) {
      return { ok: false, code: 'PROPOSAL_ALREADY_HANDLED', message: 'این درخواست قبلاً با ارائه‌دهنده دیگری توافق شده است' };
    }

    var existingDeal = (ctx.deals || []).find(function (d) {
      return String(d.requestId) === String(request.id) && d.status !== 'cancelled';
    });
    if (existingDeal) {
      return { ok: false, code: 'CONFLICT', message: 'این درخواست قبلاً توافق شده است', closeRecipient: true };
    }

    var booking = {
      id: 'b' + Date.now() + Math.random().toString(36).slice(2, 7),
      requestId: request.id,
      providerId: userId,
      requesterId: request.userId,
      machineId: recipient.machineId,
      listingId: recipient.listingId || null,
      start: (request.data && (request.data.dateStart || request.data.date)) || null,
      end: (request.data && (request.data.dateEnd || request.data.dateStart || request.data.date)) || null,
      status: 'confirmed',
      createdAt: new Date().toISOString()
    };
    var deal = {
      id: 'd' + Date.now() + Math.random().toString(36).slice(2, 7),
      requestId: request.id,
      bookingId: booking.id,
      userId: request.userId,
      providerId: userId,
      machineId: recipient.machineId,
      service: request.service,
      total: recipient.total,
      unitPrice: recipient.unitPrice,
      priceUnit: recipient.priceUnit,
      counterparty: ctx.userName || '',
      paymentStatus: 'pending',
      status: 'agreed',
      createdAt: new Date().toISOString()
    };

    return {
      ok: true,
      booking: booking,
      deal: deal,
      recipientId: recipient.id,
      requestId: request.id,
      closeOtherPending: true,
      successMessage: 'کار با شما توافق شد'
    };
  }

  global.KeloDomain = global.KeloDomain || {};
  global.KeloDomain.proposal = {
    isRequestLocked: isRequestLocked,
    hasActiveProposalBetween: hasActiveProposalBetween,
    hasDuplicateProposal: hasDuplicateProposal,
    resolveEffectiveRequest: resolveEffectiveRequest,
    canReject: canReject,
    canCancel: canCancel,
    planSend: planSend,
    planAccept: planAccept,
    LOCKED_REQUEST: LOCKED_REQUEST
  };
})(typeof window !== 'undefined' ? window : globalThis);
