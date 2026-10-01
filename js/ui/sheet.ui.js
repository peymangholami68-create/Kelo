/**
 * KELO — Sheet UI (Phase 17)
 */
(function (global) {
  'use strict';

  function qRecipients() {
    var Q = global.KeloService && global.KeloService.query;
    if (Q) return Q.recipients();
    return (global.db && global.qRecipients()) || [];
  }


  function showToast(message, type){
      type = type || 'info';
      let toast = document.getElementById('keloToast');
      if(!toast){ toast = document.createElement('div'); toast.id = 'keloToast'; document.body.appendChild(toast); }
      toast.className = 'kelo-toast ' + type + ' show';
      toast.textContent = message;
      clearTimeout(window._keloToastTimer);
      window._keloToastTimer = setTimeout(function(){ toast.classList.remove('show'); }, 2800);
  }

  global.showToast = showToast;

  function attachSheetDragOnce(sheet){ if(!sheet) return; sheet._keloDragAttached = true; }

  global.attachSheetDragOnce = attachSheetDragOnce;

  function attachGenericSheetDrag(sheet, onClose){
      if(!sheet || sheet._keloGenericDrag) return;
      if(document.documentElement.getAttribute('data-viewport') !== 'mobile') return;
      sheet._keloGenericDrag = true;
      let drag = null;
      const start = function(clientY){ const h = sheet.getBoundingClientRect().height; drag = { startY: clientY, startH: h, parentH: window.innerHeight }; sheet.style.transition = 'none'; };
      const move = function(clientY){ if(!drag) return; const dy = clientY - drag.startY; const newH = Math.max(drag.parentH * 0.15, Math.min(drag.parentH * 1.0, drag.startH - dy)); sheet.style.height = newH + 'px'; };
      const end = function(){ if(!drag) return; sheet.style.transition = ''; const h = sheet.getBoundingClientRect().height; const ratio = h / drag.parentH; sheet.style.height = ''; if(ratio < 0.55){ if(onClose) onClose(); } drag = null; };
      sheet.addEventListener('touchstart', function(e){ const t = e.touches[0]; if(!t) return; if(e.target.closest('button, input, textarea, select, a')) return; const scrollBody = e.target.closest('.mobile-account-body, .mobile-sheet-body, .request-offers-sheet-body'); if(scrollBody && scrollBody.scrollTop > 0) return; start(t.clientY); }, {passive:true});
      sheet.addEventListener('touchmove', function(e){ if(!drag) return; const t = e.touches[0]; if(!t) return; if(e.cancelable) e.preventDefault(); move(t.clientY); }, {passive:false});
      sheet.addEventListener('touchend', end);
      sheet.addEventListener('touchcancel', end);
  }

  global.attachGenericSheetDrag = attachGenericSheetDrag;

  function updateMobileHeader(title){
      const t=document.getElementById('mobileAppTitle'); if(t)t.textContent=title||'خانه';
      const nav=document.getElementById('mobileBottomNav');
      if(nav){ nav.querySelectorAll('button[data-tab]').forEach(b=>{ b.classList.toggle('active', b.dataset.tab === window.__keloMobileTab); }); }
      const badge=document.getElementById('mobileNotificationBadge');
      if(badge && currentUser){ const n=qRecipients().filter(o=>o.providerId===currentUser.id && o.status==='pending').length; badge.textContent=toPersianDigits(n); badge.classList.toggle('hidden',!n); }
      const calBadge = document.getElementById('mobileCalendarBadge');
      if(calBadge && currentUser){
          try{
              const items = collectScheduledItems();
              const today = new Date(); today.setHours(0,0,0,0);
              const tomorrowEnd = new Date(today); tomorrowEnd.setDate(tomorrowEnd.getDate()+1); tomorrowEnd.setHours(23,59,59,999);
              const todayMs = today.getTime();
              const endMs = tomorrowEnd.getTime();
              const count = items.filter(it => { const s = it.start.getTime(); const e = it.end.getTime(); return s <= endMs && e >= todayMs; }).length;
              calBadge.textContent = toPersianDigits(count);
              calBadge.classList.toggle('hidden', !count);
          }catch(e){ calBadge.classList.add('hidden'); }
      }
      updateMobileAccountIdentity();
  }

  global.updateMobileHeader = updateMobileHeader;

  function setMobileTab(tab){
      const nav=document.getElementById('mobileBottomNav');
      if(nav){ if(tab === 'request-offers') nav.classList.add('hidden'); else nav.classList.remove('hidden'); }
      if(tab !== 'request'){ if(wizard.formSheetOpen) closeMobileFormSheet(); if(wizard.servicePickerOpen) closeMobileServicePicker(); }
      if(window.__keloMobileTab === 'request-offers' && tab !== 'request-offers'){ if(window._keloOffersMap){ try{ window._keloOffersMap.remove(); }catch(e){} window._keloOffersMap = null; } window._keloOffersMarkers = {}; }
      closeMobileMapPickerOverlay();
      window.__keloMobilePreviousTab=window.__keloMobileTab||'home';
      window.__keloMobileTab=tab;
      try{ sessionStorage.setItem(TAB_KEY, tab); }catch(e){}
      const app=document.getElementById('app');
      if(app){app.classList.remove('mobile-tab-home','mobile-tab-request','mobile-tab-proposals','mobile-tab-request-offers');app.classList.add('mobile-tab-'+tab);}
      document.getElementById('sidebar').innerHTML='';
      document.getElementById('sidebar').dataset.mobileSheetOpen='1';
      if(tab==='home') renderMobileHome();
      else if(tab==='request') renderMobileRequest();
      else if(tab==='proposals') renderMobileProposals();
      updateMobileHeader(tab==='home'?'خانه':tab==='request'?'ثبت درخواست':'کارهای من');
  }

  global.setMobileTab = setMobileTab;

  function setMobileOrdersSubTab(tab){
      const allowed = ['requests','offers','deals'];
      mobileOrdersSubTab = allowed.includes(tab) ? tab : 'requests';
      renderMobileProposals();
  }

  global.setMobileOrdersSubTab = setMobileOrdersSubTab;

  function setMobileSheet(open){ const c=document.getElementById('sidebar'); if(!c)return; c.dataset.mobileSheetOpen=open?'1':'0'; }

  global.setMobileSheet = setMobileSheet;

  function openMobileFormSheet(type){
      if(!currentUser) return;
      wizard = makeEmptyWizard();
      wizard.type = type;
      wizard.formSheetOpen = true;
      const theme = type === 'provide' ? 'orange' : 'blue';
      document.documentElement.setAttribute('data-form-theme', theme);
      if(!wizard.data.dateStart) wizard.data.dateStart = localDateToIso(new Date());
      if(type === 'provide' && !wizard.data.priceUnit) wizard.data.priceUnit = 'تومان / هکتار';
      mobileL2Fields().forEach(function(f){
          if(f[2] === 'areaSlider' && wizard.data[f[0]] === undefined){
              wizard.data[f[0]] = f[3].default;
          }
      });
      renderMobileFormSheet();
  }

  global.openMobileFormSheet = openMobileFormSheet;

  function closeMobileFormSheet(){
      wizard.formSheetOpen = false;
      wizard.servicePickerOpen = false;
      wizard.servicePickerTemp = null;
      wizard.servicePickerExpanded = null;
      wizard.servicePickerSearch = '';
      const el1 = document.getElementById('keloFormSheetBackdrop'); if(el1) el1.remove();
      const el2 = document.getElementById('keloServicePickerBackdrop'); if(el2) el2.remove();
      const el3 = document.getElementById('keloCalendarModal'); if(el3) el3.remove();
      const el4 = document.getElementById('keloPriceUnitSheet'); if(el4) el4.remove();
      const el5 = document.getElementById('keloActivityAreaSheet'); if(el5) el5.remove();
      document.body.style.overflow = '';
      document.documentElement.removeAttribute('data-form-theme');
  }

  global.closeMobileFormSheet = closeMobileFormSheet;

  function openMobileAccountSheet(){
      if(!currentUser || isAdmin(currentUser)) return;
      const el=document.getElementById('mobileAccountBackdrop');
      if(!el) return;
      if(!el._keloBackdropBound){
          el._keloBackdropBound = true;
          el.addEventListener('click', function(e){ if(e.target === el) closeMobileAccountSheet(); });
      }
      el.classList.add('open');
      el.setAttribute('aria-hidden','false');
      document.body.style.overflow='hidden';
      renderMobileAccountSection('profile');
  }

  global.openMobileAccountSheet = openMobileAccountSheet;

  function closeMobileAccountSheet(){
      const el=document.getElementById('mobileAccountBackdrop');
      if(el){el.classList.remove('open');el.setAttribute('aria-hidden','true');document.body.style.overflow='';}
      if(window._keloProfileMap){ try{ window._keloProfileMap.remove(); }catch(e){} window._keloProfileMap=null; }
      wizard._pendingProfileLocation = null;
      wizard._profileAutoGeoRequested = false;
  }

  global.closeMobileAccountSheet = closeMobileAccountSheet;

  function openPriceUnitSheet(){
      const options = ['تومان / هکتار','تومان / روز','تومان / سرویس'];
      const current = wizard.data.priceUnit || '';
      const listHtml = options.map(function(o){
          const isSel = o === current;
          return '<button type="button" class="kelo-rate-row '+(isSel?'selected':'')+'" onclick="choosePriceUnit(\''+escapeHtml(o)+'\')"><span class="kelo-rate-label">'+escapeHtml(o)+'</span>'+(isSel?'<span class="kelo-rate-check">✓</span>':'')+'</button>';
      }).join('');
      const html = '<button type="button" class="mobile-sheet-handle"></button><div class="mobile-sheet-header"><button type="button" class="mobile-sheet-back-btn" onclick="closePriceUnitSheet()" aria-label="بازگشت">'+KELO_BACK_CHEVRON_SVG+'</button><h2>واحد قیمت</h2><span></span></div><div class="mobile-sheet-body" style="padding:6px 0 12px">'+listHtml+'</div>';
      let backdrop = document.getElementById('keloPriceUnitSheet');
      if(!backdrop){ backdrop = document.createElement('div'); backdrop.id='keloPriceUnitSheet'; backdrop.className='mobile-sheet-backdrop level3'; document.body.appendChild(backdrop); }
      backdrop.innerHTML = '<div class="mobile-sheet picker">'+html+'</div>';
  }

  global.openPriceUnitSheet = openPriceUnitSheet;

  function closePriceUnitSheet(){ const el=document.getElementById('keloPriceUnitSheet'); if(el) el.remove(); }

  global.closePriceUnitSheet = closePriceUnitSheet;

  function closeRequestOffersSheet(){
      const el = document.getElementById('keloRequestOffersSheet');
      if(el) el.remove();
      document.body.style.overflow = '';
      disposeOffersMap();
      window._keloOffersMarkers = {};
  }

  global.closeRequestOffersSheet = closeRequestOffersSheet;

  function closeMobileSelectSheet(){ const el=document.getElementById('keloSelectSheet'); if(el) el.remove(); }

  global.closeMobileSelectSheet = closeMobileSelectSheet;

  function openActivityAreaSheet(){
      wizard.activityProvince = '';
      wizard.activitySearch = '';
      wizard.activityOpen = true;
      renderActivityAreaSheet();
  }

  global.openActivityAreaSheet = openActivityAreaSheet;

  function closeActivityAreaSheet(){
      wizard.activityOpen = false;
      wizard.activityProvince = '';
      wizard.activitySearch = '';
      const el = document.getElementById('keloActivityAreaSheet');
      if(el) el.remove();
      if(wizard.formSheetOpen) renderMobileFormSheet();
  }

  global.closeActivityAreaSheet = closeActivityAreaSheet;

  function renderActivityAreaSheet(){
      let backdrop = document.getElementById('keloActivityAreaSheet');
      if(!backdrop){
          backdrop = document.createElement('div');
          backdrop.id='keloActivityAreaSheet';
          backdrop.className='mobile-sheet-backdrop level3';
          document.body.appendChild(backdrop);
      }

      const saved = getActivityAreaRows();
      const selectedProvince = wizard.activityProvince || '';
      const cities = selectedProvince ? (KELO_GEOGRAPHY[selectedProvince]||[]) : [];
      const row = saved.find(x=>x.province===selectedProvince) || {province:selectedProvince,cities:[],all:false};
      const selectedCities = Array.isArray(row.cities)?row.cities:[];
      const allSelected = !!row.all;
      const search = (wizard.activitySearch||'').trim().toLowerCase();
      const filteredCities = search ? cities.filter(c=>c.toLowerCase().includes(search)) : cities;

      let selectionChips = '';
      if(saved.length){
          selectionChips = saved.map(savedRow=>{
              if(savedRow.all) return '<span class="activity-city-chip">'+escapeHtml(savedRow.province)+': همه <button type="button" onclick="removeActivityProvince(\''+escapeHtml(savedRow.province)+'\')">×</button></span>';
              return (savedRow.cities||[]).map(city=>'<span class="activity-city-chip">'+escapeHtml(savedRow.province)+': '+escapeHtml(city)+' <button type="button" onclick="removeActivityCity(\''+escapeHtml(savedRow.province)+'\',\''+escapeHtml(city)+'\')">×</button></span>').join('');
          }).join('');
      }

      const searchHtml = '<div class="mobile-sheet-search-wrap"><div class="mobile-sheet-search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><input type="text" placeholder="'+(selectedProvince?'جستجوی شهرستان...':'جستجوی استان...')+'" value="'+escapeHtml(wizard.activitySearch||'')+'" oninput="'+(selectedProvince?'filterActivityCities(this.value)':'filterActivityProvinces(this.value)')+'"></div></div>';

      let contentHtml = '';
      if(selectedProvince){
          const cityOptions = filteredCities.map(city=>{
              const checked = allSelected || selectedCities.includes(city);
              return '<label class="activity-city-option"><input type="checkbox" '+(checked?'checked':'')+' onchange="toggleActivityCity(\''+escapeHtml(selectedProvince)+'\',\''+escapeHtml(city)+'\',this.checked)"><span>'+escapeHtml(city)+'</span></label>';
          }).join('');
          contentHtml = searchHtml
              + '<button type="button" class="activity-back-option" onclick="backToActivityProvinces(event)"><i class="kelo-chevron right"></i> بازگشت به استان‌ها</button>'
              + '<div class="activity-city-checklist">'
              +   '<label class="activity-city-option all-cities"><input type="checkbox" '+(allSelected?'checked':'')+' onchange="toggleAllCities(\''+escapeHtml(selectedProvince)+'\',this.checked)"><span>همه شهرستان‌ها</span></label>'
              +   (cityOptions || '<div class="activity-empty">یافت نشد.</div>')
              + '</div>';
      } else {
          const provinceOptions = renderActivityProvinceOptions(search);
          contentHtml = searchHtml + '<div class="activity-province-list">'+provinceOptions+'</div>';
      }

      const chipsHtml = selectionChips ? '<div class="activity-selection-chips">'+selectionChips+'</div>' : '';

      const html = '<button type="button" class="mobile-sheet-handle"></button>'
          + '<div class="mobile-sheet-header"><button type="button" class="mobile-sheet-back-btn" onclick="closeActivityAreaSheet()" aria-label="بازگشت">'+KELO_BACK_CHEVRON_SVG+'</button><h2>محدوده فعالیت</h2><span></span></div>'
          + '<div class="mobile-sheet-body">'
          +   chipsHtml
          +   contentHtml
          + '</div>'
          + '<div class="mobile-sheet-footer"><button type="button" class="btn btn-primary" onclick="confirmActivityAreaSheet()" '+(saved.length?'':'disabled')+'>تأیید</button></div>';

      let sheet = backdrop.querySelector('.mobile-sheet');
      if(!sheet){
          sheet = document.createElement('div');
          sheet.className = 'mobile-sheet picker';
          backdrop.appendChild(sheet);
      }
      sheet.innerHTML = html;
  }

  global.renderActivityAreaSheet = renderActivityAreaSheet;

  function confirmActivityAreaSheet(){
      if(!getActivityAreaRows().length) return;
      wizard.activityOpen = false;
      wizard.activityProvince = '';
      wizard.activitySearch = '';
      clearFieldError('activityArea');
      saveWizardDraft();
      const el = document.getElementById('keloActivityAreaSheet');
      if(el) el.remove();
      if(wizard.formSheetOpen) renderMobileFormSheet();
  }

  global.confirmActivityAreaSheet = confirmActivityAreaSheet;

  function isActivitySheetOpen(){ return !!document.getElementById('keloActivityAreaSheet'); }

  global.isActivitySheetOpen = isActivitySheetOpen;

  function sendOfferSuccessToast(request){
      return 'پیشنهاد برای ' + sendOfferPeerLabel(request) + ' ارسال شد';
  }

  global.sendOfferSuccessToast = sendOfferSuccessToast;

  function sendOfferAlreadyToast(request){
      return 'این پیشنهاد قبلاً برای این ' + sendOfferPeerLabel(request) + ' ارسال شده است';
  }

  global.sendOfferAlreadyToast = sendOfferAlreadyToast;

  function sendOfferUnavailableToast(request){
      return request && request.requestKind === 'provide'
          ? 'این کشاورز در حال حاضر برای این تاریخ در دسترس نیست'
          : 'این ماشین‌دار در حال حاضر برای این تاریخ در دسترس نیست';
  }

  global.sendOfferUnavailableToast = sendOfferUnavailableToast;

  function keloEmptyStateHtml(title, desc, actionHtml){
      const icon = '<svg viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M3 12h18"/></svg>';
      return '<div class="kelo-empty-state-box"><div class="kelo-empty-icon">'+icon+'</div><h3 class="kelo-empty-title">'+escapeHtml(title)+'</h3><p class="kelo-empty-desc">'+escapeHtml(desc)+'</p>'+(actionHtml?'<div class="kelo-empty-action">'+actionHtml+'</div>':'')+'</div>';
  }

  global.keloEmptyStateHtml = keloEmptyStateHtml;

  function keloCardIcon(type){
      const common='viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
      const icons={
          machine:'<svg '+common+'><rect x="2" y="9" width="14" height="8" rx="1.5"/><circle cx="6" cy="19" r="2"/><circle cx="14" cy="19" r="2"/><path d="M16 11h3l3 3v3h-2"/></svg>',
          area:'<svg '+common+'><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 3v18"/></svg>',
          location:'<svg '+common+'><path d="M12 22s-8-7.5-8-13a8 8 0 1 1 16 0c0 5.5-8 13-8 13z"/><circle cx="12" cy="9" r="3"/></svg>',
          date:'<svg '+common+'><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
          price:'<svg '+common+'><circle cx="12" cy="12" r="9"/><path d="M12 7v10M9 10h6M9 14h6"/></svg>',
          phone:'<svg '+common+'><rect x="6" y="3" width="12" height="18" rx="2"/><path d="M10 18h4"/></svg>',
          role:'<svg '+common+'><circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6"/></svg>'
      };
      return icons[type]||icons.location;
  }

  global.keloCardIcon = keloCardIcon;

  function keloCardInfo(type,label,value){
      if(!value || value==='—') return '';
      return '<div class="kelo-card-info">'
          +'<span class="kelo-card-info-icon">'+keloCardIcon(type)+'</span>'
          +'<span class="kelo-card-info-text"><small>'+escapeHtml(label)+'</small>'
          +'<strong>'+escapeHtml(value)+'</strong></span>'
          +'</div>';
  }

  global.keloCardInfo = keloCardInfo;

  function keloRatingBadge(avg, count){
      return '<span class="kelo-rating-badge">'
          + '<svg class="kelo-rating-star" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14l-5-4.87 6.91-1.01L12 2z"/></svg>'
          + '<span class="kelo-rating-num">' + toPersianDigits(Number(avg).toFixed(1)) + '</span>'
          + '</span>';
  }

  global.keloRatingBadge = keloRatingBadge;


  /**
   * Phase 18 — module facade (idempotent).
   * Handlers remain on window for HTML onclick compatibility.
   */
  var _inited = false;
  global.KeloSheetUI = {
    name: 'Sheet',
    init: function () {
      if (_inited) return global.KeloSheetUI;
      _inited = true;
      return global.KeloSheetUI;
    },
    isReady: function () { return _inited; }
  };
  // auto-register handlers already assigned to global above

})(typeof window !== 'undefined' ? window : globalThis);
