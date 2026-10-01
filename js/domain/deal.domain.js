/**
 * KELO Domain — Deal rules (Phase 9)
 */
(function (global) {
  'use strict';

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
    if (String(deal.userId) !== uid && String(deal.providerId) !== uid) {
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
    if (String(deal.userId) !== String(userId)) {
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

  global.KeloDomain = global.KeloDomain || {};
  global.KeloDomain.deal = {
    providerHasUnfinishedDeal: providerHasUnfinishedDeal,
    canCancelDeal: canCancelDeal,
    canCompleteDeal: canCompleteDeal,
    canPayDeal: canPayDeal
  };
})(typeof window !== 'undefined' ? window : globalThis);
