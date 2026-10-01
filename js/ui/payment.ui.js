/**
 * KELO — Payment UI handlers (Phase 10)
 * Event handlers + orchestration. Rendering still primarily in app.js.
 */
(function (global) {
  'use strict';

  async function payCash(dealId){
      closePaymentOptions();
      if (!currentUser) return;
      if (!confirm('آیا مبلغ را به صورت نقدی پرداخت کردید؟')) return;
      const api = window.KeloService && window.KeloService.payments;
      if (!api) { showToast('سرویس پرداخت در دسترس نیست.','error'); return; }
      const result = await api.pay({ id: dealId, userId: currentUser.id, method: 'cash' });
      if (!result || !result.ok) {
          showToast((result && result.message) || 'ثبت پرداخت انجام نشد.','error');
          return;
      }
      if (result.data && result.data.snapshot) applyServerSnapshot(result.data.snapshot);
      showToast((result.message) || 'پرداخت نقدی ثبت شد','success');
      renderMobileProposals();
  }

  global.payCash = payCash;

  async function payOnline(dealId){
      closePaymentOptions();
      const api = window.KeloService && window.KeloService.payments;
      if (!api) {
          showToast('پرداخت آنلاین به‌زودی متصل می‌شود.','info');
          return;
      }
      const result = await api.pay({ id: dealId, userId: currentUser && currentUser.id, method: 'online' });
      showToast((result && result.message) || 'پرداخت آنلاین به‌زودی متصل می‌شود.','info');
  }

  global.payOnline = payOnline;

  async function payDeal(dealId){
      if (!currentUser) return;
      const api = window.KeloService && window.KeloService.payments;
      if (!api) { showToast('سرویس پرداخت در دسترس نیست.','error'); return; }
      const result = await api.pay({ id: dealId, userId: currentUser.id, method: 'generic' });
      if (!result || !result.ok) {
          // Server online-not-ready used to show info toast
          const isInfo = result && result.code === 'NOT_IMPLEMENTED';
          showToast((result && result.message) || 'ثبت پرداخت انجام نشد.', isInfo ? 'info' : 'error');
          return;
      }
      if (result.data && result.data.snapshot) applyServerSnapshot(result.data.snapshot);
      if (result.data && result.data.alreadyPaid) {
          showToast((result.message) || 'این توافق قبلاً پرداخت شده است','success');
      } else {
          showToast((result.message) || 'پرداخت ثبت شد','success');
      }
      renderMobileProposals();
  }

  global.payDeal = payDeal;

  function openPaymentOptions(dealId){
      const d=(window.KeloService && window.KeloService.query)
        ? window.KeloService.query.getMyDeal(dealId)
        : db.deals.find(x=>x.id===dealId && String(x.userId)===String(currentUser.id));
      if(!d) return;
      if(d.paymentStatus==='paid'){ showToast('این توافق قبلاً پرداخت شده است','success'); return; }
      const el=document.getElementById('keloPaymentOptions'); if(el) el.remove();
      const total=Number(d.total)||0;
      const backdrop=document.createElement('div');
      backdrop.id='keloPaymentOptions';
      backdrop.className='mobile-sheet-backdrop level3';
      backdrop.innerHTML='<div class="mobile-sheet picker">'
          +'<button type="button" class="mobile-sheet-handle"></button>'
          +'<div class="mobile-sheet-header"><button type="button" class="mobile-sheet-back-btn" onclick="closePaymentOptions()">'+KELO_BACK_CHEVRON_SVG+'</button><h2>روش پرداخت</h2><span></span></div>'
          +'<div class="mobile-sheet-body">'
          +'<p style="text-align:center;margin:0 0 18px;color:#5A635C;font-size:14px">مبلغ قابل پرداخت: <strong style="color:#1F1F1F">'+formatMoney(total)+'</strong></p>'
          +'<button type="button" class="kelo-rate-row" onclick="payCash(\''+d.id+'\')"><span class="kelo-rate-label">پرداخت نقدی</span><span class="kelo-rate-check">›</span></button>'
          +'<button type="button" class="kelo-rate-row" onclick="payOnline(\''+d.id+'\')"><span class="kelo-rate-label">پرداخت آنلاین</span><span class="kelo-rate-check">›</span></button>'
          +'</div></div>';
      document.body.appendChild(backdrop);
  }

  global.openPaymentOptions = openPaymentOptions;

  function closePaymentOptions(){
      const el=document.getElementById('keloPaymentOptions'); if(el) el.remove();
  }

  global.closePaymentOptions = closePaymentOptions;

})(typeof window !== 'undefined' ? window : globalThis);
