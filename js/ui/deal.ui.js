/**
 * KELO — Deal / review UI handlers (Phase 10)
 * Event handlers + orchestration. Rendering still primarily in app.js.
 */
(function (global) {
  'use strict';

  async function cancelDeal(dealId){
      if (!currentUser) return;
      if (!confirm('این کار لغو شود؟')) return;
      const api = window.KeloService && window.KeloService.deals;
      if (!api) { showToast('سرویس معامله در دسترس نیست.','error'); return; }
      const result = await api.cancel({ id: dealId, userId: currentUser.id });
      if (!result || !result.ok) {
          showToast((result && result.message) || 'لغو کار انجام نشد.','error');
          return;
      }
      if (result.data && result.data.snapshot) applyServerSnapshot(result.data.snapshot);
      showToast((result.message) || 'کار لغو شد','success');
      renderMobileProposals();
  }

  global.cancelDeal = cancelDeal;

  async function completeDeal(dealId){
      if (!currentUser) return;
      const api = window.KeloService && window.KeloService.deals;
      if (!api) { showToast('سرویس معامله در دسترس نیست.','error'); return; }
      const result = await api.complete({ id: dealId, userId: currentUser.id });
      if (!result || !result.ok) {
          showToast((result && result.message) || 'ثبت اتمام کار انجام نشد.','error');
          return;
      }
      if (result.data && result.data.snapshot) applyServerSnapshot(result.data.snapshot);
      showToast((result.message) || 'اتمام کار ثبت شد','success');
      renderMobileProposals();
  }

  global.completeDeal = completeDeal;

  async function submitDealReport(dealId){
      if (!currentUser) return;
      const ratings = window.__keloReportRatings || {};
      const noteEl = document.getElementById('reportNote');
      const note = noteEl ? String(noteEl.value || '').slice(0, 2000) : '';
      const api = window.KeloService && window.KeloService.notifications;
      if (!api) { showToast('سرویس گزارش در دسترس نیست.','error'); return; }
      const result = await api.createReview({
          dealId: dealId,
          userId: currentUser.id,
          ratings: ratings,
          note: note
      });
      if (!result || !result.ok) {
          showToast((result && result.message) || 'ثبت گزارش انجام نشد.','error');
          return;
      }
      if (result.data && result.data.snapshot) applyServerSnapshot(result.data.snapshot);
      closeDealReport();
      showToast((result.message) || 'گزارش شما ثبت شد','success');
      if (typeof renderMobileProposals === 'function') renderMobileProposals();
      if (window.__keloInvoiceDetailDealId && String(window.__keloInvoiceDetailDealId) === String(dealId)) {
          openInvoiceDetail(dealId);
      } else if (document.getElementById('mobileAccountSheet') && document.querySelector('#mobileAccountSheet .invoice-deal-card, #mobileAccountSheet .invoice-summary-card')) {
          renderMobileAccountSection('invoice');
      }
  }

  global.submitDealReport = submitDealReport;

  async function submitDealProblemReport(dealId){
      if (!currentUser) return;
      const picked = document.querySelector('input[name="keloProblemReason"]:checked');
      if (!picked) { showToast('لطفاً یک مورد را انتخاب کنید','error'); return; }
      const noteEl = document.getElementById('dealProblemNote');
      const note = noteEl ? noteEl.value.trim() : '';
      const api = window.KeloService && window.KeloService.notifications;
      if (!api) { showToast('سرویس گزارش در دسترس نیست.','error'); return; }
      const result = await api.reportProblem({
          dealId: dealId,
          userId: currentUser.id,
          reason: picked.value,
          note: note
      });
      if (!result || !result.ok) {
          showToast((result && result.message) || 'ثبت گزارش مشکل انجام نشد.','error');
          return;
      }
      if (typeof closeDealProblemReport === 'function') closeDealProblemReport();
      showToast((result.message) || 'گزارش مشکل ثبت شد','success');
  }

  global.submitDealProblemReport = submitDealProblemReport;

})(typeof window !== 'undefined' ? window : globalThis);
