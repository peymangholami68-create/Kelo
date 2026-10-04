/**
 * KELO — Proposal UI (Phase 15)
 * Offers list, proposals tab, notifications entry, domain bridges.
 */
(function (global) {
  'use strict';

  function mobileProposalRequests(){
      return qdb().requests
          .filter(r=>r.userId===currentUser.id)
          .slice()
          .sort((a,b)=>String(b.created||'').localeCompare(String(a.created||'')));
  }

  global.mobileProposalRequests = mobileProposalRequests;

  function getMyReceivedOffers(){
      return qdb().requestRecipients
          .filter(x => x.providerId === currentUser.id && x.status === 'pending')
          .filter(x => {
              const req = qdb().requests.find(r => r.id === x.requestId);
              if(!req) return false;
              const s = req.effectiveStatus || req.status;
              // درخواست منقضی/لغو/تمام → پیشنهاد بی‌معنی
              if(s === 'expired' || s === 'cancelled' || s === 'completed') return false;
              // درخواست توافق شده (با کسی دیگر) → این پیشنهاد بی‌معنی
              if(s === 'agreed' || s === 'accepted' || s === 'in_progress') return false;
              return true;
          })
          .slice()
          .sort((a,b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
  }

  global.getMyReceivedOffers = getMyReceivedOffers;

  function formatOfferUnitLine(offer, req){
      if(!req) return '';
      const area = Number(req.data?.area) || Number(req.data?.amount) || 0;
      const unitPrice = Number(offer.unitPrice) || 0;
      const unit = offer.priceUnit || '';
      if(area && unitPrice){
          const unitShort = unit.includes('هکتار') ? 'هکتار' : unit.includes('تن') ? 'تن' : '';
          return unitShort ? (toPersianDigits(area) + ' ' + unitShort + ' × ' + formatMoney(unitPrice)) : formatMoney(unitPrice);
      }
      return '';
  }

  global.formatOfferUnitLine = formatOfferUnitLine;

  function renderMobileOffersList(){
      const recipients = getMyReceivedOffers();
      if(!recipients.length) return keloEmptyStateHtml('چیزی اینجا نیست', 'پیشنهادهای ارسالی به درخواست شما، پس از ارسال اینجا نمایش داده می‌شود.');
      return recipients.map(o => {
          const req = qdb().requests.find(r => r.id === o.requestId);
          if(!req) return '';
          let historyChip = '';
          if (o.status === 'rejected') {
              historyChip = '<span class="kelo-history-chip">سابقه رد پیشنهاد</span>';
          } else {
              var otherId = String(o.proposerId || o.userId || '');
              var cancelled = (qdb().deals || []).some(function(d){
                  return d.status === 'cancelled'
                    && (String(d.requestId) === String(o.requestId) || String(d.requestId) === String(req.id))
                    && (String(d.providerId) === String(currentUser.id) || String(d.userId) === String(currentUser.id)
                        || String(d.providerId) === otherId || String(d.userId) === otherId);
              });
              if (cancelled || o.status === 'closed') {
                  // closed after agreement cancel often
                  var hasCancel = (qdb().deals || []).some(function(d){
                      return d.status === 'cancelled' && String(d.requestId) === String(o.requestId);
                  });
                  if (hasCancel) historyChip = '<span class="kelo-history-chip">سابقه لغو توافق</span>';
              }
          }
          var actions = '';
          if (o.status === 'pending') {
              actions = '<div class="offer-actions-row">'
                  +'<button type="button" class="btn btn-brand" onclick="acceptOffer(\''+o.id+'\')">پذیرش کار</button>'
                  +'<button type="button" class="btn btn-reject" onclick="rejectOffer(\''+o.id+'\')">رد کار</button>'
                  +'</div>';
          }
          // Prefer custom card head with chip when history exists
          if (historyChip && typeof renderKeloRequestCard === 'function') {
              return renderKeloRequestCard(req, { actions: actions, offerId: o.id, historyChip: historyChip });
          }
          return renderKeloRequestCard(req, { actions: actions, offerId: o.id });
      }).join('');
  }

  global.renderMobileOffersList = renderMobileOffersList;

  function renderMobileProposals(){
      const c=document.getElementById('appContent'); c.className='content';
      const tabsHtml = '<div class="mobile-orders-tabs">'
          +'<button type="button" class="mobile-orders-tab '+(mobileOrdersSubTab==='requests'?'active':'')+'" onclick="setMobileOrdersSubTab(\'requests\')">درخواست‌ها</button>'
          +'<button type="button" class="mobile-orders-tab '+(mobileOrdersSubTab==='offers'?'active':'')+'" onclick="setMobileOrdersSubTab(\'offers\')">پیشنهادها</button>'
          +'<button type="button" class="mobile-orders-tab '+(mobileOrdersSubTab==='deals'?'active':'')+'" onclick="setMobileOrdersSubTab(\'deals\')">توافق‌ها</button>'
          +'</div>';
      let bodyHtml='';
      if(mobileOrdersSubTab==='requests'){
          const requests=mobileProposalRequests();
          if(!requests.length){
              bodyHtml=keloEmptyStateHtml('چیزی اینجا نیست','درخواست‌های شما بعد از ثبت خدمت اینجا نمایش داده می‌شوند.','<button class="btn btn-brand" onclick="onMobilePlusClick()">ثبت درخواست</button>');
          }else{
              bodyHtml=requests.map(r=>{
                  const label=getRequestStatusLabel(r);
                  const cls=getRequestStatusClass(r);
                  const actions=(!isRequestInactive(r) && (r.status==='pending' || r.status==='created'))
                      ? '<div class="offer-actions-row"><button type="button" class="btn btn-brand" onclick="event.stopPropagation();editRequest(\''+r.id+'\')">ویرایش درخواست</button><button type="button" class="btn btn-reject" onclick="event.stopPropagation();deleteRequest(\''+r.id+'\')">حذف درخواست</button></div>'
                      : '';
                  const isProvide=(r.requestKind==='provide');
                  const city=requestCityName(r);
                  const date=requestCardDate(r);
                  const machine=(r.data && r.data.machineType) ? r.data.machineType : '';
                  const area=(r.data && (r.data.area || r.data.amount)) ? (r.data.area || r.data.amount) : (r.area_ha || null);
                  const price=(r.data && r.data.price) ? (fmtNum(r.data.price)+(r.data.priceUnit?(' '+r.data.priceUnit):'')) : '';
                  const subTitle = isProvide ? machine : (area ? (toPersianDigits(area) + ' هکتار') : '');
                  const subTitleHtml = subTitle ? '<div class="kelo-card-subtitle">' + escapeHtml(subTitle) + '</div>' : '';
                  const locDateLine = '<div style="display:flex;align-items:center;gap:14px;font-size:13px;color:#1F1F1F;font-weight:700;padding:2px 0;flex-wrap:wrap">'
                      + '<span style="display:inline-flex;align-items:center;gap:5px"><span class="kelo-icon-inline">' + keloCardIcon('location') + '</span>' + escapeHtml(city) + '</span>'
                      + '<span style="display:inline-flex;align-items:center;gap:5px"><span class="kelo-icon-inline">' + keloCardIcon('date') + '</span>' + escapeHtml(date) + '</span>'
                      + '</div>';
                  const priceBar = (isProvide && price) ? '<div class="offer-card-price">' + escapeHtml(price) + '</div>' : '';
                  const _inactive = isRequestInactive(r);
                  const _cardStyle = _inactive ? 'cursor:default;opacity:.65' : 'cursor:pointer';
                  const _onclickAttr = _inactive ? '' : ' onclick="openRequestOffersMap(\''+r.id+'\')"';
                  return '<div class="mobile-activity-card kelo-service-card" style="'+_cardStyle+'"'+_onclickAttr+'>'
                      +'<div class="kelo-card-head"><span class="kelo-card-head-icon">'+serviceCardIconSvg(r.service)+'</span><div style="flex:1;min-width:0"><strong style="display:block;font-size:14px;font-weight:800;color:#202020;line-height:1.4">'+escapeHtml(serviceName(r.service))+'</strong>'+subTitleHtml+'</div>'
                      +  '<span class="kelo-card-status '+cls+'">'+escapeHtml(label)+'</span></div>'
                      +'<div class="kelo-card-info-list">'+locDateLine+'</div>'
                      +priceBar
                      +actions+'</div>';
              }).join('');
          }}else if(mobileOrdersSubTab==='offers'){
          bodyHtml=renderMobileOffersList();
      }else{
          bodyHtml=renderMobileDealsList();
      }
      c.innerHTML=tabsHtml+'<div class="mobile-orders-body">'+bodyHtml+'</div>';
  }

  global.renderMobileProposals = renderMobileProposals;

    function openNotificationOffer(recipientId){
      if(!currentUser || !recipientId) return;
      closeMobileAccountSheet();
      setMobileOrdersSubTab('offers');
      setMobileTab('proposals');
      setTimeout(function(){
          var card = document.querySelector('[data-offer-id="' + recipientId + '"]');
          if(card){
              card.scrollIntoView({ behavior: 'smooth', block: 'center' });
              card.classList.add('kelo-card-highlight');
              setTimeout(function(){ card.classList.remove('kelo-card-highlight'); }, 1800);
          }
      }, 280);
  }

  global.openNotificationOffer = openNotificationOffer;

  function openNotificationDeepLink(kind, id, notifId){
      if(!currentUser) return;
      kind = String(kind || '');
      id = String(id || '');
      notifId = notifId ? String(notifId) : '';

      // Mark ONLY this notification as read
      (async function(){
          try {
              if (notifId && window.KeloBackend && window.KeloBackend.isServerMode && window.KeloBackend.isServerMode()
                  && typeof window.KeloBackend.markNotificationsRead === 'function') {
                  var result = await window.KeloBackend.markNotificationsRead([notifId]);
                  if (result && (result.data || result.ok) && typeof applyServerSnapshot === 'function') {
                      applyServerSnapshot(result.data || result);
                  }
              } else if (notifId && typeof db !== 'undefined' && Array.isArray(db.notifications)) {
                  db.notifications.forEach(function(n){
                      if (String(n.id) === notifId) n.readAt = new Date().toISOString();
                  });
              }
          } catch (e) {}
          if (typeof updateMobileHeader === 'function') {
              try { updateMobileHeader(document.getElementById('mobileAppTitle') && document.getElementById('mobileAppTitle').textContent); } catch (e2) {}
          }
      })();

      closeMobileAccountSheet();

      if (kind === 'proposal_rejected' || kind === 'request') {
          setMobileOrdersSubTab('requests');
          setMobileTab('proposals');
          setTimeout(function(){
              if (id && typeof openRequestOffersMap === 'function') {
                  try { openRequestOffersMap(id); } catch (e) {}
              }
          }, 280);
          return;
      }

      if (kind === 'deal_cancelled' || kind === 'deal_paid' || kind === 'deal') {
          setMobileOrdersSubTab('deals');
          setMobileTab('proposals');
          setTimeout(function(){
              var card = document.querySelector('[data-deal-id="' + id + '"]');
              if (card) {
                  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  card.classList.add('kelo-card-highlight');
                  setTimeout(function(){ card.classList.remove('kelo-card-highlight'); }, 1800);
              }
          }, 280);
          return;
      }

      // Invoice: open profile → فاکتور list and highlight the CARD (not detail sheet)
      if (kind === 'deal_completed' || kind === 'deal_awaiting_payment' || kind === 'deal_invoice' || kind === 'invoice') {
          setTimeout(function(){
              try {
                  if (typeof openMobileAccountSheet === 'function') openMobileAccountSheet();
                  else {
                      var bd = document.getElementById('mobileAccountBackdrop');
                      if (bd) {
                          bd.classList.add('open');
                          bd.setAttribute('aria-hidden', 'false');
                          document.body.style.overflow = 'hidden';
                      }
                  }
                  if (typeof renderMobileAccountSection === 'function') renderMobileAccountSection('invoice');
                  setTimeout(function(){
                      if (!id) return;
                      var card = document.querySelector(
                          '#mobileAccountSheet .invoice-deal-card[data-deal-id="' + id + '"], ' +
                          '#mobileAccountSheet [data-deal-id="' + id + '"]'
                      );
                      if (card) {
                          card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          card.classList.add('kelo-card-highlight');
                          setTimeout(function(){ card.classList.remove('kelo-card-highlight'); }, 2000);
                      }
                  }, 150);
              } catch (e) {
                  setMobileOrdersSubTab('deals');
                  setMobileTab('proposals');
              }
          }, 200);
          return;
      }
  }

  global.openNotificationDeepLink = openNotificationDeepLink;

  async function openMobileNotifications(){
      try {
          if (typeof refreshServerSnapshot === 'function') {
              await refreshServerSnapshot(false);
          }
      } catch (e) {}

      var allNotifs = (typeof qdb === 'function' ? (qdb().notifications || []) : []) || (typeof db !== 'undefined' && db.notifications) || [];
      var serverNotifs = allNotifs.filter(function(n){ return !n.readAt && !n.read_at; })
          .slice()
          .sort(function(a,b){ return new Date(b.createdAt || 0) - new Date(a.createdAt || 0); });

      const pending = (typeof getMyReceivedOffers === 'function')
          ? getMyReceivedOffers()
          : qdb().requestRecipients.filter(function(o){ return String(o.providerId) === String(currentUser.id) && o.status === 'pending'; });

      var cards = [];
      serverNotifs.forEach(function(n){
          var data = n.data || {};
          var kind = n.type || data.kind || '';
          var targetId = '';
          if (kind === 'proposal_rejected') targetId = data.requestId || '';
          else if (kind === 'deal_cancelled' || kind === 'deal_paid' || kind === 'deal_completed' || kind === 'deal_awaiting_payment' || kind === 'deal_invoice') {
              targetId = data.dealId || '';
          } else {
              targetId = data.dealId || data.requestId || data.recipientId || '';
          }
          var safeKind = String(kind).replace(/'/g, '');
          var safeId = String(targetId).replace(/'/g, '');
          var safeNotifId = String(n.id || '').replace(/'/g, '');
          var onclick = "openNotificationDeepLink('" + safeKind + "','" + safeId + "','" + safeNotifId + "')";
          cards.push(
              '<div class="mobile-activity-card notif-offer-card" role="button" tabindex="0" onclick="' + onclick + '">'
              + '<div class="activity-row"><div class="mobile-activity-main">'
              + '<strong>' + escapeHtml(n.title || 'اعلان') + '</strong>'
              + '<span class="activity-meta">' + escapeHtml(n.body || '') + '</span>'
              + '</div></div></div>'
          );
      });
      pending.forEach(function(o){
          const req = qdb().requests.find(function(r){ return r.id === o.requestId; });
          const serviceTitle = req
              ? (typeof dealInvoiceServiceTitle === 'function' ? dealInvoiceServiceTitle({ service: req.service }, req) : serviceName(req.service))
              : serviceName(o.service);
          cards.push(
              '<div class="mobile-activity-card notif-offer-card" role="button" tabindex="0" onclick="openNotificationOffer(\'' + o.id + '\')">'
              + '<div class="activity-row"><div class="mobile-activity-main">'
              + '<strong>پیشنهاد جدید</strong>'
              + '<span class="activity-meta">برای «' + escapeHtml(serviceTitle) + '» شما یک پیشنهاد دریافت کرده‌اید.</span>'
              + '</div></div></div>'
          );
      });
      const list = cards.length ? cards.join('') : '<div class="mobile-empty-state">اعلان جدیدی ندارید.</div>';
      const backdrop=document.getElementById('mobileAccountBackdrop');
      const sheet=document.getElementById('mobileAccountSheet');
      if(!backdrop||!sheet)return;
      if(!backdrop._keloBackdropBound){
          backdrop._keloBackdropBound = true;
          backdrop.addEventListener('click', function(e){ if(e.target === backdrop) closeMobileAccountSheet(); });
      }
      backdrop.classList.add('open');backdrop.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';
      sheet.innerHTML='<div class="mobile-account-head inner"><button type="button" class="mobile-account-back" onclick="closeMobileAccountSheet()" aria-label="بازگشت">'+KELO_BACK_CHEVRON_SVG+'</button><h2 class="mobile-account-title">اعلان‌ها</h2><span></span></div><div class="mobile-account-body">'+list+'</div>';
      attachSheetDragOnce(sheet);
      // Do NOT mark all as read here — only the tapped item is marked in openNotificationDeepLink
  }

  global.openMobileNotifications = openMobileNotifications;

function hasActiveProposalForRequest(requestId, userA, userB){
      if (window.KeloDomain && window.KeloDomain.proposal && window.KeloDomain.proposal.hasActiveProposalBetween) {
          return window.KeloDomain.proposal.hasActiveProposalBetween(qdb().requestRecipients, qdb().requests, requestId, userA, userB);
      }
      if(!requestId || !userA || !userB) return false;
      const a = String(userA);
      const b = String(userB);
      if(a === b) return false;
      return qdb().requestRecipients.some(function(rec){
          if(String(rec.requestId) !== String(requestId)) return false;
          if(rec.status !== 'pending' && rec.status !== 'accepted') return false;
          const relatedRequest = qdb().requests.find(function(r){ return String(r.id) === String(requestId); });
          if(!relatedRequest) return false;
          const proposerId = rec.proposerId || relatedRequest.userId;
          const recipientId = rec.recipientId || rec.providerId;
          if(!proposerId || !recipientId) return false;
          const p = String(proposerId);
          const r = String(recipientId);
          return (p === a && r === b) || (p === b && r === a);
      });
  }

  global.hasActiveProposalForRequest = hasActiveProposalForRequest;

  function hasProviderBookingConflict(providerId, machineId, start, end){
      if(!start || !end) return false;
      return qdb().bookings.some(b=>{
          if(b.status!=='confirmed' && b.status!=='active') return false;
          if(b.providerId!==providerId) return false;
          if(machineId && b.machineId!==machineId) return false;
          const bs=parseStoredDate(b.start || b.date);
          const be=parseStoredDate(b.end || b.start || b.date);
          return rangesOverlap(start,end,bs,be);
      });
  }

  global.hasProviderBookingConflict = hasProviderBookingConflict;

  function generateOffersForRequest(request){ return getEligibleProvidersForRequest(request); }

  global.generateOffersForRequest = generateOffersForRequest;

  function generateOffersForListing(listing){ return; }

  global.generateOffersForListing = generateOffersForListing;

  function sendOfferPeerLabel(request){
      // provide = ماشین‌دار برای کشاورز می‌فرستد؛ need = کشاورز برای ماشین‌دار
      if(request && request.requestKind === 'provide') return 'کشاورز';
      return 'ماشین‌دار';
  }

  global.sendOfferPeerLabel = sendOfferPeerLabel;

  function providerHasUnfinishedDeal(providerId){
      if (window.KeloDomain && window.KeloDomain.deal && window.KeloDomain.deal.providerHasUnfinishedDeal) {
          return window.KeloDomain.deal.providerHasUnfinishedDeal(qdb().deals, providerId);
      }
      return qdb().deals.some(d=>d.providerId===providerId && d.status!=='completed' && d.status!=='cancelled');
  }

  global.providerHasUnfinishedDeal = providerHasUnfinishedDeal;

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
      // Disable ALL send buttons for this sheet immediately to prevent double-tap
      try {
        document.querySelectorAll('.offer-item-btn.btn-brand').forEach(function(b){
          if (!b.disabled) {
            b.dataset.wasEnabled = '1';
            b.disabled = true;
          }
        });
      } catch (e) {}
      try{ return await sendRequestToProviderInner(providerId, requestId); }
      finally{
          delete window.__keloSending[_sendKey];
          const _b = document.querySelector('.request-offers-list-item[data-offer-id="'+String(providerId).replace(/"/g,'')+'"] .offer-item-btn');
          if(_b && _b.dataset && _b.dataset.origText && _b.disabled){ _b.disabled = false; _b.textContent = _b.dataset.origText; }
          try {
            document.querySelectorAll('.offer-item-btn.btn-brand').forEach(function(b){
              if (b.dataset.wasEnabled === '1' && b.textContent !== 'در حال ارسال…') {
                b.disabled = false;
                delete b.dataset.wasEnabled;
              }
            });
          } catch (e2) {}
      }
  }

  global.sendRequestToProvider = sendRequestToProvider;

  async function sendRequestToProviderInner(providerId, requestId){
      const _btn = document.querySelector('.request-offers-list-item[data-offer-id="'+String(providerId).replace(/"/g,'')+'"] .offer-item-btn');
      if (_btn) { _btn.dataset.origText = _btn.textContent; _btn.disabled = true; _btn.textContent = 'در حال ارسال…'; }
      if (!currentUser) return;

      const request = (window.KeloService && window.KeloService.query)
        ? window.KeloService.query.getMyRequest(requestId)
        : (qdb().requests.find(r => String(r.id) === String(requestId) && String(r.userId) === String(currentUser.id)));
      if (!request) { showToast('درخواست پیدا نشد','error'); return; }

      // candidate for API payload (server) — local adapter recomputes from helpers
      const candidate = getEligibleProvidersForRequest(request).find(x => x.providerId === providerId) || {
          providerId: providerId, listingId: null, machineId: null, unitPrice: 0, priceUnit: '', location: '', rating: null, data: {}
      };

      const api = window.KeloService && window.KeloService.proposals;
      if (!api) { showToast('سرویس پیشنهاد در دسترس نیست.','error'); return; }

      function _asUuidClient(v) {
          if (v == null || v === '') return null;
          var s = String(v).trim();
          return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s) ? s : null;
      }
      const result = await api.send({
          userId: currentUser.id,
          requestId: requestId,
          providerId: providerId,
          machineId: _asUuidClient(candidate.machineId),
          listingId: _asUuidClient(candidate.listingId),
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


  /**
   * Phase 18 — module facade (idempotent).
   * Handlers remain on window for HTML onclick compatibility.
   */
  var _inited = false;
  global.KeloProposalUI = {
    name: 'Proposal',
    init: function () {
      if (_inited) return global.KeloProposalUI;
      _inited = true;
      return global.KeloProposalUI;
    },
    isReady: function () { return _inited; }
  };
  // auto-register handlers already assigned to global above

})(typeof window !== 'undefined' ? window : globalThis);
