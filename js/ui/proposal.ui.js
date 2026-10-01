/**
 * KELO — Proposal UI handlers (Phase 10)
 * Event handlers + orchestration. Rendering still primarily in app.js.
 */
(function (global) {
  'use strict';

  async function acceptOffer(id){
      if (!currentUser) return;
      const api = window.KeloService && window.KeloService.proposals;
      if (!api) { showToast('سرویس پیشنهاد در دسترس نیست.','error'); return; }

      const result = await api.accept({ id: id, userId: currentUser.id, userName: currentUser.name });
      if (!result || !result.ok) {
          showToast((result && result.message) || 'پذیرش درخواست انجام نشد.','error');
          if (window.KeloService && window.KeloService.mode && window.KeloService.mode() === 'server') {
              try { await refreshServerSnapshot(true); } catch (e) {}
          }
          renderMobileProposals();
          return;
      }
      if (result.data && result.data.snapshot) applyServerSnapshot(result.data.snapshot);
      showToast((result.message) || 'کار با شما توافق شد','success');
      goBackFromOffersMap();
      setMobileOrdersSubTab('deals');
      setMobileTab('proposals');
  }

  global.acceptOffer = acceptOffer;

  async function rejectOffer(recipientId){
      if (!currentUser) return;
      if (!confirm('این درخواست رد شود؟')) return;
      const api = window.KeloService && window.KeloService.proposals;
      if (!api) { showToast('سرویس پیشنهاد در دسترس نیست.','error'); return; }
      const result = await api.reject({ id: recipientId, userId: currentUser.id });
      if (!result || !result.ok) {
          showToast((result && result.message) || 'رد درخواست انجام نشد.','error');
          renderMobileProposals();
          return;
      }
      if (result.data && result.data.snapshot) applyServerSnapshot(result.data.snapshot);
      showToast((result.message) || 'درخواست رد شد','success');
      renderMobileProposals();
      updateMobileHeader('کارهای من');
  }

  global.rejectOffer = rejectOffer;

  async function rejectIncomingProposal(recipientId, requestId){
      if (!currentUser) return;
      if (!confirm('رد این درخواست؟')) return;
      const api = window.KeloService && window.KeloService.proposals;
      if (!api) { showToast('سرویس پیشنهاد در دسترس نیست.','error'); return; }
      const result = await api.reject({ id: recipientId, userId: currentUser.id });
      if (!result || !result.ok) {
          showToast((result && result.message) || 'رد درخواست انجام نشد.','error');
          openRequestOffersMap(requestId);
          return;
      }
      if (result.data && result.data.snapshot) applyServerSnapshot(result.data.snapshot);
      showToast((result.message) || 'درخواست رد شد','success');
      openRequestOffersMap(requestId);
  }

  global.rejectIncomingProposal = rejectIncomingProposal;

  async function cancelRecipient(recipientId, requestId){
      if (!currentUser) return;
      if (!confirm('لغو ارسال این پیشنهاد؟')) return;
      const api = window.KeloService && window.KeloService.proposals;
      if (!api) { showToast('سرویس پیشنهاد در دسترس نیست.','error'); return; }
      const result = await api.cancel({ id: recipientId, userId: currentUser.id });
      if (!result || !result.ok) {
          showToast((result && result.message) || 'لغو ارسال انجام نشد.','error');
          openRequestOffersMap(requestId);
          return;
      }
      if (result.data && result.data.snapshot) applyServerSnapshot(result.data.snapshot);
      showToast((result.message) || 'ارسال لغو شد','success');
      openRequestOffersMap(requestId);
  }

  global.cancelRecipient = cancelRecipient;

  async function sendRequestToProvider(providerId, requestId){
      window.__keloSending = window.__keloSending || {};
      const _sendKey = String(requestId)+':'+String(providerId);
      if(window.__keloSending[_sendKey]) return;
      window.__keloSending[_sendKey] = true;
      try{ return await sendRequestToProviderInner(providerId, requestId); }
      finally{
          delete window.__keloSending[_sendKey];
          // If the send failed (or bailed out early) the sheet was not re-rendered:
          // put the button back so the user can try again.
          const _b = document.querySelector('.request-offers-list-item[data-offer-id="'+String(providerId).replace(/"/g,'')+'"] .offer-item-btn');
          if(_b && _b.dataset && _b.dataset.origText && _b.disabled){ _b.disabled = false; _b.textContent = _b.dataset.origText; }
      }
  }

  global.sendRequestToProvider = sendRequestToProvider;

  async function sendRequestToProviderInner(providerId, requestId){
      const _btn = document.querySelector('.request-offers-list-item[data-offer-id="'+String(providerId).replace(/"/g,'')+'"] .offer-item-btn');
      if (_btn) { _btn.dataset.origText = _btn.textContent; _btn.disabled = true; _btn.textContent = 'در حال ارسال…'; }
      if (!currentUser) return;

      const request = (window.KeloService && window.KeloService.query)
        ? window.KeloService.query.getMyRequest(requestId)
        : (db.requests.find(r => r.id === requestId && r.userId === currentUser.id));
      if (!request) { showToast('درخواست پیدا نشد','error'); return; }

      // candidate for API payload (server) — local adapter recomputes from helpers
      const candidate = getEligibleProvidersForRequest(request).find(x => x.providerId === providerId) || {
          providerId: providerId, listingId: null, machineId: null, unitPrice: 0, priceUnit: '', location: '', rating: null, data: {}
      };

      const api = window.KeloService && window.KeloService.proposals;
      if (!api) { showToast('سرویس پیشنهاد در دسترس نیست.','error'); return; }

      const result = await api.send({
          userId: currentUser.id,
          requestId: requestId,
          providerId: providerId,
          machineId: candidate.machineId || null,
          listingId: candidate.listingId || null,
          unitPrice: candidate.unitPrice,
          priceUnit: candidate.priceUnit,
          location: candidate.location
      });
      if (!result || !result.ok) {
          showToast((result && result.message) || 'ارسال درخواست انجام نشد.','error');
          return;
      }
      if (result.data && result.data.snapshot) applyServerSnapshot(result.data.snapshot);
      showToast((result.message) || sendOfferSuccessToast(request), 'success');
      openRequestOffersMap(requestId);
      updateMobileHeader(sendOfferMapHeader(request));
  }

  global.sendRequestToProviderInner = sendRequestToProviderInner;

})(typeof window !== 'undefined' ? window : globalThis);
