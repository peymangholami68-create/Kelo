/**
 * KELO Domain — Deal rules
 * Pure rules only. No DB. No side effects.
 */
(function (global) {
  'use strict';

  function farmerHasUnpaidCompleted(deals, userId) {
    return (deals || []).some(function (d) {
      return String(d.userId) === String(userId) &&
        d.status === 'completed' &&
        d.paymentStatus !== 'paid';
    });
  }

  function providerHasUnfinishedDeal(deals, providerId) {
    deals = deals || [];
    return deals.some(function (d) {
      return String(d.providerId) === String(providerId) &&
        d.status !== 'completed' && d.status !== 'cancelled';
    });
  }

  function canCancelDeal(deal, userId) {
    if (!deal) return { ok: false, reason: 'معامله برای لغو پیدا نشد یا قابل لغو نیست.' };
    var uid = String(userId);
    var ownerId = deal.userId != null ? deal.userId : deal.requesterId;
    if (String(ownerId) !== uid && String(deal.providerId) !== uid) {
      return { ok: false, reason: 'معامله برای لغو پیدا نشد یا قابل لغو نیست.' };
    }
    if (deal.status === 'completed' || deal.status === 'cancelled') {
      return { ok: false, reason: 'معامله برای لغو پیدا نشد یا قابل لغو نیست.' };
    }
    if (deal.paymentStatus === 'paid') {
      return { ok: false, reason: 'معامله برای لغو پیدا نشد یا قابل لغو نیست.' };
    }
    return { ok: true };
  }

  function canCompleteDeal(deal, userId) {
    if (!deal) return { ok: false, reason: 'معامله برای اتمام پیدا نشد یا مجاز نیستید.' };
    if (String(deal.providerId) !== String(userId)) {
      return { ok: false, reason: 'معامله برای اتمام پیدا نشد یا مجاز نیستید.' };
    }
    if (deal.status === 'completed' || deal.status === 'cancelled') {
      return { ok: false, reason: 'معامله برای اتمام پیدا نشد یا مجاز نیستید.' };
    }
    return { ok: true };
  }

  function canPayDeal(deal, userId) {
    if (!deal) return { ok: false, reason: 'معامله برای پرداخت پیدا نشد.' };
    var ownerId = deal.userId != null ? deal.userId : deal.requesterId;
    if (String(ownerId) !== String(userId)) {
      return { ok: false, reason: 'معامله برای پرداخت پیدا نشد.' };
    }
    if (deal.status === 'cancelled') {
      return { ok: false, reason: 'این معامله لغو شده است.' };
    }
    if (deal.paymentStatus === 'paid') {
      return { ok: true, alreadyPaid: true };
    }
    return { ok: true };
  }

  function canReviewDeal(deal, userId) {
    if (!deal) return { ok: false, reason: 'توافق پیدا نشد' };
    var uid = String(userId);
    var ownerId = deal.userId != null ? deal.userId : deal.requesterId;
    if (String(ownerId) !== uid && String(deal.providerId) !== uid) {
      return { ok: false, reason: 'اجازه ثبت گزارش ندارید' };
    }
    if (deal.status !== 'completed') {
      return { ok: false, reason: 'فقط پس از اتمام کار می‌توانید امتیاز بدهید' };
    }
    return { ok: true };
  }

  var api = {
    farmerHasUnpaidCompleted: farmerHasUnpaidCompleted,
    providerHasUnfinishedDeal: providerHasUnfinishedDeal,
    canCancelDeal: canCancelDeal,
    canCompleteDeal: canCompleteDeal,
    canPayDeal: canPayDeal,
    canReviewDeal: canReviewDeal
  };

  global.KeloDomain = global.KeloDomain || {};
  global.KeloDomain.deal = api;
  global.KeloDealDomain = api;
})(typeof window !== 'undefined' ? window : globalThis);
