/**
 * KELO — Request UI + form fields (Phase 17)
 */
(function (global) {
  'use strict';

  function saveWizardDraft(){
      if(!currentUser || isAdmin(currentUser)) return;
      if(!wizard.type) return;
      const draft = { type: wizard.type, service: wizard.service, data: wizard.data, serviceOptions: wizard.serviceOptions, ts: Date.now() };
      try{ localStorage.setItem(DRAFT_PREFIX + currentUser.id, JSON.stringify(draft)); }catch(e){}
  }

  global.saveWizardDraft = saveWizardDraft;

  function saveWizardDraftDebounced(){ clearTimeout(_draftSaveTimer); _draftSaveTimer = setTimeout(saveWizardDraft, 500); }

  global.saveWizardDraftDebounced = saveWizardDraftDebounced;

  function clearWizardDraft(){ if(!currentUser) return; try{ localStorage.removeItem(DRAFT_PREFIX + currentUser.id); }catch(e){} }

  global.clearWizardDraft = clearWizardDraft;

  function mobileL2Fields(){
      if(!wizard.type) return [];
      const fields = wizard.type === 'provide' ? PROVIDE_FIELDS.slice() : RECEIVE_FIELDS.slice();
      if(wizard.type === 'receive'){
          const mapField = fields.find(f => f[0] === 'serviceLocation');
          const others = fields.filter(f => f[0] !== 'serviceLocation');
          return others.concat(mapField ? [mapField] : []);
      }
      return fields;
  }

  global.mobileL2Fields = mobileL2Fields;

  function makeEmptyWizard(){
      return {
          step:1, type:null, service:null, data:{},
          activityProvince:"", activityOpen:false, activitySearch:"", mapPickMode:false,
          calendarId:"", calendarOpen:false, calendarYear:null, calendarMonth:null,
          calendarMulti:false, calendarRangeStart:null, calendarMinIso:null,
          mobilePicker:null,
          _pendingMapPoint:null,
          _profileMapMode:false,
          _pendingProfileLocation:null,
          _profileAutoGeoRequested:false,
          serviceOptions:{},
          formSheetOpen:false,
          servicePickerOpen:false,
          servicePickerTemp:null,
          servicePickerExpanded:null,
          servicePickerSearch:''
      };
  }

  global.makeEmptyWizard = makeEmptyWizard;

  function resetMobileWizardFlow(){ wizard = makeEmptyWizard(); }

  global.resetMobileWizardFlow = resetMobileWizardFlow;

  function mobileActivityFilterMatches(item,filter){ if(filter==='all') return true; return filter==='completed' ? (item.__kind==='request' && item.status==='accepted') : !(item.__kind==='request' && item.status==='accepted'); }

  global.mobileActivityFilterMatches = mobileActivityFilterMatches;

  function setMobileActivityFilter(filter){ mobileActivityFilter=filter||'all'; renderMobileAccountSection('activities'); }

  global.setMobileActivityFilter = setMobileActivityFilter;

  function renderMobileRequest(){
      const saved = sessionStorage.getItem('kelo_mobile_success');
      if(saved){ try{ const data = JSON.parse(saved); if(Date.now() - (data.ts||0) < 5 * 60 * 1000){ mobileRequestSuccess = true; mobileSuccessData = data; } else { sessionStorage.removeItem('kelo_mobile_success'); } }catch(e){ sessionStorage.removeItem('kelo_mobile_success'); } }
      if(mobileRequestSuccess){ renderMobileSuccessScreen(); return; }
      const c = document.getElementById('appContent');
      if(c){ c.className='content'; c.innerHTML=''; }
      setMobileSheet(true);
      renderMobileRequestBase();
  }

  global.renderMobileRequest = renderMobileRequest;

  function renderMobileRequestBase(){
      const sb = document.getElementById('sidebar');
      if(!sb) return;
      var quick = (window.KeloAssets && currentUser && window.KeloAssets.quickPicksHtml) ? window.KeloAssets.quickPicksHtml(currentUser.id) : '';
      sb.innerHTML = '<div class="mobile-request-base"><h2>چه کاری برایتان انجام دهیم؟</h2><p>یکی از گزینه‌های زیر را انتخاب کنید</p><div class="role-cards"><button type="button" class="role-card farmer" onclick="openMobileFormSheet(\'receive\')"><div class="role-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22V9"/><path d="M12 13C12 7 6 5 6 5s0 6 6 8"/><path d="M12 13c0-6 6-8 6-8s0 6-6 8"/></svg></div><strong>نیاز به خدمت دارم</strong><span>برای زمین من تراکتور یا کمباین بفرست</span></button><button type="button" class="role-card machine" onclick="openMobileFormSheet(\'provide\')"><div class="role-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="7" cy="18" r="3"/><circle cx="18" cy="18" r="2.5"/><path d="M2 14h3a2 2 0 0 1 2 2v3"/><path d="M7 13V6a1 1 0 0 1 1-1h3l2 5"/><path d="M13 10h4l2 4"/></svg></div><strong>خدمات ارائه می‌دم</strong><span>ماشین‌آلات من آماده کاره</span></button></div>' + quick + '</div>';
  }

  global.renderMobileRequestBase = renderMobileRequestBase;

  function requestRecipientCount(requestId, status){
      return qdb().requestRecipients.filter(x=>x.requestId===requestId && (!status || x.status===status)).length;
  }

  global.requestRecipientCount = requestRecipientCount;

  function isRequestExpired(r){
      if(!r) return false;
      return (r.effectiveStatus === 'expired');
  }

  global.isRequestExpired = isRequestExpired;

  function isRequestInactive(r){
      if(!r) return false;
      const s = r.effectiveStatus || r.status;
      // همه‌ی نقش‌ها: این وضعیت‌ها غیرفعال
      if(s === 'expired' || s === 'completed' || s === 'cancelled') return true;
      // توافق شده:
      if(s === 'agreed' || s === 'accepted' || s === 'in_progress'){
          const isRequester = String(r.userId) === String(currentUser.id);
          // کشاورز: یک‌بار مصرف → غیرفعال
          if(isRequester) return true;
          // ماشین‌دار: همچنان فعال تا date_end
          return false;
      }
      return false;
  }

  global.isRequestInactive = isRequestInactive;

  function getRequestStatusLabel(r){
      if(!r) return '';
      const s = r.effectiveStatus || r.status;
      if(s === 'completed') return 'تمام شده';
      if(s === 'cancelled') return 'لغو شده';
      if(s === 'expired') return 'منقضی شده';
      if(s === 'agreed' || s === 'accepted' || s === 'in_progress') return 'توافق شده';
      const hasPendingRecipients = qdb().requestRecipients.some(x => x.requestId === r.id && x.status === 'pending');
      if(hasPendingRecipients) return 'در حال بررسی';
      return 'ایجاد شده';
  }

  global.getRequestStatusLabel = getRequestStatusLabel;

  function getRequestStatusClass(r){
      if(!r) return 'progress';
      const s = r.effectiveStatus || r.status;
      if(s === 'completed') return 'completed';
      if(s === 'expired') return 'expired';
      if(s === 'cancelled') return 'cancelled';
      return 'progress';
  }

  global.getRequestStatusClass = getRequestStatusClass;

  function serviceCardIconSvg(service){
      const common='viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
      const icons={
          tractor:'<svg '+common+'><path d="M3 15v-5h7l2 5"/><path d="M12 15l3-8h3l3 3v5"/><circle cx="7" cy="17" r="3"/><circle cx="17" cy="17" r="3"/></svg>',
          planting:'<svg '+common+'><path d="M12 21v-8"/><path d="M12 13c0-3.5 3-6 6-6 0 3-2 6-6 6z"/><path d="M12 13c0-3.5-3-6-6-6 0 3 2 6 6 6z"/></svg>',
          spray:'<svg '+common+'><path d="M12 21a6 6 0 0 0 6-6c0-2-1-4-3-5.5-1.5-1-2.5-2.5-3-4-.5 1.5-1.5 3-3 4C7 11 6 13 6 15a6 6 0 0 0 6 6z"/></svg>',
          harvest:'<svg '+common+'><path d="M12 21V8"/><path d="M12 12c-2 0-4-1-4-4 2 0 4 1 4 4z"/><path d="M12 12c2 0 4-1 4-4-2 0-4 1-4 4z"/><path d="M12 16c-2 0-4-1-4-4 2 0 4 1 4 4z"/><path d="M12 16c2 0 4-1 4-4-2 0-4 1-4 4z"/></svg>',
          transport:'<svg '+common+'><rect x="2" y="7" width="12" height="10" rx="1"/><path d="M14 10h4l3 3v4h-7"/><circle cx="7" cy="19" r="2"/><circle cx="17" cy="19" r="2"/></svg>'
      };
      return icons[service]||icons.tractor;
  }

  global.serviceCardIconSvg = serviceCardIconSvg;

  function requestCardDate(r){
      const start = r && r.data ? (r.data.dateStart || r.data.date) : null;
      const end   = r && r.data ? r.data.dateEnd : null;
      if(start && end){
          const s = humanJalaliDate(start);
          const e = humanJalaliDate(end);
          return s === e ? s : s + ' تا ' + e;
      }
      return start ? humanJalaliDate(start) : '—';
  }

  global.requestCardDate = requestCardDate;

  function renderKeloRequestCard(req, options){
      if(!req) return '';
      options = options || {};
      const service = req.service;
      const isProvide = req.requestKind === 'provide';
      const city = requestCityName(req);
      const date = requestCardDate(req);
      const machine = (req.data && req.data.machineType) ? req.data.machineType : '';
      const area = (req.data && (req.data.area || req.data.amount)) ? (req.data.area || req.data.amount) : (req.area_ha || null);
      const priceText = (req.data && req.data.price) ? (fmtNum(req.data.price) + (req.data.priceUnit ? ' ' + req.data.priceUnit : '')) : '';
      let subTitle = '';
      if(isProvide && machine){
          subTitle = machine;
      } else if(!isProvide && area){
          subTitle = toPersianDigits(area) + ' هکتار';
      }
      const subTitleHtml = subTitle ? '<div class="kelo-card-subtitle">' + escapeHtml(subTitle) + '</div>' : '';
      const locDateLine = '<div style="display:flex;align-items:center;gap:14px;font-size:13px;color:#1F1F1F;font-weight:700;padding:2px 0;flex-wrap:wrap">'
          + '<span style="display:inline-flex;align-items:center;gap:5px"><span class="kelo-icon-inline">' + keloCardIcon('location') + '</span>' + escapeHtml(city) + '</span>'
          + '<span style="display:inline-flex;align-items:center;gap:5px"><span class="kelo-icon-inline">' + keloCardIcon('date') + '</span>' + escapeHtml(date) + '</span>'
          + '</div>';
      let priceBar = '';
      if(isProvide && priceText){
          priceBar = '<div class="offer-card-price">' + escapeHtml(priceText) + '</div>';
      }
      const extraAttrs = options.offerId
          ? (' data-offer-id="' + escapeHtml(String(options.offerId)) + '"')
          : (options.dealId ? (' data-deal-id="' + escapeHtml(String(options.dealId)) + '"') : '');
      const historyChip = options.historyChip || '';
      return '<div class="mobile-activity-card kelo-service-card"' + extraAttrs + '>'
          + '<div class="kelo-card-head" style="display:flex;align-items:center;gap:8px;width:100%">'
          +   '<span class="kelo-card-head-icon">' + serviceCardIconSvg(service) + '</span>'
          +   '<div style="flex:1;min-width:0"><strong style="display:block">' + escapeHtml(serviceName(service)) + '</strong>' + subTitleHtml + '</div>'
          +   historyChip
          + '</div>'
          + '<div class="kelo-card-info-list">' + locDateLine + '</div>'
          + priceBar
          + (options.actions || '')
          + '</div>';
  }

  global.renderKeloRequestCard = renderKeloRequestCard;

  function requestMatchesActivityArea(request,area){ if(!Array.isArray(area)||!area.length)return false; const reqLoc=request?.data?.serviceLocation; let reqPoint=reqLoc?.lat?[reqLoc.lat,reqLoc.lng]:null; if(!reqPoint && request?.data?.city) reqPoint=coordForCity(request.data.city); if(!reqPoint) return true; return area.some(row=>{ const cities=row.all?(KELO_GEOGRAPHY[row.province]||[]):(row.cities||[]); if(!cities.length) return true; return cities.some(city=>geoDistanceKm(reqPoint,coordForCity(city))<=50); }); }

  global.requestMatchesActivityArea = requestMatchesActivityArea;

  function renderMobileFormSheet(){
      if(!wizard.formSheetOpen) return;
      // Provide/Need dedicated pages own the UI — never spawn legacy form under them
      if (wizard._provideFlow || wizard._needFlow) return;
      let backdrop = document.getElementById('keloFormSheetBackdrop');
      let prevScroll = 0;
      if(backdrop){
          const prevBody = backdrop.querySelector('.mobile-sheet-body');
          if(prevBody) prevScroll = prevBody.scrollTop;
      }
      if(!backdrop){
          backdrop = document.createElement('div');
          backdrop.id = 'keloFormSheetBackdrop';
          backdrop.className = 'mobile-sheet-backdrop';
          document.body.appendChild(backdrop);
      }
      if(!wizard.data.dateStart) wizard.data.dateStart = localDateToIso(new Date());

      const title = wizard.type === 'provide' ? 'ارائه خدمت' : 'نیاز به خدمت';
      const serviceLabel = wizard.service ? SERVICE_DEFS[wizard.service].name : 'انتخاب کنید';
      const fields = mobileL2Fields();
      const fieldsHtml = renderMobileFormFields(fields);

      const headerHtml = '<button type="button" class="mobile-sheet-handle" aria-label="دستگیره"></button><div class="mobile-sheet-header"><button type="button" class="mobile-sheet-back-btn" onclick="closeMobileFormSheet()" aria-label="بازگشت">'+KELO_BACK_CHEVRON_SVG+'</button><h2>' + escapeHtml(title) + '</h2><span></span></div>';

      const serviceFieldHtml = '<div class="wizard-field-wrap" data-field-wrapper="service"><div class="sidebar-field"><label>نوع خدمت <span style="color:red">*</span></label><button type="button" class="mobile-choice-trigger" onclick="openMobileServicePicker()"><span class="' + (wizard.service ? '' : 'placeholder') + '">' + escapeHtml(serviceLabel) + '</span><span class="kelo-inline-chevron"><i class="kelo-chevron left"></i></span></button></div></div>';

      const bodyHtml = '<div class="mobile-sheet-body">' + serviceFieldHtml + '<div id="assetQuickMount"></div>' + fieldsHtml + '</div>';
      const footerHtml = '<div class="mobile-sheet-footer"><button type="button" class="btn btn-primary" onclick="submitMobileForm()">' + (wizard.type === 'provide' ? 'ثبت خدمت' : 'ثبت درخواست') + '</button></div>';

      let sheet = backdrop.querySelector('.mobile-sheet');
      if(!sheet){ sheet = document.createElement('div'); sheet.className = 'mobile-sheet'; backdrop.appendChild(sheet); }
      sheet.innerHTML = headerHtml + bodyHtml + footerHtml;
      document.body.style.overflow = 'hidden';

      requestAnimationFrame(function(){
          document.querySelectorAll('input[type=range][data-slider-id]').forEach(applySliderFill);
          if(wizard.type === 'receive' && fields.some(function(f){ return f[2] === 'mapLocation'; })) initializeInlineLocationMap();
          if(wizard.calendarOpen && wizard.calendarId) renderCalendarModal();
          const newBody = sheet.querySelector('.mobile-sheet-body');
          if(newBody && prevScroll > 0) newBody.scrollTop = prevScroll;
          /* wizard top providers removed per product */
          if (typeof keloAssetsRenderQuickPicks === 'function') {
              try { keloAssetsRenderQuickPicks(document.getElementById('assetQuickMount'), wizard.type); } catch(e) {}
          }
      });
  }

  global.renderMobileFormSheet = renderMobileFormSheet;

  function renderMobileFormFields(fields){
      let html = '';
      let i = 0;
      while(i < fields.length){
          const f = fields[i];
          const id = f[0];
          if((id === 'dateStart') && i+1 < fields.length && fields[i+1][0] === 'dateEnd'){
              html += '<div class="mobile-two-col"><div class="wizard-field-wrap" data-field-wrapper="dateStart">' + renderMobileDateField('dateStart','تاریخ شروع', true) + '</div><div class="wizard-field-wrap" data-field-wrapper="dateEnd">' + renderMobileDateField('dateEnd','تاریخ پایان', false) + '</div></div>';
              i += 2;
              continue;
          }
          if(id === 'price' && i+1 < fields.length && fields[i+1][0] === 'priceUnit'){
              html += '<div class="wizard-field-wrap" data-field-wrapper="price"><div class="sidebar-field"><label>قیمت <span style="color:red">*</span></label><div class="mobile-two-col"><div>' + renderMobilePriceInput(fields[i]) + '</div><div data-field-wrapper="priceUnit">' + renderMobilePriceUnitField(fields[i+1]) + '</div></div></div></div>';
              i += 2;
              continue;
          }
          html += '<div class="wizard-field-wrap" data-field-wrapper="'+id+'">' + renderMobileField(f) + '</div>';
          i++;
      }
      return html;
  }

  global.renderMobileFormFields = renderMobileFormFields;

  function submitMobileForm(){
      clearFieldErrors();
      if(!wizard.service){ showToast('لطفاً نوع خدمت را انتخاب کنید', 'error'); return; }
      const subs = SERVICE_L3_FIELDS[wizard.service] || [];
      for(let i=0;i<subs.length;i++){ const sf = subs[i]; if(!sf.required) continue; const v = wizard.serviceOptions[sf.id]; const empty = sf.multi ? (!Array.isArray(v) || !v.length) : !v; if(empty){ showToast('لطفاً یکی از گزینه‌ها را انتخاب کنید', 'error'); return; } }
      const fields = mobileL2Fields();
      let ok = true;
      for(let i=0;i<fields.length;i++){ if(!validateMobileField(fields[i])) ok = false; }
      if(!ok){ const err = document.querySelector('#keloFormSheetBackdrop .field-error'); if(err) err.scrollIntoView({behavior:'smooth', block:'center'}); return; }
      // Only merge service-sub-option keys; never clobber main form fields
      // (area, dates, price, ...) which live in wizard.data and may be newer.
      const formFieldIds = {};
      mobileL2Fields().forEach(function(f){ formFieldIds[f[0]] = true; });
      Object.keys(wizard.serviceOptions || {}).forEach(function(k){
          if (!formFieldIds[k]) wizard.data[k] = wizard.serviceOptions[k];
      });
      finalizeMobileForm();
  }

  global.submitMobileForm = submitMobileForm;

  function openMobileServicePicker(){
      wizard.servicePickerOpen = true;
      wizard._simpleServiceOnly = !!(wizard._needFlow || document.getElementById('keloProvideMachineForm'));
      wizard.servicePickerTemp = { service: wizard.service || null, options: JSON.parse(JSON.stringify(wizard.serviceOptions || {})) };
      wizard.servicePickerExpanded = wizard.service || null;
      wizard.servicePickerSearch = '';
      renderMobileServicePicker();
      // Need/Provide pages are z-index 5200+ — picker must sit above
      if (wizard && (wizard._needFlow || wizard._provideFlow || document.getElementById('keloProvideMachineForm'))) {
          var bd = document.getElementById('keloServicePickerBackdrop');
          if (bd) { bd.style.zIndex = '6800'; }
      }
  }

  global.openMobileServicePicker = openMobileServicePicker;

  function closeMobileServicePicker(){
      wizard.servicePickerOpen = false;
      wizard.servicePickerTemp = null;
      wizard.servicePickerExpanded = null;
      wizard.servicePickerSearch = '';
      const el = document.getElementById('keloServicePickerBackdrop');
      if(el) el.remove();
  }

  global.closeMobileServicePicker = closeMobileServicePicker;

  function filterServicePicker(value){
      wizard.servicePickerSearch = value || '';
      renderMobileServicePicker();
      requestAnimationFrame(function(){ const input = document.querySelector('.mobile-sheet-search input'); if(input){ input.focus(); try{ input.setSelectionRange(input.value.length, input.value.length); }catch(e){} } });
  }

  global.filterServicePicker = filterServicePicker;

  function renderMobileServicePicker(){
      if(!wizard.servicePickerOpen) return;
      let backdrop = document.getElementById('keloServicePickerBackdrop');
      if(!backdrop){ backdrop = document.createElement('div'); backdrop.id = 'keloServicePickerBackdrop'; backdrop.className = 'mobile-sheet-backdrop level3'; document.body.appendChild(backdrop); }
      if (wizard && (wizard._needFlow || wizard._provideFlow || document.getElementById('keloProvideMachineForm'))) {
          backdrop.style.zIndex = '6800';
      }
      const temp = wizard.servicePickerTemp || { service:null, options:{} };
      // Need flow + machine form service-only: just 4 services, no L3 chips
      const simpleMode = !!(wizard._needFlow || wizard._simpleServiceOnly);
      let cardsHtml = '';
      Object.keys(SERVICE_DEFS).forEach(function(key){
          const s = SERVICE_DEFS[key];
          if(!s) return;
          const selected = temp.service === key;
          if (simpleMode) {
              cardsHtml += '<button type="button" class="service-picker-simple' + (selected ? ' is-selected' : '') + '" onclick="pickSimpleService(\'' + key + '\')">'
                + '<strong>' + escapeHtml(s.name) + '</strong>'
                + (s.desc ? '<span>' + escapeHtml(s.desc) + '</span>' : '')
                + '</button>';
          } else {
              // legacy expandable (rare paths)
              cardsHtml += '<div class="service-picker-card' + (selected ? ' selected' : '') + '" onclick="toggleServicePickerCard(\'' + key + '\')">'
                + '<div class="service-picker-card-head"><strong>' + escapeHtml(s.name) + '</strong><i class="kelo-chevron ' + (wizard.servicePickerExpanded===key?'up':'down') + '"></i></div></div>';
          }
      });
      const headerHtml = '<button type="button" class="mobile-sheet-handle"></button><div class="mobile-sheet-header"><button type="button" class="mobile-sheet-back-btn" onclick="closeMobileServicePicker()" aria-label="بازگشت">'+KELO_BACK_CHEVRON_SVG+'</button><h2>نوع خدمت</h2><span></span></div>';
      const bodyHtml = '<div class="mobile-sheet-body"><div class="service-picker-simple-list">' + (cardsHtml || '<div style="text-align:center;padding:30px;color:#888">خدمتی تعریف نشده</div>') + '</div></div>';
      const footerHtml = '<div class="mobile-sheet-footer"><button type="button" class="btn btn-primary" onclick="confirmMobileServicePicker()">تایید</button></div>';
      let sheet = backdrop.querySelector('.mobile-sheet');
      if(!sheet){ sheet = document.createElement('div'); sheet.className = 'mobile-sheet picker'; backdrop.appendChild(sheet); }
      sheet.innerHTML = headerHtml + bodyHtml + footerHtml;
  }

  global.renderMobileServicePicker = renderMobileServicePicker;

  function pickSimpleService(key){
      if(!wizard.servicePickerTemp) wizard.servicePickerTemp = { service:null, options:{} };
      wizard.servicePickerTemp.service = key;
      wizard.servicePickerTemp.options = {};
      wizard.servicePickerExpanded = key;
      renderMobileServicePicker();
  }
  global.pickSimpleService = pickSimpleService;


  function toggleServicePickerCard(serviceKey){
      const body = document.querySelector('#keloServicePickerBackdrop .mobile-sheet-body');
      const scrollTop = body ? body.scrollTop : 0;
      if(wizard.servicePickerExpanded === serviceKey){
          wizard.servicePickerExpanded = null;
      } else {
          const prevService = wizard.servicePickerTemp ? wizard.servicePickerTemp.service : null;
          wizard.servicePickerExpanded = serviceKey;
          if(wizard.servicePickerTemp){
              // با عوض شدن خدمت، انتخاب چیپ‌های خدمت قبلی پاک شود
              if(prevService && prevService !== serviceKey){
                  wizard.servicePickerTemp.options = {};
              }
              wizard.servicePickerTemp.service = serviceKey;
              const subs = SERVICE_L3_FIELDS[serviceKey] || [];
              subs.forEach(function(sf){
                  if(wizard.servicePickerTemp.options[sf.id] === undefined){
                      wizard.servicePickerTemp.options[sf.id] = sf.multi ? [] : '';
                  }
              });
          }
      }
      renderMobileServicePicker();
      const body2 = document.querySelector('#keloServicePickerBackdrop .mobile-sheet-body');
      if(body2) body2.scrollTop = scrollTop;
  }

  global.toggleServicePickerCard = toggleServicePickerCard;

  function toggleServicePickerChip(fieldId, value, multi){
      const temp = wizard.servicePickerTemp;
      if(!temp) return;
      const body = document.querySelector('#keloServicePickerBackdrop .mobile-sheet-body');
      const scrollTop = body ? body.scrollTop : 0;
      if(multi){ let arr = Array.isArray(temp.options[fieldId]) ? temp.options[fieldId].slice() : []; const idx = arr.indexOf(value); if(idx >= 0) arr.splice(idx, 1); else arr.push(value); temp.options[fieldId] = arr; }
      else { temp.options[fieldId] = (temp.options[fieldId] === value) ? '' : value; }
      renderMobileServicePicker();
      const body2 = document.querySelector('#keloServicePickerBackdrop .mobile-sheet-body');
      if(body2) body2.scrollTop = scrollTop;
  }

  global.toggleServicePickerChip = toggleServicePickerChip;

  function confirmMobileServicePicker(){
      const temp = wizard.servicePickerTemp;
      if(!temp || !temp.service){ showToast('لطفاً یک خدمت انتخاب کنید', 'error'); return; }
      const simpleMode = !!(wizard._needFlow || wizard._simpleServiceOnly);
      if (!simpleMode) {
        const subs = SERVICE_L3_FIELDS[temp.service] || [];
        for(let i=0;i<subs.length;i++){ const sf = subs[i]; if(!sf.required) continue; const v = temp.options[sf.id]; const empty = sf.multi ? (!Array.isArray(v) || !v.length) : !v; if(empty){ showToast('لطفاً یکی از گزینه‌ها را انتخاب کنید', 'error'); return; } }
      }
      wizard.service = temp.service;
      // فقط گزینه‌های همان خدمت انتخاب‌شده
      const keep = {};
      (SERVICE_L3_FIELDS[temp.service] || []).forEach(function(sf){
          if(temp.options[sf.id] !== undefined) keep[sf.id] = temp.options[sf.id];
      });
      wizard.serviceOptions = JSON.parse(JSON.stringify(keep));
      closeMobileServicePicker();
      if (document.getElementById('keloProvideMachineForm')) {
          var prevSvc = (document.getElementById('provideMachineService') || {}).value || '';
          var lbl = document.getElementById('provideMachineServiceLabel');
          if (lbl) {
              var nm = (wizard.service && SERVICE_DEFS[wizard.service]) ? SERVICE_DEFS[wizard.service].name : 'انتخاب کنید';
              lbl.textContent = nm;
              lbl.classList.toggle('placeholder', !wizard.service);
          }
          var hid = document.getElementById('provideMachineService');
          if (hid) hid.value = wizard.service || '';
          // service changed → reset machine type to force re-pick from filtered list
          if (prevSvc && wizard.service && prevSvc !== wizard.service) {
              wizard._provideDraftMachineType = '';
              var mhid = document.getElementById('provideMachineType');
              if (mhid) mhid.value = '';
              var mlbl = document.getElementById('provideMachineTypeLabel');
              if (mlbl) { mlbl.textContent = 'انتخاب کنید'; mlbl.classList.add('placeholder'); }
          }
      } else if (wizard._needFlow) {
          var el1 = document.getElementById('keloFormSheetBackdrop');
          if (el1) el1.remove();
          if (typeof refreshNeedRequestFieldsOnly === 'function') refreshNeedRequestFieldsOnly();
          else if (typeof renderNeedRequestPage === 'function') renderNeedRequestPage();
      } else if (wizard._provideFlow && typeof refreshProvideRequestFieldsOnly === 'function') {
          refreshProvideRequestFieldsOnly();
      } else if (wizard._provideFlow && typeof renderProvideRequestPage === 'function') {
          renderProvideRequestPage();
      } else {
          renderMobileFormSheet();
      }
  }

  global.confirmMobileServicePicker = confirmMobileServicePicker;

  function getJalaliParts(date){ const parts=jalaliPartsFormatter.formatToParts(date).reduce((o,p)=>{ if(['year','month','day'].includes(p.type))o[p.type]=Number(p.value); return o; },{}); return {year:parts.year,month:parts.month,day:parts.day}; }

  global.getJalaliParts = getJalaliParts;

  function jalaliToDate(jy,jm,jd){
      jy=Number(jy); jm=Number(jm); jd=Number(jd);
      if(!jy||!jm||!jd) return null;
      const key=jy+'/'+jm+'/'+jd;
      if(jalaliDateCache.has(key)) return new Date(jalaliDateCache.get(key));
      // Start near Persian new year (~Mar 21) of corresponding Gregorian year
      const approx = new Date(Date.UTC(jy + 621, 2, 21, 12, 0, 0));
      // Cover full Persian year including Esfand (need >370 days window)
      for(let offset=-40; offset<=400; offset++){
        const candidate = new Date(approx.getTime());
        candidate.setUTCDate(approx.getUTCDate() + offset);
        const p = getJalaliParts(candidate);
        if(p.year===jy && p.month===jm && p.day===jd){
          jalaliDateCache.set(key, candidate.getTime());
          return candidate;
        }
      }
      return null;
  }

  global.jalaliToDate = jalaliToDate;

  function getJalaliMonthLength(year,month){
      month=Number(month);
      if(month>=1 && month<=6) return 31;
      if(month>=7 && month<=11) return 30;
      // Esfand: 29 or 30 — compute if possible, else 29 safe default
      try {
        const start=jalaliToDate(year,12,1), next=jalaliToDate(year+1,1,1);
        if(start && next) return Math.round((next-start)/86400000);
      } catch(e) {}
      return 29;
  }

  global.getJalaliMonthLength = getJalaliMonthLength;

  function shiftJalaliMonth(year,month,delta){ let m=month+delta,y=year; while(m<1){m+=12;y--;} while(m>12){m-=12;y++;} return {year:y,month:m}; }

  global.shiftJalaliMonth = shiftJalaliMonth;

  function jalaliIsoFromParts(y,m,d){ const dt=jalaliToDate(y,m,d); return dt?localDateToIso(dt):''; }

  global.jalaliIsoFromParts = jalaliIsoFromParts;

  function humanJalaliDate(value){ const date=parseStoredDate(value); if(!date)return String(value||''); const p=getJalaliParts(date); return toPersianDigits(p.day)+' '+JALALI_MONTH_NAMES[p.month-1]+' '+toPersianDigits(p.year); }

  global.humanJalaliDate = humanJalaliDate;

  function jalaliSelectedValue(id,multi){ const value=wizard.data[id]; if(multi)return Array.isArray(value)?value:[]; return typeof value==='string'?value:''; }

  global.jalaliSelectedValue = jalaliSelectedValue;

  function toggleJalaliPicker(id,multi,help){
      const isMobile = !!wizard.formSheetOpen;
      if(isMobile){
          wizard.calendarId=id; wizard.calendarOpen=true; wizard.calendarMulti=multi; wizard.calendarRangeStart=null;
          wizard.calendarMinIso = computeCalendarMinIso(id);
          const stored=jalaliSelectedValue(id,multi);
          let baseDate=null;
          if(multi && stored.length)baseDate=isoToLocalDate([...stored].sort()[0]);
          else if(!multi && stored)baseDate=parseStoredDate(stored);
          const p=baseDate?getJalaliParts(baseDate):getJalaliParts(new Date());
          wizard.calendarYear=p.year; wizard.calendarMonth=p.month;
          renderCalendarModal();
          return;
      }
      if(wizard.calendarOpen && wizard.calendarId===id){ wizard.calendarOpen=false; wizard.calendarId=''; wizard.calendarRangeStart=null; renderWizard(); return; }
      wizard.calendarId=id; wizard.calendarOpen=true; wizard.calendarMulti=multi; wizard.calendarRangeStart=null;
      wizard.calendarMinIso = computeCalendarMinIso(id);
      const stored=jalaliSelectedValue(id,multi);
      let baseDate=null;
      if(multi && stored.length)baseDate=isoToLocalDate([...stored].sort()[0]);
      else if(!multi && stored)baseDate=parseStoredDate(stored);
      const p=baseDate?getJalaliParts(baseDate):getJalaliParts(new Date());
      wizard.calendarYear=p.year; wizard.calendarMonth=p.month;
      renderWizard();
  }

  global.toggleJalaliPicker = toggleJalaliPicker;

  function changeJalaliMonth(delta){
      var next = shiftJalaliMonth(wizard.calendarYear, wizard.calendarMonth, delta);
      try {
        var nowP = getJalaliParts(new Date());
        var minY = nowP.year, minM = nowP.month;
        // Allow through end of next Persian year (full 12 months of next year)
        var maxY = minY + 1, maxM = 12;
        if (next.year < minY || (next.year === minY && next.month < minM)) next = { year: minY, month: minM };
        if (next.year > maxY || (next.year === maxY && next.month > maxM)) next = { year: maxY, month: maxM };
      } catch (e) {}
      wizard.calendarYear = next.year;
      wizard.calendarMonth = next.month;
      // Update calendar body in place — do NOT destroy the modal (prevents flicker)
      updateCalendarModalContent();
  }

  global.changeJalaliMonth = changeJalaliMonth;

  function toggleJalaliDate(id,iso,multi){
      if(multi){
          let selected=Array.isArray(wizard.data[id])?[...wizard.data[id]]:[];
          selected=[...new Set(selected.filter(v=>/^\d{4}-\d{2}-\d{2}$/.test(v)))];
          if(wizard.calendarRangeStart && wizard.calendarRangeStart!==iso){ const a=isoToLocalDate(wizard.calendarRangeStart),b=isoToLocalDate(iso); const start=a<=b?a:b,end=a<=b?b:a; const range=[]; const cur=new Date(start); while(cur<=end){range.push(localDateToIso(cur));cur.setDate(cur.getDate()+1);} selected=[...new Set([...selected,...range])].sort(); wizard.calendarRangeStart=null; }
          else if(selected.includes(iso)){ selected=selected.filter(v=>v!==iso); wizard.calendarRangeStart=null; }
          else{ selected.push(iso); selected.sort(); wizard.calendarRangeStart=iso; }
          wizard.data[id]=selected; clearFieldError(id); saveWizardDraftDebounced();
          if(wizard.formSheetOpen){ renderCalendarModal(); } else { renderWizard(); }
      } else {
          wizard.data[id]=iso; clearFieldError(id); saveWizardDraftDebounced();
          wizard.calendarOpen=false; wizard.calendarId=''; wizard.calendarRangeStart=null;
          const modal = document.getElementById('keloCalendarModal'); if(modal) modal.remove();
          if(wizard._needFlow && typeof refreshNeedRequestFieldsOnly === 'function') refreshNeedRequestFieldsOnly();
          else if(wizard._needFlow && typeof renderNeedRequestPage === 'function') renderNeedRequestPage();
          else if(wizard._provideFlow && typeof refreshProvideRequestFieldsOnly === 'function') refreshProvideRequestFieldsOnly();
          else if(wizard._provideFlow && typeof renderProvideRequestPage === 'function') renderProvideRequestPage();
          else if(wizard.formSheetOpen) renderMobileFormSheet(); else renderWizard();
      }
  }

  global.toggleJalaliDate = toggleJalaliDate;

  function confirmJalaliPicker(event){ if(event){event.preventDefault();event.stopPropagation();} wizard.calendarOpen=false; wizard.calendarId=''; wizard.calendarRangeStart=null; const m=document.getElementById('keloCalendarModal'); if(m) m.remove(); if(wizard._needFlow && typeof refreshNeedRequestFieldsOnly === 'function'){ refreshNeedRequestFieldsOnly(); } else if(wizard._needFlow && typeof renderNeedRequestPage === 'function'){ renderNeedRequestPage(); } else if(wizard._provideFlow && typeof refreshProvideRequestFieldsOnly === 'function'){ refreshProvideRequestFieldsOnly(); } else if(wizard._provideFlow && typeof renderProvideRequestPage === 'function'){ renderProvideRequestPage(); } else if(wizard.formSheetOpen){ renderMobileFormSheet(); } else { renderWizard(); } }

  global.confirmJalaliPicker = confirmJalaliPicker;

  function renderJalaliCalendar(id,multi,help){
      const year=wizard.calendarYear||getJalaliParts(new Date()).year;
      const month=wizard.calendarMonth||getJalaliParts(new Date()).month;
      const days=getJalaliMonthLength(year,month) || 30;
      const first=jalaliToDate(year,month,1) || new Date();
      const offset=(first.getDay()+1)%7;
      const selected=multi?(Array.isArray(wizard.data[id])?wizard.data[id]:[]):(wizard.data[id]?[wizard.data[id]]:[]);
      const todayIso=localDateToIso(new Date());
      const minIso = wizard.calendarId === id ? wizard.calendarMinIso : computeCalendarMinIso(id);
      let dayButtons='';
      for(let i=0;i<offset;i++)dayButtons+='<button type="button" class="jalali-day empty" tabindex="-1"></button>';
      for(let d=1;d<=days;d++){
          const iso=jalaliIsoFromParts(year,month,d);
          const isSelected=selected.includes(iso);
          const isToday=iso===todayIso;
          const isDisabled = minIso && iso < minIso;
          const cls = 'jalali-day ' + (isSelected?'selected ':'') + (isToday?'today ':'') + (isDisabled?'disabled':'');
          const disabledAttr = isDisabled ? 'disabled aria-disabled="true"' : '';
          const onclick = isDisabled ? '' : 'onclick="toggleJalaliDate(\''+escapeHtml(id)+'\',\''+iso+'\','+(multi?'true':'false')+')"';
          dayButtons += '<button type="button" class="'+cls.trim()+'" '+disabledAttr+' '+onclick+' title="'+toPersianDigits(d)+'">'+toPersianDigits(d)+'</button>';
      }
      const selectedInfo=multi?(selected.length?toPersianDigits(selected.length)+' روز انتخاب شده':'تاریخی انتخاب نشده'):(wizard.data[id]?humanJalaliDate(wizard.data[id]):'تاریخی انتخاب نشده');
      const footer = multi ? '<div class="jalali-calendar-footer"><span class="selected-info">'+selectedInfo+'</span><button type="button" class="btn btn-primary" onclick="confirmJalaliPicker(event)">تایید</button></div>' : '';
      return '<div class="jalali-calendar jalali-calendar-fixed"><div class="jalali-calendar-head"><button type="button" class="jalali-month-btn" onclick="changeJalaliMonth(-1)"><i class="kelo-chevron right"></i></button><strong>'+JALALI_MONTH_NAMES[month-1]+' '+toPersianDigits(year)+'</strong><button type="button" class="jalali-month-btn" onclick="changeJalaliMonth(1)"><i class="kelo-chevron left"></i></button></div><div class="jalali-calendar-weekdays">'+JALALI_WEEK_NAMES.map(w=>'<span class="jalali-weekday">'+w.slice(0,2)+'</span>').join('')+'</div><div class="jalali-calendar-days">'+dayButtons+'</div></div>'+footer;
  }

  global.renderJalaliCalendar = renderJalaliCalendar;

  function renderJalaliDateField(id,label,req,help,multi,mobile){
      const open=wizard.calendarOpen && wizard.calendarId===id;
      const value=wizard.data[id];
      const display=value?humanJalaliDate(value):'';
      return '<div class="sidebar-field jalali-date-field '+(open?'open':'')+'">'+(mobile?'':'<label>'+label+(req?' <span style="color:red">*</span>':'')+'</label>')+'<button type="button" class="jalali-date-trigger" onclick="toggleJalaliPicker(\''+escapeHtml(id)+'\','+(multi?'true':'false')+');return false;"><span class="'+(display?'date-value':'placeholder')+'">'+escapeHtml(display || 'انتخاب کنید')+'</span><span class="date-arrow"><i class="kelo-chevron down"></i></span></button>'+(open&&!mobile?renderJalaliCalendar(id,multi,help):'')+'</div>';
  }

  global.renderJalaliDateField = renderJalaliDateField;

  function getActivityAreaRows(){ return Array.isArray(wizard.data.activityArea) ? wizard.data.activityArea.map(x=>cloneObject(x)) : []; }

  global.getActivityAreaRows = getActivityAreaRows;

  function activitySelectionCount(){ return getActivityAreaRows().reduce((sum,row)=>sum + (row.all ? 1 : (Array.isArray(row.cities)?row.cities.length:0)),0); }

  global.activitySelectionCount = activitySelectionCount;

  function activityProvinceHasSelection(province){ return !!getActivityAreaRows().find(x=>x.province===province); }

  global.activityProvinceHasSelection = activityProvinceHasSelection;

  function renderActivityAreaField(id, label, req, mobile){
      const selectedCount = activitySelectionCount();
      const triggerValue = selectedCount > 0
          ? '<span class="trigger-count">'+toPersianDigits(selectedCount)+' مورد</span>'
          : '<span class="trigger-placeholder">محدوده فعالیت</span>';
      return '<div class="sidebar-field"><label>'+escapeHtml(label)+(req?' <span style="color:red">*</span>':'')+'</label><button type="button" class="mobile-choice-trigger" onclick="openActivityAreaSheet()"><span style="display:flex;align-items:center;gap:6px;flex:1;min-width:0">'+triggerValue+'</span><span class="kelo-inline-chevron"><i class="kelo-chevron left"></i></span></button></div>';
  }

  global.renderActivityAreaField = renderActivityAreaField;

  function refreshActivityAreaUI(){
      if(isActivitySheetOpen()){ renderActivityAreaSheet(); }
      else if(wizard._provideFlow && typeof refreshProvideRequestFieldsOnly === 'function'){ refreshProvideRequestFieldsOnly(); }
      else if(wizard._provideFlow && typeof renderProvideRequestPage === 'function'){ renderProvideRequestPage(); }
      else if(wizard.formSheetOpen){ renderMobileFormSheet(); }
      else { renderWizard(); }
  }

  global.refreshActivityAreaUI = refreshActivityAreaUI;

  function renderActivityProvinceOptions(query){
      const q=String(query||'').trim().toLowerCase();
      return Object.entries(KELO_GEOGRAPHY).filter(([p])=>!q || p.toLowerCase().includes(q)).map(([province,cities])=>{ const has=activityProvinceHasSelection(province); return '<button type="button" class="activity-province-option" onclick="chooseActivityProvince(\''+escapeHtml(province)+'\')"><span>'+escapeHtml(province)+'</span><span class="province-count">'+(has?'✓ ':'')+toPersianDigits(cities.length)+' شهرستان</span></button>'; }).join('') || '<div class="activity-empty">استانی پیدا نشد.</div>';
  }

  global.renderActivityProvinceOptions = renderActivityProvinceOptions;

  function chooseActivityProvince(province){ wizard.activityProvince=province; wizard.activitySearch=''; wizard.activityOpen=true; refreshActivityAreaUI(); }

  global.chooseActivityProvince = chooseActivityProvince;

  function backToActivityProvinces(event){ if(event){ event.preventDefault(); event.stopPropagation(); } wizard.activityProvince=''; wizard.activitySearch=''; wizard.activityOpen=true; refreshActivityAreaUI(); }

  global.backToActivityProvinces = backToActivityProvinces;

  function filterActivityCities(value){ wizard.activitySearch=value||''; wizard.activityOpen=true; refreshActivityAreaUI(); setTimeout(()=>{const el=document.querySelector('#keloActivityAreaSheet .mobile-sheet-search input'); if(el){ el.focus(); el.setSelectionRange(el.value.length,el.value.length); }},0); }

  global.filterActivityCities = filterActivityCities;

  function filterActivityProvinces(value){ wizard.activitySearch=value||''; wizard.activityOpen=true; refreshActivityAreaUI(); setTimeout(()=>{const el=document.querySelector('#keloActivityAreaSheet .mobile-sheet-search input'); if(el){ el.focus(); el.setSelectionRange(el.value.length,el.value.length); }},0); }

  global.filterActivityProvinces = filterActivityProvinces;

  function toggleActivityCity(province, city, checked){
      const current=getActivityAreaRows();
      let row=current.find(x=>x.province===province);
      if(!row){ row={province,cities:[],all:false}; current.push(row); }
      const allCities=KELO_GEOGRAPHY[province]||[];
      let cities=Array.isArray(row.cities)?row.cities.slice():[];
      if(row.all){ cities=allCities.filter(c=>c!==city); row.all=false; }
      else if(checked){ if(!cities.includes(city)) cities.push(city); }
      else{ cities=cities.filter(c=>c!==city); }
      if(cities.length===allCities.length && allCities.length){ row.cities=[]; row.all=true; }
      else if(cities.length){ row.cities=cities; row.all=false; }
      else { current.splice(current.indexOf(row),1); }
      wizard.data.activityArea=current; wizard.activityProvince=province; wizard.activityOpen=true;
      saveWizardDraftDebounced(); refreshActivityAreaUI();
  }

  global.toggleActivityCity = toggleActivityCity;

  function removeActivityCity(province, city){ toggleActivityCity(province,city,false); }

  global.removeActivityCity = removeActivityCity;

  function removeActivityProvince(province){ const current=getActivityAreaRows().filter(x=>x.province!==province); wizard.data.activityArea=current; wizard.activityProvince=province; wizard.activityOpen=true; saveWizardDraftDebounced(); refreshActivityAreaUI(); }

  global.removeActivityProvince = removeActivityProvince;

  function toggleActivityDropdown(event){ event.preventDefault(); event.stopPropagation(); openActivityAreaSheet(); }

  global.toggleActivityDropdown = toggleActivityDropdown;

  function closeActivityDropdown(event){ if(event){ event.preventDefault(); event.stopPropagation(); } closeActivityAreaSheet(); }

  global.closeActivityDropdown = closeActivityDropdown;

  function confirmActivityArea(event){ if(event){ event.preventDefault(); event.stopPropagation(); } confirmActivityAreaSheet(); }

  global.confirmActivityArea = confirmActivityArea;

  function renderWizard(){
      if(wizard.formSheetOpen){ renderMobileFormSheet(); }
  }

  global.renderWizard = renderWizard;

  function syncWizardFieldValue(element){ if(!element || !element.dataset || !element.dataset.wizardField || !wizard || !wizard.data)return; if(element.type==='file')return; wizard.data[element.dataset.wizardField]=element.value; saveWizardDraftDebounced(); }

  global.syncWizardFieldValue = syncWizardFieldValue;

  function getRequestDateRange(request){
      const start=parseStoredDate(request?.data?.dateStart || request?.data?.date);
      const end=parseStoredDate(request?.data?.dateEnd || request?.data?.dateStart || request?.data?.date) || start;
      return {start,end};
  }

  global.getRequestDateRange = getRequestDateRange;

  function listingAvailableForRequest(listing, start, end){
      if(!start || !end) return true;
      const ls=parseStoredDate(listing.data?.dateStart);
      const le=parseStoredDate(listing.data?.dateEnd || listing.data?.dateStart);
      if(ls && start < ls) return false;
      if(le && end > le) return false;
      return true;
  }

  global.listingAvailableForRequest = listingAvailableForRequest;

  function getProviderIdentityFromListing(listing){
      const ownerUser=qdb().users.find(u=>u.id===listing.userId);
      return {
          providerId:listing.userId,
          provider:listing.providerName || ownerUser?.name || 'ارائه‌دهنده',
          machineId:listing.machineId || listing.id,
          listingId:listing.id,
          service:listing.service,
          unitPrice:Number(listing.data?.price)||0,
          priceUnit:listing.data?.priceUnit||'',
          rating:Number(listing.rating)||4.5,
          location:formatActivityArea(listing.data?.activityArea),
          data:listing.data || {}
      };
  }

  global.getProviderIdentityFromListing = getProviderIdentityFromListing;

  function getEligibleProvidersForRequest(request){
      if (window.KeloDomain && window.KeloDomain.eligibility && window.KeloDomain.eligibility.getEligibleProviders) {
          return window.KeloDomain.eligibility.getEligibleProviders({
              request: request,
              listings: qdb().listings || [],
              machines: qdb().machines || [],
              users: qdb().users || [],
              bookings: qdb().bookings || [],
              parseDate: parseStoredDate,
              geo: {
                  nearestCityFromCoords: typeof nearestCityFromCoords === 'function' ? nearestCityFromCoords : null,
                  provinceFromCity: typeof provinceFromCity === 'function' ? provinceFromCity : null,
                  formatActivityArea: typeof formatActivityArea === 'function' ? formatActivityArea : null
              }
          });
      }
      if(!request) return [];
      const {start,end}=getRequestDateRange(request);
      const seen=new Set();
      const result=[];
      qdb().listings
        .filter(l=>l.status==='active' && l.userId!==request.userId && l.service===request.service)
        .forEach(l=>{
            if(!listingMatchesRequest(l,request)) return;
            if(!listingAvailableForRequest(l, start, end)) return;
            if(start && hasProviderBookingConflict(l.userId, l.id, start, end)) return;
            const p=getProviderIdentityFromListing(l);
            const key=p.providerId+'|'+(p.listingId||'');
            if(seen.has(key)) return;
            seen.add(key);
            result.push(p);
        });
      qdb().machines
        .filter(m=>m.services && m.services[request.service]!==undefined)
        .forEach(m=>{
            const ownerUser=qdb().users.find(u=>u.name===m.owner);
            const providerId=ownerUser?.id || ('machine-owner:'+m.owner);
            if(providerId===request.userId) return;
            const machineKey='machine:'+m.id;
            if(seen.has(providerId+'|'+machineKey)) return;
            if(start && hasProviderBookingConflict(providerId, machineKey, start, end)) return;
            seen.add(providerId+'|'+machineKey);
            result.push({
                providerId,
                provider:m.owner || ownerUser?.name || 'ارائه‌دهنده',
                machineId:m.id,
                listingId:null,
                service:request.service,
                unitPrice:Number(m.services[request.service])||0,
                priceUnit:'تومان / هکتار',
                rating:Number(m.rating)||4.5,
                location:m.location || '—',
                data:{price:Number(m.services[request.service])||0,priceUnit:'تومان / هکتار'}
            });
        });
      return result;
  }

  global.getEligibleProvidersForRequest = getEligibleProvidersForRequest;

  function listingMatchesRequest(listing,request){
      if(!listing || !request || listing.service!==request.service) return false;
      const area=listing.data?.activityArea;
      if(Array.isArray(area) && area.length) {
          const reqLoc=request.data?.serviceLocation;
          let reqProvince='', reqCity='';
          if(reqLoc && typeof reqLoc.lat==='number' && typeof reqLoc.lng==='number'){
              reqCity=nearestCityFromCoords(reqLoc.lat,reqLoc.lng);
              reqProvince=provinceFromCity(reqCity);
          }
          if(!reqProvince && request.data?.activityArea && Array.isArray(request.data.activityArea) && request.data.activityArea.length){
              const firstRow=request.data.activityArea[0];
              reqProvince=firstRow.province||'';
              reqCity=(firstRow.all || !firstRow.cities?.length) ? '' : (firstRow.cities[0]||'');
          }
          if(!reqProvince){ reqProvince=request.data?.province||''; reqCity=request.data?.city||''; }
          if(!reqProvince) return true;
          const provinceRow=area.find(x=>x.province===reqProvince);
          if(!provinceRow) return false;
          if(provinceRow.all || !Array.isArray(provinceRow.cities) || provinceRow.cities.length===0) return true;
          if(!reqCity) return true;
          return provinceRow.cities.includes(reqCity);
      }
      return true;
  }

  global.listingMatchesRequest = listingMatchesRequest;

  function formatActivityArea(area){ if(!Array.isArray(area)||!area.length)return '—'; return area.map(x=>x.all||!x.cities?.length?x.province:x.province+': '+x.cities.join('، ')).join(' | '); }

  global.formatActivityArea = formatActivityArea;

  function serviceName(service){ return SERVICE_DEFS[service]?.name || service || '—'; }

  global.serviceName = serviceName;

  function requestDate(r){ const start = r?.data?.dateStart || r?.data?.date; const end = r?.data?.dateEnd; if(start) return formatDealRangeDate(start, end || start); return '—'; }

  global.requestDate = requestDate;

  function requestAmount(r){ if(r?.data?.area) return toPersianDigits(r.data.area)+' هکتار'; return '—'; }

  global.requestAmount = requestAmount;

async function finalizeMobileForm(){
      if (!currentUser) return;
      const savedType = wizard.type, savedService = wizard.service;
      let newId = null;
      const fields = mobileL2Fields();
      const data = cloneObject(wizard.data || {});
      fields.forEach(function(f){
          const id = f[0], type = f[2];
          if (type === 'areaSlider') {
              const range = document.querySelector('input[type=range][data-slider-id="' + id + '"]');
              if (range) data[id] = Number(range.value) || 0;
              return;
          }
          const el = document.getElementById('wf_' + id);
          if (!el) return;
          if (type === 'file') {
              data[id] = Array.from(el.files || []).map(function(x){ return x.name; });
          } else if (type === 'number') {
              data[id] = el.value === '' ? '' : Number(el.value);
          } else {
              data[id] = el.value;
          }
      });
      if (data.dateStart) data.date = data.dateStart;

      const requestApi = window.KeloService && window.KeloService.requests;
      if (!requestApi) { showToast('سرویس درخواست در دسترس نیست.','error'); return; }

      const wasEdit = !!wizard.editRequestId;
      let result;

      if (savedType === 'receive' || savedType === 'provide') {
          if (wasEdit) {
              result = await requestApi.update({
                  id: wizard.editRequestId,
                  userId: currentUser.id,
                  service: savedService,
                  data: data,
                  requesterName: currentUser.name
              });
          } else {
              result = await requestApi.create({
                  userId: currentUser.id,
                  requesterName: currentUser.name,
                  service: savedService,
                  data: data,
                  requestKind: savedType === 'provide' ? 'provide' : 'need'
              });
          }
      } else {
          result = await requestApi.createListing({
              userId: currentUser.id,
              providerName: currentUser.name,
              service: savedService,
              data: data
          });
      }

      if (!result || !result.ok) {
          showToast((result && result.message) || 'ذخیره اطلاعات انجام نشد.','error');
          return;
      }

      if (result.data && result.data.snapshot) {
          applyServerSnapshot(result.data.snapshot);
          try { window.db = db; } catch (e) {}
      }
      newId = (result.data && result.data.id) || null;

      clearWizardDraft(); closeMobileFormSheet();
      if (wasEdit) {
          mobileRequestSuccess = false;
          mobileSuccessData = null;
          try { sessionStorage.removeItem('kelo_mobile_success'); } catch (e) {}
          resetMobileWizardFlow();
          showToast((result.message) || 'درخواست به‌روزرسانی شد', 'success');
          mobileOrdersSubTab = 'requests';
          setMobileTab('proposals');
          return;
      }
      mobileRequestSuccess = true;
      mobileSuccessData = { type: savedType, service: savedService, id: newId, ts: Date.now(), updated: false };
      try { sessionStorage.setItem('kelo_mobile_success', JSON.stringify(mobileSuccessData)); } catch (e) {}
      resetMobileWizardFlow();
      setMobileTab('request');
  }

  global.finalizeMobileForm = finalizeMobileForm;

  async function finalizeWizard(){
      if (!currentUser) return;
      let savedType = wizard.type, savedService = wizard.service, newId = null;
      const data = cloneObject(wizard.data);
      if (data.dateStart) data.date = data.dateStart;
      const requestKind = savedType === 'provide' ? 'provide' : 'need';

      const requestApi = window.KeloService && window.KeloService.requests;
      if (!requestApi) { showToast('سرویس درخواست در دسترس نیست.','error'); return; }

      const result = await requestApi.create({
          userId: currentUser.id,
          requesterName: currentUser.name,
          service: savedService,
          data: data,
          requestKind: requestKind
      });
      if (!result || !result.ok) {
          showToast((result && result.message) || 'ذخیره اطلاعات انجام نشد.','error');
          return;
      }
      if (result.data && result.data.snapshot) {
          applyServerSnapshot(result.data.snapshot);
          try { window.db = db; } catch (e) {}
      }
      newId = (result.data && result.data.id) || null;
      if (!newId && result.data && result.data.request) newId = result.data.request.id;

      // Local map context (server path also sets requestId when available)
      if (newId) {
          mapContext = {
              type: savedType,
              service: savedService,
              target: savedType === 'receive' ? (wizard.data.serviceLocation || null) : null,
              activityArea: savedType === 'provide' ? (wizard.data.activityArea || []) : undefined,
              requestId: newId
          };
      }

      clearWizardDraft();
      mobileRequestSuccess = true;
      mobileSuccessData = { type: savedType, service: savedService, id: newId, ts: Date.now() };
      try { sessionStorage.setItem('kelo_mobile_success', JSON.stringify(mobileSuccessData)); } catch (e) {}
      // Ensure home-flow can see the new request on next paint
      try {
        if (typeof global.refreshServerSnapshot === 'function') {
          global.refreshServerSnapshot(false);
        }
      } catch (e2) {}
      setMobileTab('request');
      resetMobileWizardFlow();
  }

  global.finalizeWizard = finalizeWizard;

  async function deleteRequest(requestId){
      if (!currentUser) return;
      if (!confirm('این درخواست حذف شود؟')) return;

      const requestApi = window.KeloService && window.KeloService.requests;
      if (!requestApi) { showToast('سرویس درخواست در دسترس نیست.','error'); return; }

      const result = await requestApi.remove({ id: requestId, userId: currentUser.id });
      if (!result || !result.ok) {
          showToast((result && result.message) || 'حذف درخواست انجام نشد.','error');
          return;
      }
      if (result.data && result.data.snapshot) {
          applyServerSnapshot(result.data.snapshot);
          try { window.db = db; } catch (e) {}
      }
      showToast((result.message) || 'درخواست حذف شد','success');
      renderMobileProposals();
  }

  global.deleteRequest = deleteRequest;

  function editRequest(requestId){
      const req=(window.KeloService && window.KeloService.query)
        ? window.KeloService.query.getMyRequest(requestId)
        : qdb().requests.find(r=>r.id===requestId && r.userId===currentUser.id);
      if(!req || req.status==='accepted' || req.status==='agreed' || req.status==='in_progress' || req.status==='completed'){
          showToast('این درخواست دیگر قابل ویرایش نیست','error'); return;
      }
      wizard=makeEmptyWizard();
      wizard.type=(req.requestKind==='provide')?'provide':'receive';
      wizard.formSheetOpen=true;
      wizard.service=req.service;
      wizard.data=cloneObject(req.data || {});
      wizard.serviceOptions={};
      // Only service sub-options belong in serviceOptions (not area/dates/price/...)
      const l3 = (SERVICE_L3_FIELDS && SERVICE_L3_FIELDS[req.service]) || [];
      l3.forEach(function(sf){
          if (req.data && req.data[sf.id] !== undefined) wizard.serviceOptions[sf.id] = cloneObject(req.data[sf.id]);
      });
      wizard.editRequestId=req.id;
      if(!wizard.data.dateStart) wizard.data.dateStart=wizard.data.date||localDateToIso(new Date());
      document.documentElement.setAttribute('data-form-theme', wizard.type === 'provide' ? 'orange' : 'blue');
      renderMobileFormSheet();
  }

  global.editRequest = editRequest;


  // Ensure global wizard is a full structure after makeEmptyWizard is available
  if (typeof makeEmptyWizard === 'function') {
    try {
      global.wizard = makeEmptyWizard();
    } catch (e) {
      console.warn('KELO wizard reinit failed', e);
    }
  }

  const CALENDAR_ICON_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>';

  function renderMobileDateField(id, label, required){
      if(id === 'dateStart' && !wizard.data[id]){ wizard.data[id] = localDateToIso(new Date()); }
      const finalDisplay = wizard.data[id] ? humanJalaliDate(wizard.data[id]) : '';
      const placeholder = id === 'dateEnd' ? 'تاریخ پایان' : 'تاریخ شروع';
      return '<div class="sidebar-field jalali-date-field" data-date-field="'+id+'"><label>'+escapeHtml(label)+(required?' <span style="color:red">*</span>':'')+'</label><button type="button" class="jalali-date-trigger" onclick="toggleJalaliPicker(\''+escapeHtml(id)+'\',false);return false;"><span class="'+(finalDisplay?'date-value':'placeholder')+'">'+escapeHtml(finalDisplay || placeholder)+'</span><span class="date-arrow">'+CALENDAR_ICON_SVG+'</span></button></div>';
  }

  global.renderMobileDateField = renderMobileDateField;

  function renderMobilePriceInput(field){
      const [id,label,type,extra,required]=field;
      const placeholder=mobileFieldPlaceholder(id,label,type,extra);
      return '<input id="wf_'+id+'" data-wizard-field="'+escapeHtml(id)+'" class="input" type="number" min="0" '+(required?'required':'')+' value="'+escapeHtml(wizard.data[id]||'')+'" placeholder="'+escapeHtml(placeholder)+'">';
  }

  global.renderMobilePriceInput = renderMobilePriceInput;

  function renderMobilePriceUnitField(field){
      const [id] = field;
      const value = wizard.data[id] || '';
      const display = value || 'واحد قیمت';
      const isPlaceholder = !value;
      return '<button type="button" class="mobile-choice-trigger" onclick="openPriceUnitSheet()"><span class="'+(isPlaceholder?'placeholder':'')+'">'+escapeHtml(display)+'</span><span class="kelo-inline-chevron"><i class="kelo-chevron down"></i></span></button>';
  }

  global.renderMobilePriceUnitField = renderMobilePriceUnitField;

  function choosePriceUnit(value){
      wizard.data.priceUnit = value;
      clearFieldError('priceUnit');
      saveWizardDraftDebounced();
      closePriceUnitSheet();
      if(wizard._provideFlow && typeof refreshProvideRequestFieldsOnly === 'function') refreshProvideRequestFieldsOnly();
      else if(wizard._provideFlow && typeof renderProvideRequestPage === 'function') renderProvideRequestPage();
      else if(wizard.formSheetOpen) renderMobileFormSheet();
  }

  global.choosePriceUnit = choosePriceUnit;

  function updateCalendarModalContent(){
      if(!wizard.calendarOpen || !wizard.calendarId) return;
      const box = document.querySelector('#keloCalendarModal .kelo-calendar-modal-box');
      if(box){
        box.innerHTML = renderJalaliCalendar(wizard.calendarId, wizard.calendarMulti, '');
        return;
      }
      // modal missing — create once
      renderCalendarModal(true);
  }

  function renderCalendarModal(forceRecreate){
      if(!wizard.calendarOpen || !wizard.calendarId) return;
      if(!wizard.formSheetOpen) return;
      const existing = document.getElementById('keloCalendarModal');
      if(existing && !forceRecreate){
        updateCalendarModalContent();
        return;
      }
      if(existing) existing.remove();
      const id = wizard.calendarId;
      const multi = wizard.calendarMulti;
      const modal = document.createElement('div');
      modal.id = 'keloCalendarModal';
      modal.className = 'kelo-calendar-modal';
      modal.innerHTML = '<div class="kelo-calendar-modal-backdrop" onclick="closeCalendarModal()"></div><div class="kelo-calendar-modal-box">' + renderJalaliCalendar(id, multi, '') + '</div>';
      document.body.appendChild(modal);
  }

  global.renderCalendarModal = renderCalendarModal;
  global.updateCalendarModalContent = updateCalendarModalContent;

  function closeCalendarModal(){
      wizard.calendarOpen = false;
      wizard.calendarId = '';
      wizard.calendarRangeStart = null;
      const modal = document.getElementById('keloCalendarModal');
      if(modal) modal.remove();
      if(wizard._needFlow && typeof refreshNeedRequestFieldsOnly === 'function') refreshNeedRequestFieldsOnly();
      else if(wizard._needFlow && typeof renderNeedRequestPage === 'function') renderNeedRequestPage();
      else if(wizard._provideFlow && typeof refreshProvideRequestFieldsOnly === 'function') refreshProvideRequestFieldsOnly();
      else if(wizard._provideFlow && typeof renderProvideRequestPage === 'function') renderProvideRequestPage();
      else if(wizard.formSheetOpen) renderMobileFormSheet();
  }

  global.closeCalendarModal = closeCalendarModal;

  function renderMobileSuccessScreen(){
      const sb = document.getElementById('sidebar');
      const c  = document.getElementById('appContent');
      if(c){ c.className='content'; c.innerHTML=''; }
      if(!sb) return;
      sb.classList.remove('mobile-sheet-collapsed');
      const reqId = (mobileSuccessData && mobileSuccessData.id) ? mobileSuccessData.id : '';
      const isReceive = !mobileSuccessData || mobileSuccessData.type === 'receive';
      const title = isReceive ? ((mobileSuccessData && mobileSuccessData.updated) ? 'درخواست شما به‌روزرسانی شد' : 'درخواست شما ثبت شد') : 'خدمت شما ثبت شد';
      const desc = isReceive ? 'به‌زودی پیشنهادات متناسب با درخواست شما نمایش داده می‌شود.' : 'خدمت شما فعال شد و درخواست‌های مرتبط برایتان نمایش داده می‌شود.';
      const primaryBtn = isReceive
          ? '<button type="button" class="btn btn-brand" onclick="openRequestOffersMap(\'' + reqId + '\')">مشاهده پیشنهادها</button>'
          : '<button type="button" class="btn btn-brand" onclick="setMobileTab(\'proposals\')">مشاهده سفارش‌ها</button>';
      try { if (typeof renderMobileHome === 'function') renderMobileHome(); } catch (e) {}
      sb.innerHTML = '<div class="mobile-success-state"><div class="success-icon">✓</div><h2>' + title + '</h2><p>' + desc + '</p>' + primaryBtn + '<button type="button" class="btn btn-brand-outline" onclick="onMobilePlusClick()">ثبت درخواست جدید</button></div>';
  }

  global.renderMobileSuccessScreen = renderMobileSuccessScreen;

  function mobileFieldPlaceholder(id,label,type,extra){
      const map={ priceUnit:'واحد قیمت', machineType:'مثلاً کمباین کلاس لکسیون ۶۳۰', capacity:'مثلاً ۴ تن در ساعت', price:'مثلاً 3000000', note:'توضیحات خود را وارد کنید', serviceLocation:'موقعیت زمین', activityArea:'محدوده فعالیت', dateStart:'تاریخ شروع', dateEnd:'تاریخ پایان', area:'مساحت' };
      return map[id] || (type==='textarea'?'توضیحات':label);
  }

  global.mobileFieldPlaceholder = mobileFieldPlaceholder;

  function renderAreaSliderField(id, label, config){
      const value = Number(wizard.data[id]) || config.default || 1;
      const unit = config.unit || 'واحد';
      return '<div class="sidebar-field slider-field"><label>' + label + ' <span style="color:red">*</span></label><div class="slider-value-row"><span class="slider-value-display">' + toPersianDigits(value) + '</span><span class="slider-unit">' + unit + '</span></div><input type="range" data-slider-id="' + id + '" min="' + config.min + '" max="' + config.max + '" step="' + config.step + '" value="' + value + '" oninput="updateAreaSlider(\'' + id + '\', this.value)"><div class="slider-bounds"><span>' + toPersianDigits(config.min) + ' ' + unit + '</span><span>' + toPersianDigits(config.max) + ' ' + unit + '</span></div></div>';
  }

  global.renderAreaSliderField = renderAreaSliderField;

  function applySliderFill(slider){
      if(!slider) return;
      const min = Number(slider.min) || 0;
      const max = Number(slider.max) || 100;
      const val = Number(slider.value) || 0;
      const pct = max > min ? ((val - min) / (max - min)) * 100 : 0;
      const active = getComputedStyle(document.documentElement).getPropertyValue('--active-theme').trim() || '#4A9DB8';
      const neutral = '#E5E5E5';
      slider.style.background = 'linear-gradient(to left, ' + active + ' 0%, ' + active + ' ' + pct + '%, ' + neutral + ' ' + pct + '%, ' + neutral + ' 100%)';
  }

  global.applySliderFill = applySliderFill;

  function updateAreaSlider(id, value){
      const v = Number(value) || 0;
      wizard.data[id] = v;
      const disp = document.querySelector('[data-slider-display="' + id + '"]');
      if(disp) disp.textContent = toPersianDigits(v);
      const el = document.querySelector('.slider-value-display');
      if(el) el.textContent = toPersianDigits(v);
      const slider = document.querySelector('input[type=range][data-slider-id="' + id + '"]');
      if(slider) applySliderFill(slider);
      saveWizardDraftDebounced();
  }

  global.updateAreaSlider = updateAreaSlider;

  function renderMobileSelectField(id,label,options,required){
      const value=wizard.data[id]||'';
      const placeholder=mobileFieldPlaceholder(id,label,'select');
      return '<div class="sidebar-field"><label>'+escapeHtml(label)+(required?' <span style="color:red">*</span>':'')+'</label><button type="button" class="mobile-choice-trigger" onclick="openMobileSelect(\''+escapeHtml(id)+'\')"><span class="'+(value?'':'placeholder')+'">'+escapeHtml(value||placeholder)+'</span><span class="kelo-inline-chevron"><i class="kelo-chevron left"></i></span></button></div>';
  }

  global.renderMobileSelectField = renderMobileSelectField;

  function openMobileSelect(id){
      const field = mobileL2Fields().find(f=>f[0]===id); if(!field) return;
      const options = field[3]; const value = wizard.data[id]||'';
      const opt = options.map(o=>'<button type="button" class="mobile-chip '+(value===o?'active':'')+'" style="min-height:48px;padding:12px 20px;font-size:15px" onclick="chooseMobileSelect(\''+escapeHtml(id)+'\',\''+escapeHtml(o)+'\')">'+escapeHtml(o)+'</button>').join('');
      const html = '<button type="button" class="mobile-sheet-handle"></button><div class="mobile-sheet-header"><button type="button" class="mobile-sheet-back-btn" onclick="closeMobileSelectSheet()" aria-label="بازگشت">'+KELO_BACK_CHEVRON_SVG+'</button><h2>'+escapeHtml(field[1])+'</h2><span></span></div><div class="mobile-sheet-body"><div class="mobile-chip-group">'+opt+'</div></div>';
      let backdrop = document.getElementById('keloSelectSheet');
      if(!backdrop){ backdrop = document.createElement('div'); backdrop.id='keloSelectSheet'; backdrop.className='mobile-sheet-backdrop level3'; document.body.appendChild(backdrop); }
      backdrop.innerHTML = '<div class="mobile-sheet picker">'+html+'</div>';
  }

  global.openMobileSelect = openMobileSelect;

  function chooseMobileSelect(id,value){ wizard.data[id]=value; clearFieldError(id); saveWizardDraftDebounced(); closeMobileSelectSheet(); if(wizard.formSheetOpen) renderMobileFormSheet(); }

  global.chooseMobileSelect = chooseMobileSelect;

  function renderMobileField(field){
      const [id,label,type,extra,required]=field;
      const placeholder=mobileFieldPlaceholder(id,label,type,extra);
      if(type==='select') return renderMobileSelectField(id,label,extra,required);
      if(type==='areaSlider') return renderAreaSliderField(id,label,extra);
      if(type==='mapLocation') return renderMapLocationField(id,label,required?'required':'',extra,true);
      if(type==='activityArea') return renderActivityAreaField(id,label,required?'required':'',true);
      if(type==='jalaliDate') return renderMobileDateField(id,label,!!required);
      if(type==='textarea') return '<div class="sidebar-field"><label>'+escapeHtml(label)+'</label><textarea id="wf_'+id+'" data-wizard-field="'+escapeHtml(id)+'" class="textarea" '+(required?'required':'')+' placeholder="'+escapeHtml(placeholder)+'">'+escapeHtml(wizard.data[id]||'')+'</textarea></div>';
      if(type==='file') return renderMobilePhotoUpload(id,label);
      return '<div class="sidebar-field"><label>'+escapeHtml(label)+(required?' <span style="color:red">*</span>':'')+'</label><input id="wf_'+id+'" data-wizard-field="'+escapeHtml(id)+'" class="input" type="'+type+'" '+(type==='number'?'min="0"':'')+' '+(required?'required':'')+' value="'+escapeHtml(wizard.data[id]||'')+'" placeholder="'+escapeHtml(placeholder)+'"></div>';
  }

  global.renderMobileField = renderMobileField;

  function renderMobilePhotoUpload(id,label){
      const photos = Array.isArray(wizard.data[id]) ? wizard.data[id] : [];
      const boxes = photos.map(function(p, idx){ return '<div class="mobile-photo-box" style="background:#fff;border-style:solid"><img class="mobile-photo-preview" src="' + escapeHtml(p.preview||'') + '" alt=""><button type="button" class="mobile-photo-remove" onclick="removeMobilePhoto(\''+id+'\','+idx+')">×</button></div>'; }).join('');
      const addBox = '<button type="button" class="mobile-photo-box" onclick="openMobilePhotoPicker(\''+id+'\')"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg><span class="label">افزودن</span></button>';
      return '<div class="sidebar-field"><label>' + escapeHtml(label) + '</label><div class="mobile-photo-upload-grid">' + boxes + addBox + '</div><div class="mobile-photo-hint">تصویر تجهیزات یا شرایط را اضافه کنید. حداکثر ۸ عکس.</div><input type="file" accept="image/*" multiple class="mobile-photo-input" id="photoInput_'+id+'" onchange="handleMobilePhotoSelect(\''+id+'\', this)"></div>';
  }

  global.renderMobilePhotoUpload = renderMobilePhotoUpload;

  function openMobilePhotoPicker(id){ const input = document.getElementById('photoInput_'+id); if(input) input.click(); }

  global.openMobilePhotoPicker = openMobilePhotoPicker;

  function handleMobilePhotoSelect(id, input){
      const files = Array.from(input.files || []); if(!files.length) return;
      if(!Array.isArray(wizard.data[id])) wizard.data[id] = [];
      const maxAdd = 8 - wizard.data[id].length;
      const toAdd = files.slice(0, maxAdd);
      if(!toAdd.length){ showToast('حداکثر ۸ عکس','error'); return; }
      let pending = toAdd.length;
      toAdd.forEach(function(file){
          compressImageForStorage(file, function(dataUrl){
              wizard.data[id].push({ name: file.name, preview: dataUrl });
              pending--;
              if(pending === 0){ saveWizardDraftDebounced(); renderMobileFormSheet(); }
          }, function(){
              pending--;
              if(pending === 0){ saveWizardDraftDebounced(); renderMobileFormSheet(); }
          });
      });
  }

  global.handleMobilePhotoSelect = handleMobilePhotoSelect;

  function compressImageForStorage(file, onSuccess, onError){
      const reader = new FileReader();
      reader.onload = function(e){
          const img = new Image();
          img.onload = function(){
              const maxSide = 1280;
              const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
              const w = Math.max(1, Math.round(img.width * scale));
              const h = Math.max(1, Math.round(img.height * scale));
              const canvas = document.createElement('canvas');
              canvas.width = w; canvas.height = h;
              const ctx = canvas.getContext('2d');
              if(!ctx){ onSuccess(e.target.result); return; }
              ctx.drawImage(img, 0, 0, w, h);
              let out = canvas.toDataURL('image/jpeg', 0.78);
              if(out.length > 900000) out = canvas.toDataURL('image/jpeg', 0.65);
              onSuccess(out);
          };
          img.onerror = function(){ if(onError) onError(); };
          img.src = e.target.result;
      };
      reader.onerror = function(){ if(onError) onError(); };
      reader.readAsDataURL(file);
  }

  global.compressImageForStorage = compressImageForStorage;

  function removeMobilePhoto(id, index){ if(!Array.isArray(wizard.data[id])) return; wizard.data[id].splice(index, 1); saveWizardDraftDebounced(); renderMobileFormSheet(); }

  global.removeMobilePhoto = removeMobilePhoto;

  function validateMobileField(field){
      const [id,label,type,,required]=field;
      clearFieldError(id);
      const v=wizard.data[id];
      const empty=v===undefined || v===null || v==='' || (Array.isArray(v)&&v.length===0);
      if(required && empty){ showFieldError(id, 'لطفاً '+label+' را مشخص کنید.'); return false; }
      if(type==='mapLocation' && required && (!v || typeof v.lat!=='number')){ showFieldError(id, 'لطفاً محل را روی نقشه انتخاب کنید.'); return false; }
      if(type==='activityArea' && required && (!Array.isArray(v)||!v.length)){ showFieldError(id, 'لطفاً محدوده فعالیت را مشخص کنید.'); return false; }
      if(type==='areaSlider' && required && (!Number(v) || Number(v)<=0)){ showFieldError(id, 'لطفاً '+label+' را مشخص کنید.'); return false; }
      return true;
  }

  global.validateMobileField = validateMobileField;

  function computeCalendarMinIso(id){
      const today = localDateToIso(new Date());
      if(id === 'dateEnd'){ const startVal = wizard.data['dateStart']; if(startVal && /^\d{4}-\d{2}-\d{2}$/.test(startVal)) return startVal; }
      return today;
  }

  global.computeCalendarMinIso = computeCalendarMinIso;


  /**
   * Phase 18 — module facade (idempotent).
   * Handlers remain on window for HTML onclick compatibility.
   */
  var _inited = false;

  /* ========== Need-request page (land pill + service + dates) ========== */
  var _needLandsCache = [];
  var _needSelectedLandId = null;
  var _needLandSearch = '';

  var NEED_LAND_PREF_KEY = 'kelo_need_selected_land_id';

  function readPreferredLandId() {
    try {
      var uid = currentUser && currentUser.id;
      if (!uid) return null;
      var raw = localStorage.getItem(NEED_LAND_PREF_KEY);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      if (obj && String(obj.userId) === String(uid) && obj.landId) return obj.landId;
    } catch (e) {}
    return null;
  }

  function writePreferredLandId(landId) {
    try {
      var uid = currentUser && currentUser.id;
      if (!uid) return;
      if (!landId) {
        localStorage.removeItem(NEED_LAND_PREF_KEY);
        return;
      }
      localStorage.setItem(NEED_LAND_PREF_KEY, JSON.stringify({ userId: uid, landId: landId }));
    } catch (e) {}
  }

  var _origAssetsAfterMapPick = null;

  function needPageEl() {
    return document.getElementById('keloNeedRequestPage');
  }

  function closeNeedRequestPage() {
    var el = needPageEl();
    if (el) el.remove();
    var landSheet = document.getElementById('keloLandPickerSheet');
    if (landSheet) landSheet.remove();
    var landNew = document.getElementById('keloNeedNewLandPage');
    if (landNew) landNew.remove();
    document.body.style.overflow = '';
    document.documentElement.removeAttribute('data-form-theme');
    if (wizard) {
      wizard.formSheetOpen = false;
      wizard._needFlow = false;
      wizard._needNewLandMode = false;
    }
  }

  function openNeedRequestPage() {
    if (!currentUser) return;
    wizard = makeEmptyWizard();
    wizard.type = 'receive';
    wizard._needFlow = true;
    wizard.formSheetOpen = true; // reuse calendar modal paths
    document.documentElement.setAttribute('data-form-theme', 'blue');
    if (!wizard.data.dateStart) wizard.data.dateStart = localDateToIso(new Date());
    _needSelectedLandId = (typeof readPreferredLandId === 'function') ? readPreferredLandId() : null;
    _needLandSearch = '';
    renderNeedRequestPage();
    loadNeedLands();
  }

  global.openNeedRequestPage = openNeedRequestPage;
  global.closeNeedRequestPage = closeNeedRequestPage;

  function loadNeedLands() {
    var done = function (lands) {
      _needLandsCache = Array.isArray(lands) ? lands.slice() : [];
      if (!_needSelectedLandId && typeof readPreferredLandId === 'function') {
        _needSelectedLandId = readPreferredLandId();
      }
      if (_needSelectedLandId) {
        var land = selectedNeedLand();
        if (land) {
          applyLandToWizard(land);
          if (typeof writePreferredLandId === 'function') writePreferredLandId(land.id);
        } else {
          // preferred land deleted — clear
          _needSelectedLandId = null;
          if (typeof writePreferredLandId === 'function') writePreferredLandId(null);
        }
      } else if (_needLandsCache.length === 1) {
        _needSelectedLandId = _needLandsCache[0].id;
        applyLandToWizard(_needLandsCache[0]);
        if (typeof writePreferredLandId === 'function') writePreferredLandId(_needSelectedLandId);
      }
      paintNeedLandPill();
      if (document.getElementById('needLandPickerBody')) paintNeedLandPickerBody();
    };
    var parseLands = function (res) {
      if (!res) return [];
      if (res.ok && res.data && Array.isArray(res.data.lands)) return res.data.lands;
      if (res.ok && Array.isArray(res.data)) return res.data;
      if (Array.isArray(res.lands)) return res.lands;
      if (Array.isArray(res)) return res;
      return [];
    };
    var fromLocalDb = function () {
      try {
        var uid = currentUser && currentUser.id;
        var db = (window.KeloService && window.KeloService.query && typeof window.KeloService.query.mirror === 'function')
          ? window.KeloService.query.mirror()
          : (window.db || null);
        if (!db || !Array.isArray(db.lands)) return [];
        return db.lands.filter(function (x) {
          return x && !x.deleted && String(x.userId) === String(uid);
        });
      } catch (e) { return []; }
    };
    try {
      var svc = window.KeloService && window.KeloService.assets;
      // IMPORTANT: listLands expects userId string or nothing — NOT { userId: ... }
      if (svc && typeof svc.listLands === 'function') {
        Promise.resolve(svc.listLands()).then(function (res) {
          var lands = parseLands(res);
          if (!lands.length) lands = fromLocalDb();
          done(lands);
        }).catch(function () { done(fromLocalDb()); });
        return;
      }
      if (window.KeloLocalAdapter && typeof window.KeloLocalAdapter.listLands === 'function') {
        var uid = currentUser && currentUser.id;
        Promise.resolve(window.KeloLocalAdapter.listLands({ userId: uid })).then(function (res) {
          var lands = parseLands(res);
          if (!lands.length) lands = fromLocalDb();
          done(lands);
        }).catch(function () { done(fromLocalDb()); });
        return;
      }
    } catch (e) {}
    done(fromLocalDb());
  }



  function selectedNeedLand() {
    if (!_needSelectedLandId) return null;
    return _needLandsCache.find(function (l) { return String(l.id) === String(_needSelectedLandId); }) || null;
  }

  function landAddressText(land) {
    if (!land) return '';
    var loc = land.location;
    if (loc && typeof loc === 'object') {
      if (loc.label) return String(loc.label);
      if (loc.city) return String(loc.city) + (loc.province ? '، ' + loc.province : '');
    }
    if (land.city) return String(land.city);
    if (typeof loc === 'string') return loc;
    return '';
  }

  function applyLandToWizard(land) {
    if (!land || !wizard) return false;
    if (!wizard.data) wizard.data = {};
    wizard.data.landId = land.id;
    wizard.data.landName = land.name || '';
    if (land.area != null && land.area !== '') {
      var ar = Number(land.area);
      if (!isNaN(ar) && ar > 0) wizard.data.area = ar;
    }
    var lat = null, lng = null, label = '', city = '';
    var loc = land.location;
    if (loc && typeof loc === 'object') {
      if (loc.lat != null && loc.lat !== '') lat = Number(loc.lat);
      if (loc.lng != null && loc.lng !== '') lng = Number(loc.lng);
      label = loc.label || loc.city || '';
      city = loc.city || land.city || '';
    }
    if ((lat == null || isNaN(lat)) && land.lat != null && land.lat !== '') lat = Number(land.lat);
    if ((lng == null || isNaN(lng)) && land.lng != null && land.lng !== '') lng = Number(land.lng);
    if (!label) label = (typeof landAddressText === 'function' ? landAddressText(land) : '') || land.name || '';
    if (!city) city = land.city || '';
    if (typeof lat === 'number' && !isNaN(lat) && typeof lng === 'number' && !isNaN(lng)) {
      wizard.data.serviceLocation = {
        lat: lat,
        lng: lng,
        label: label,
        city: city,
        source: 'land',
        landId: land.id
      };
      return true;
    }
    return false;
  }



  function paintNeedLandPill() {
    var pill = document.getElementById('needLandPillLabel');
    if (!pill) return;
    var land = selectedNeedLand();
    if (land) {
      pill.textContent = land.name || 'زمین';
      pill.classList.remove('is-placeholder');
    } else {
      pill.textContent = 'انتخاب زمین';
      pill.classList.add('is-placeholder');
    }
  }


  function renderNeedRequestPage() {
    var existing = needPageEl();
    var prevScroll = 0;
    if (existing) {
      var b = existing.querySelector('.need-request-body, .mobile-sheet-body');
      if (b) prevScroll = b.scrollTop;
      existing.remove();
    }
    var page = document.createElement('div');
    page.id = 'keloNeedRequestPage';
    // Same shell as provide form sheet → identical open animation & desktop size
    page.className = 'mobile-sheet-backdrop need-request-page';
    page.style.zIndex = '5200';
    var serviceLabel = wizard.service && SERVICE_DEFS[wizard.service]
      ? SERVICE_DEFS[wizard.service].name
      : 'انتخاب کنید';
    var datesHtml = '<div class="mobile-two-col need-dates-row">'
      + '<div class="wizard-field-wrap" data-field-wrapper="dateStart">' + renderMobileDateField('dateStart', 'تاریخ شروع', true) + '</div>'
      + '<div class="wizard-field-wrap" data-field-wrapper="dateEnd">' + renderMobileDateField('dateEnd', 'تاریخ پایان', false) + '</div>'
      + '</div>';
    page.innerHTML =
      '<div class="mobile-sheet need-request-inner" role="dialog" aria-modal="true">'
      + '<button type="button" class="mobile-sheet-handle" aria-hidden="true"></button>'
      + '<div class="mobile-sheet-header need-request-header">'
      +   '<button type="button" class="mobile-sheet-back-btn need-back-btn" onclick="closeNeedRequestPage()" aria-label="بازگشت">' + KELO_BACK_CHEVRON_SVG + '</button>'
      +   '<h2 class="need-request-title">نیاز به خدمت</h2>'
      +   '<span></span>'
      + '</div>'
      + '<div class="mobile-sheet-body need-request-body">'
      +   '<div class="need-land-pill-wrap">'
      +     '<button type="button" class="need-land-pill" id="needLandPill" onclick="openNeedLandPicker()">'
      +       '<span class="need-land-pill-label is-placeholder" id="needLandPillLabel">انتخاب زمین</span>'
      +       '<i class="kelo-chevron down"></i>'
      +     '</button>'
      +   '</div>'
      +   '<div class="wizard-field-wrap" data-field-wrapper="service">'
      +     '<div class="sidebar-field"><label>نوع خدمت <span style="color:red">*</span></label>'
      +     '<button type="button" class="mobile-choice-trigger" onclick="openMobileServicePicker()"><span class="' + (wizard.service ? '' : 'placeholder') + '" id="needServiceLabel">' + escapeHtml(serviceLabel) + '</span><span class="kelo-inline-chevron"><i class="kelo-chevron down"></i></span></button></div></div>'
      +   datesHtml
      + '</div>'
      + '<div class="mobile-sheet-footer need-request-footer">'
      +   '<button type="button" class="btn btn-primary btn-block" onclick="submitNeedRequestPage()">ثبت خدمت</button>'
      + '</div>'
      + '</div>';
    document.body.appendChild(page);
    document.body.style.overflow = 'hidden';
    paintNeedLandPill();
    if (prevScroll) {
      var nb = page.querySelector('.need-request-body');
      if (nb) nb.scrollTop = prevScroll;
    }
    if (wizard.calendarOpen && wizard.calendarId) {
      try { renderCalendarModal(); } catch (e) {}
    }
  }


  function refreshNeedRequestFieldsOnly() {
    if (!wizard || !wizard._needFlow) return;
    var page = needPageEl();
    if (!page) { renderNeedRequestPage(); return; }
    // service label
    var svcEl = document.getElementById('needServiceLabel');
    if (svcEl) {
      var serviceLabel = wizard.service && SERVICE_DEFS[wizard.service]
        ? SERVICE_DEFS[wizard.service].name : 'انتخاب کنید';
      svcEl.textContent = serviceLabel;
      svcEl.classList.toggle('placeholder', !wizard.service);
    }
    // date triggers only
    ['dateStart', 'dateEnd'].forEach(function (id) {
      var wrap = page.querySelector('[data-field-wrapper="' + id + '"]');
      if (!wrap) return;
      var html = renderMobileDateField(id, id === 'dateStart' ? 'تاریخ شروع' : 'تاریخ پایان', id === 'dateStart');
      wrap.innerHTML = html;
    });
    paintNeedLandPill();
  }

  global.renderNeedRequestPage = renderNeedRequestPage;
  global.refreshNeedRequestFieldsOnly = refreshNeedRequestFieldsOnly;

  // confirmMobileServicePicker handles need-flow natively

  function openNeedLandPicker() {
    loadNeedLands();
    var existing = document.getElementById('keloLandPickerSheet');
    if (existing) existing.remove();
    var bd = document.createElement('div');
    bd.id = 'keloLandPickerSheet';
    bd.className = 'mobile-sheet-backdrop land-picker-backdrop';
    bd.style.zIndex = '5600';
    bd.innerHTML =
      '<div class="mobile-sheet land-picker-sheet" role="dialog" aria-modal="true">'
      + '<button type="button" class="mobile-sheet-handle" aria-hidden="true"></button>'
      + '<div class="land-picker-head-row">'
      +   '<div class="land-picker-title-group">'
      +     '<button type="button" class="land-picker-close" onclick="closeNeedLandPicker()" aria-label="بستن">×</button>'
      +     '<strong class="land-picker-title">انتخاب زمین</strong>'
      +   '</div>'
      +   '<button type="button" class="land-picker-new" onclick="startNeedNewLand()">+ زمین جدید</button>'
      + '</div>'
      + '<p class="land-picker-hint">برای مشاهده مناسب‌ترین پیشنهادها، ابتدا زمین خود را مشخص کنید.</p>'
      + '<div class="mobile-sheet-body land-picker-body" id="needLandPickerBody"></div>'
      + '<div class="mobile-sheet-footer"><button type="button" class="btn btn-primary btn-block" onclick="confirmNeedLandPicker()">تأیید</button></div>'
      + '</div>';
    document.body.appendChild(bd);
    bd.addEventListener('click', function (e) {
      if (e.target === bd) closeNeedLandPicker();
    });
    paintNeedLandPickerBody();
  }

  global.openNeedLandPicker = openNeedLandPicker;

  function closeNeedLandPicker() {
    var el = document.getElementById('keloLandPickerSheet');
    if (el) el.remove();
  }
  global.closeNeedLandPicker = closeNeedLandPicker;

  function filterNeedLandSearch(q) {
    _needLandSearch = (q || '').trim();
    paintNeedLandPickerBody();
  }
  global.filterNeedLandSearch = filterNeedLandSearch;

  function paintNeedLandPickerBody() {
    var body = document.getElementById('needLandPickerBody');
    if (!body) return;
    var list = _needLandsCache || [];
    if (!list.length) {
      body.innerHTML =
        '<div class="land-picker-empty">'
        + '<div class="land-picker-empty-icon" aria-hidden="true">'
        + '<svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="#c5c8c1" stroke-width="1.4"><path d="M3 21h18"/><path d="M5 21V10l7-5 7 5v11"/><path d="M9 21v-6h6v6"/></svg>'
        + '</div>'
        + '<p class="land-picker-empty-title">زمین ذخیره‌شده‌ای ندارید.</p>'
        + '<p class="land-picker-empty-sub">برای ثبت خدمت، ابتدا زمین خود را اضافه کنید.</p>'
        + '</div>';
      return;
    }
    body.innerHTML = '<div class="land-picker-options">' + list.map(function (l) {
      var active = String(l.id) === String(_needSelectedLandId);
      var addr = (typeof landAddressText === 'function') ? landAddressText(l) : (l.city || '');
      var areaTxt = (l.area != null && l.area !== '') ? (String(l.area) + ' هکتار') : '';
      var meta = [addr, areaTxt].filter(Boolean).join('  |  ');
      var idEsc = escapeHtml(String(l.id));
      return '<div class="land-picker-option' + (active ? ' is-selected' : '') + '" data-land-id="' + idEsc + '">'
        + '<label class="land-picker-option-main">'
        +   '<input type="radio" name="keloNeedLand" value="' + idEsc + '"'
        +   (active ? ' checked' : '') + ' onchange="selectNeedLand(\'' + idEsc + '\', true)">'
        +   '<span class="land-picker-option-text">'
        +     '<strong class="land-picker-option-name">' + escapeHtml(l.name || 'زمین') + '</strong>'
        +     (meta ? '<span class="land-picker-option-addr">' + escapeHtml(meta) + '</span>' : '')
        +   '</span>'
        + '</label>'
        + '<div class="land-picker-option-actions">'
        +   '<button type="button" class="land-card-btn land-card-edit" onclick="event.preventDefault();event.stopPropagation();editNeedLand(\'' + idEsc + '\')">ویرایش</button>'
        +   '<button type="button" class="land-card-btn land-card-del" onclick="event.preventDefault();event.stopPropagation();deleteNeedLand(\'' + idEsc + '\')">حذف</button>'
        + '</div>'
        + '</div>';
    }).join('') + '</div>';
  }

  function upsertNeedLandCache(land) {
    if (!land || !land.id) return;
    var i = -1;
    for (var k = 0; k < _needLandsCache.length; k++) {
      if (String(_needLandsCache[k].id) === String(land.id)) { i = k; break; }
    }
    if (i >= 0) _needLandsCache[i] = Object.assign({}, _needLandsCache[i], land);
    else _needLandsCache.push(land);
  }

  function selectNeedLand(id, keepSheetOpen) {
    _needSelectedLandId = id;
    if (typeof writePreferredLandId === 'function') writePreferredLandId(id);
    var land = selectedNeedLand();
    if (land) {
      applyLandToWizard(land);
    }
    paintNeedLandPill();
    if (document.getElementById('needLandPickerBody')) paintNeedLandPickerBody();
    if (!keepSheetOpen) closeNeedLandPicker();
  }
  global.selectNeedLand = selectNeedLand;


  function confirmNeedLandPicker() {
    if (!_needSelectedLandId) {
      if (typeof showToast === 'function') showToast('لطفاً یک زمین را انتخاب کنید', 'error');
      return;
    }
    var land = selectedNeedLand();
    if (!land) {
      if (typeof showToast === 'function') showToast('زمین انتخاب‌شده پیدا نشد', 'error');
      return;
    }
    var ok = applyLandToWizard(land);
    paintNeedLandPill();
    if (!ok) {
      if (typeof showToast === 'function') showToast('موقعیت این زمین ناقص است؛ زمین دیگری انتخاب کنید یا زمین جدید ثبت کنید', 'error');
      return;
    }
    closeNeedLandPicker();
  }
  global.confirmNeedLandPicker = confirmNeedLandPicker;

  function deleteNeedLand(id) {
    if (!id) return;
    if (!confirm('این زمین حذف شود؟')) return;
    var uid = currentUser && currentUser.id;
    var done = function (ok, msg) {
      if (!ok) {
        if (typeof showToast === 'function') showToast(msg || 'حذف انجام نشد', 'error');
        return;
      }
      _needLandsCache = (_needLandsCache || []).filter(function (x) { return String(x.id) !== String(id); });
      if (String(_needSelectedLandId) === String(id)) {
        _needSelectedLandId = null;
        if (typeof writePreferredLandId === 'function') writePreferredLandId(null);
        if (wizard && wizard.data) {
          delete wizard.data.landId;
          delete wizard.data.landName;
          delete wizard.data.serviceLocation;
        }
      }
      paintNeedLandPill();
      paintNeedLandPickerBody();
      if (typeof showToast === 'function') showToast('زمین حذف شد', 'success');
    };
    try {
      var svc = window.KeloService && window.KeloService.assets;
      if (svc && typeof svc.deleteLand === 'function') {
        Promise.resolve(svc.deleteLand(id, uid)).then(function (res) {
          done(res && res.ok, res && res.message);
          loadNeedLands();
        }).catch(function () { done(false); });
        return;
      }
      if (window.KeloLocalAdapter && typeof window.KeloLocalAdapter.deleteLand === 'function') {
        Promise.resolve(window.KeloLocalAdapter.deleteLand({ id: id, userId: uid })).then(function (res) {
          done(res && res.ok, res && res.message);
          loadNeedLands();
        });
        return;
      }
    } catch (e) {}
    done(false, 'سرویس حذف در دسترس نیست');
  }
  global.deleteNeedLand = deleteNeedLand;

  function editNeedLand(id) {
    var land = (_needLandsCache || []).find(function (x) { return String(x.id) === String(id); });
    if (!land) {
      if (typeof showToast === 'function') showToast('زمین پیدا نشد', 'error');
      return;
    }
    closeNeedLandPicker();
    wizard._needEditingLandId = land.id;
    var loc = land.location || null;
    if (loc && (loc.lat != null)) {
      loc = Object.assign({}, loc, { lat: Number(loc.lat), lng: Number(loc.lng) });
    }
    wizard._needPendingLandLoc = loc;
    openNeedNewLandDetailsPage(loc, land);
  }
  global.editNeedLand = editNeedLand;




  function startNeedNewLand() {
    closeNeedLandPicker();
    wizard._needEditingLandId = null;
    wizard._needNewLandMode = true;
    wizard._assetMapMode = true;
    wizard.mapPickMode = true;
    wizard._pendingMapPoint = null;
    // wrap afterMapPick
    if (!_origAssetsAfterMapPick && typeof global.keloAssetsAfterMapPick === 'function') {
      _origAssetsAfterMapPick = global.keloAssetsAfterMapPick;
    }
    global.keloAssetsAfterMapPick = function (loc) {
      if (wizard && wizard._needNewLandMode) {
        openNeedNewLandDetailsPage(loc);
        return;
      }
      if (_origAssetsAfterMapPick) _origAssetsAfterMapPick(loc);
    };
    if (typeof global.openMobileMapPickerOverlay === 'function') {
      global.openMobileMapPickerOverlay();
    } else if (typeof showToast === 'function') {
      showToast('نقشه در دسترس نیست', 'error');
    }
  }
  global.startNeedNewLand = startNeedNewLand;

  function openNeedNewLandDetailsPage(loc, existingLand) {
    wizard._needPendingLandLoc = loc || wizard._needPendingLandLoc || null;
    if (existingLand && existingLand.id) {
      wizard._needEditingLandId = existingLand.id;
    }
    var existing = document.getElementById('keloNeedNewLandPage');
    var softLand = !!existing;
    if (existing) existing.remove();
    var label = (loc && (loc.label || loc.city)) ? (loc.label || loc.city) : 'موقعیت انتخاب‌شده';
    var lat = loc && Number(loc.lat), lng = loc && Number(loc.lng);
    var nameVal = (existingLand && existingLand.name) ? existingLand.name : '';
    var areaVal = (existingLand && existingLand.area != null && existingLand.area !== '') ? String(existingLand.area) : '';
    var cropVal = (existingLand && existingLand.crop) ? existingLand.crop : (wizard._needDraftCrop || '');
    wizard._needDraftCrop = cropVal;
    var title = wizard._needEditingLandId ? 'ویرایش زمین' : 'زمین جدید';
    var page = document.createElement('div');
    page.id = 'keloNeedNewLandPage';
    page.className = 'need-new-land-page';
    page.innerHTML =
      '<div class="need-new-land-inner' + (softLand ? ' no-anim' : '') + '">'
      + '<div class="need-new-land-header">'
      +   '<button type="button" class="land-picker-close" onclick="closeNeedNewLandPage()" aria-label="بستن">×</button>'
      +   '<strong>' + escapeHtml(title) + '</strong>'
      +   '<span></span>'
      + '</div>'
      + '<div class="need-new-land-map-wrap">'
      +   '<div id="needNewLandMapPreview" class="need-new-land-map"></div>'
      +   '<button type="button" class="need-edit-loc-btn" onclick="reopenNeedLandMap()">ویرایش موقعیت</button>'
      + '</div>'
      + '<div class="need-new-land-body mobile-sheet-body">'
      +   '<div class="wizard-field-wrap"><div class="sidebar-field"><label>نشانی</label>'
      +   '<div class="need-address-chip"><span id="needNewLandAddress">' + escapeHtml(label) + '</span></div>'
      +   '<p class="need-address-hint">برای اطمینان موقعیت را چک کنید و در صورت مغایرت آن را اصلاح کنید.</p></div></div>'
      +   '<div class="wizard-field-wrap"><div class="sidebar-field"><label>نام زمین یا مزرعه <span style="color:red">*</span></label>'
      +   '<input type="text" id="needNewLandName" class="input" placeholder="مثلاً مزرعه ساری" value="' + escapeHtml(nameVal) + '"></div></div>'
      +   '<div class="wizard-field-wrap"><div class="sidebar-field"><label>مساحت (هکتار) <span style="color:red">*</span></label>'
      +   '<input type="number" id="needNewLandArea" class="input" min="0.1" step="0.1" placeholder="مثلاً 2" value="' + escapeHtml(areaVal) + '"></div></div>'
      +   '<div class="wizard-field-wrap" data-field-wrapper="crop"><div class="sidebar-field"><label>نوع محصول <span style="color:red">*</span></label>'
      +   '<button type="button" class="mobile-choice-trigger" onclick="openCropPicker()"><span class="' + (cropVal ? '' : 'placeholder') + '" id="needLandCropLabel">' + escapeHtml(cropVal || 'انتخاب کنید') + '</span><span class="kelo-inline-chevron"><i class="kelo-chevron down"></i></span></button>'
      +   '<input type="hidden" id="needNewLandCrop" value="' + escapeHtml(cropVal) + '"></div></div>'
      +   '<div class="wizard-field-wrap" style="margin-top:8px"><button type="button" class="btn btn-primary btn-block need-save-land-btn" onclick="saveNeedNewLand()" style="background:var(--active-theme,#4A9DB8);border:0">' + (wizard._needEditingLandId ? 'ذخیره تغییرات' : 'ذخیره زمین') + '</button></div>'
      + '</div></div>';
    document.body.appendChild(page);
    setTimeout(function () {
      var el = document.getElementById('needNewLandMapPreview');
      if (!el || typeof L === 'undefined') return;
      try {
        if (window._needNewLandMap) { try { window._needNewLandMap.remove(); } catch (e) {} }
        var center = (typeof lat === 'number' && !isNaN(lat) && typeof lng === 'number' && !isNaN(lng)) ? [lat, lng] : [36.56, 53.05];
        var map = (typeof createKeloMap === 'function')
          ? createKeloMap(el, { zoomControl: false, attributionControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false, boxZoom: false, keyboard: false }, center, 14)
          : L.map(el, { zoomControl: false, attributionControl: false, dragging: false, scrollWheelZoom: false }).setView(center, 14);
        if (map && !(typeof createKeloMap === 'function')) {
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
        }
        if (typeof lat === 'number' && !isNaN(lat)) L.marker([lat, lng]).addTo(map);
        window._needNewLandMap = map;
        try {
          if (map.attributionControl) map.removeControl(map.attributionControl);
          var att = el.querySelector('.leaflet-control-attribution');
          if (att) att.style.display = 'none';
        } catch (e) {}
        setTimeout(function () { try { map.invalidateSize(); } catch (e) {} }, 80);
      } catch (e) {}
    }, 50);
  }
  global.openNeedNewLandDetailsPage = openNeedNewLandDetailsPage;

  function reopenNeedLandMap() {
    // Keep editing id + name/area fields in wizard stash
    var nameEl = document.getElementById('needNewLandName');
    var areaEl = document.getElementById('needNewLandArea');
    wizard._needDraftLandName = nameEl ? nameEl.value : '';
    wizard._needDraftLandArea = areaEl ? areaEl.value : '';
    closeNeedNewLandPage(true); // soft close, keep edit state
    wizard._needNewLandMode = true;
    wizard._assetMapMode = true;
    wizard.mapPickMode = true;
    if (!_origAssetsAfterMapPick && typeof global.keloAssetsAfterMapPick === 'function') {
      _origAssetsAfterMapPick = global.keloAssetsAfterMapPick;
    }
    global.keloAssetsAfterMapPick = function (loc) {
      if (wizard && wizard._needNewLandMode) {
        var existing = null;
        if (wizard._needEditingLandId) {
          existing = (_needLandsCache || []).find(function (x) {
            return String(x.id) === String(wizard._needEditingLandId);
          }) || { id: wizard._needEditingLandId, name: wizard._needDraftLandName, area: wizard._needDraftLandArea };
          if (wizard._needDraftLandName) existing.name = wizard._needDraftLandName;
          if (wizard._needDraftLandArea) existing.area = wizard._needDraftLandArea;
        } else if (wizard._needDraftLandName || wizard._needDraftLandArea) {
          existing = { name: wizard._needDraftLandName || 'مزرعه من', area: wizard._needDraftLandArea || 2 };
        }
        openNeedNewLandDetailsPage(loc, existing);
        return;
      }
      if (_origAssetsAfterMapPick) _origAssetsAfterMapPick(loc);
    };
    if (typeof global.openMobileMapPickerOverlay === 'function') {
      global.openMobileMapPickerOverlay();
    }
  }
  global.reopenNeedLandMap = reopenNeedLandMap;


  function closeNeedNewLandPage(keepEditState) {
    var el = document.getElementById('keloNeedNewLandPage');
    if (el) el.remove();
    if (window._needNewLandMap) { try { window._needNewLandMap.remove(); } catch (e) {} window._needNewLandMap = null; }
    wizard._needNewLandMode = false;
    if (!keepEditState) {
      wizard._needEditingLandId = null;
      wizard._needDraftLandName = null;
      wizard._needDraftLandArea = null;
    }
  }
  global.closeNeedNewLandPage = closeNeedNewLandPage;

  var KELO_CROP_OPTIONS = ['برنج', 'گندم', 'مرکبات', 'سبزیجات'];

  function openCropPicker() {
    var current = (document.getElementById('needNewLandCrop') || {}).value || wizard._needDraftCrop || '';
    wizard._cropPickerTemp = current;
    var existing = document.getElementById('keloCropPicker');
    if (existing) existing.remove();
    var bd = document.createElement('div');
    bd.id = 'keloCropPicker';
    bd.className = 'mobile-sheet-backdrop level3';
    bd.style.zIndex = '6900';
    var listHtml = KELO_CROP_OPTIONS.map(function (name) {
      var active = name === current;
      return '<button type="button" class="service-picker-simple' + (active ? ' is-selected' : '') + '" data-crop="' + escapeHtml(name) + '" onclick="chooseCropTemp(this)">'
        + '<strong>' + escapeHtml(name) + '</strong></button>';
    }).join('');
    bd.innerHTML =
      '<div class="mobile-sheet picker" role="dialog">'
      + '<button type="button" class="mobile-sheet-handle"></button>'
      + '<div class="mobile-sheet-header"><button type="button" class="mobile-sheet-back-btn" onclick="closeCropPicker()" aria-label="بازگشت">' + KELO_BACK_CHEVRON_SVG + '</button>'
      + '<h2>نوع محصول</h2><span></span></div>'
      + '<div class="mobile-sheet-body"><div class="service-picker-simple-list">' + listHtml + '</div></div>'
      + '<div class="mobile-sheet-footer"><button type="button" class="btn btn-primary" onclick="confirmCropPicker()">تأیید</button></div>'
      + '</div>';
    document.body.appendChild(bd);
  }
  global.openCropPicker = openCropPicker;


  function chooseCropTemp(btn) {
    var name = btn && btn.getAttribute('data-crop');
    wizard._cropPickerTemp = name;
    var list = document.querySelector('#keloCropPicker .service-picker-simple-list');
    if (list) {
      list.querySelectorAll('.service-picker-simple').forEach(function (c) {
        c.classList.toggle('is-selected', c.getAttribute('data-crop') === name);
      });
    }
  }
  global.chooseCropTemp = chooseCropTemp;

  function confirmCropPicker() {
    var name = wizard._cropPickerTemp || '';
    if (!name) { if (typeof showToast === 'function') showToast('نوع محصول را انتخاب کنید', 'error'); return; }
    wizard._needDraftCrop = name;
    var hid = document.getElementById('needNewLandCrop');
    if (hid) hid.value = name;
    var lbl = document.getElementById('needLandCropLabel');
    if (lbl) { lbl.textContent = name; lbl.classList.remove('placeholder'); }
    closeCropPicker();
  }
  global.confirmCropPicker = confirmCropPicker;

  function closeCropPicker() {
    var el = document.getElementById('keloCropPicker');
    if (el) el.remove();
  }
  global.closeCropPicker = closeCropPicker;

  function saveNeedNewLand() {
    var nameEl = document.getElementById('needNewLandName');
    var areaEl = document.getElementById('needNewLandArea');
    var name = (nameEl && nameEl.value || '').trim();
    var area = areaEl ? Number(areaEl.value) : 0;
    var loc = wizard._needPendingLandLoc;
    var editingId = wizard._needEditingLandId || null;
    var crop = ((document.getElementById('needNewLandCrop') || {}).value || wizard._needDraftCrop || '').trim();
    if (!name) { if (typeof showToast === 'function') showToast('نام زمین را وارد کنید', 'error'); return; }
    if (!(area > 0)) { if (typeof showToast === 'function') showToast('مساحت معتبر وارد کنید', 'error'); return; }
    if (!crop) { if (typeof showToast === 'function') showToast('نوع محصول را انتخاب کنید', 'error'); return; }
    // client-side duplicate name check
    var nameKey = name.replace(/\s+/g, ' ').toLowerCase();
    var dup = (_needLandsCache || []).some(function (x) {
      return x && String(x.id) !== String(editingId || '')
        && String(x.name || '').trim().replace(/\s+/g, ' ').toLowerCase() === nameKey;
    });
    if (dup) {
      if (typeof showToast === 'function') showToast('زمینی با این نام از قبل دارید. نام دیگری انتخاب کنید.', 'error');
      return;
    }
    if (!loc || loc.lat == null || loc.lng == null) {
      if (typeof showToast === 'function') showToast('موقعیت مشخص نیست', 'error');
      return;
    }
    var lat = Number(loc.lat), lng = Number(loc.lng);
    if (isNaN(lat) || isNaN(lng)) {
      if (typeof showToast === 'function') showToast('موقعیت نامعتبر است', 'error');
      return;
    }
    var location = Object.assign({}, loc, { lat: lat, lng: lng });
    var payload = {
      name: name,
      area: area,
      crop: crop,
      location: location,
      city: (location.city || location.label || ''),
      userId: currentUser && currentUser.id
    };
    if (editingId) payload.id = editingId;

    var finish = function (land) {
      closeNeedNewLandPage();
      if (land && land.id) {
        if (!land.location) land.location = location;
        upsertNeedLandCache(land);
        _needSelectedLandId = land.id;
        if (typeof writePreferredLandId === 'function') writePreferredLandId(land.id);
        applyLandToWizard(land);
        paintNeedLandPill();
        if (typeof showToast === 'function') showToast(editingId ? 'زمین به‌روزرسانی شد' : 'زمین ذخیره شد', 'success');
      } else if (typeof showToast === 'function') {
        showToast('ذخیره شد', 'success');
      }
      loadNeedLands();
      openNeedLandPicker();
    };

    var onRes = function (res) {
      if (res && res.ok) {
        var land = null;
        if (res.data) {
          land = res.data.land || res.data.item || null;
          if (!land && res.data.id) land = res.data;
        }
        finish(land);
      } else {
        if (typeof showToast === 'function') showToast((res && res.message) || 'ذخیره زمین انجام نشد', 'error');
      }
    };

    try {
      var svc = window.KeloService && window.KeloService.assets;
      if (editingId && svc && typeof svc.updateLand === 'function') {
        Promise.resolve(svc.updateLand(payload)).then(onRes).catch(function () {
          if (typeof showToast === 'function') showToast('ذخیره زمین انجام نشد', 'error');
        });
        return;
      }
      if (svc && typeof svc.createLand === 'function') {
        Promise.resolve(svc.createLand(payload)).then(onRes).catch(function () {
          if (typeof showToast === 'function') showToast('ذخیره زمین انجام نشد', 'error');
        });
        return;
      }
      if (editingId && window.KeloLocalAdapter && typeof window.KeloLocalAdapter.updateLand === 'function') {
        Promise.resolve(window.KeloLocalAdapter.updateLand(payload)).then(onRes);
        return;
      }
      if (window.KeloLocalAdapter && typeof window.KeloLocalAdapter.createLand === 'function') {
        Promise.resolve(window.KeloLocalAdapter.createLand(payload)).then(onRes);
        return;
      }
    } catch (e) {
      if (typeof showToast === 'function') showToast('خطا در ذخیره زمین', 'error');
      return;
    }
    if (typeof showToast === 'function') showToast('سرویس دارایی در دسترس نیست', 'error');
  }
  global.saveNeedNewLand = saveNeedNewLand;



  function submitNeedRequestPage() {
    if (!currentUser) return;
    var land = selectedNeedLand();
    if (!land && !_needSelectedLandId) {
      if (typeof showToast === 'function') showToast('لطفاً زمین را انتخاب کنید', 'error');
      openNeedLandPicker();
      return;
    }
    if (!wizard.service) {
      if (typeof showToast === 'function') showToast('نوع خدمت را انتخاب کنید', 'error');
      if (typeof openMobileServicePicker === 'function') openMobileServicePicker();
      return;
    }
    if (!wizard.data.dateStart) {
      if (typeof showToast === 'function') showToast('تاریخ شروع را انتخاب کنید', 'error');
      return;
    }
    // ensure location/area from land for matching
    var land = selectedNeedLand();
    if (land) applyLandToWizard(land);
    // coerce if already on wizard but string-typed
    if (wizard.data.serviceLocation) {
      var sl = wizard.data.serviceLocation;
      if (sl.lat != null) sl.lat = Number(sl.lat);
      if (sl.lng != null) sl.lng = Number(sl.lng);
    }
    if (!wizard.data.serviceLocation || typeof wizard.data.serviceLocation.lat !== 'number' || isNaN(wizard.data.serviceLocation.lat)) {
      if (typeof showToast === 'function') showToast('موقعیت زمین ناقص است؛ زمین دیگری انتخاب کنید یا زمین جدید ثبت کنید', 'error');
      return;
    }
    // submit via existing finalize path
    submitMobileFormFromNeed();
  }
  global.submitNeedRequestPage = submitNeedRequestPage;

  async function submitMobileFormFromNeed() {
    // mirror submitMobileForm / finalizeMobileForm for receive
    if (typeof keloFarmerHasUnpaidBlock === 'function' && keloFarmerHasUnpaidBlock(currentUser.id)) {
      if (typeof showToast === 'function') showToast('ابتدا پرداخت کار تمام‌شده را ثبت کنید تا بتوانید درخواست جدید بزنید.', 'error');
      return;
    }
    var savedType = 'receive';
    var savedService = wizard.service;
    var data = cloneObject(wizard.data);
    if (data.dateStart) data.date = data.dateStart;
    var requestApi = window.KeloService && window.KeloService.requests;
    if (!requestApi) { if (typeof showToast === 'function') showToast('سرویس درخواست در دسترس نیست.', 'error'); return; }
    var result = await requestApi.create({
      userId: currentUser.id,
      requesterName: currentUser.name,
      service: savedService,
      data: data,
      requestKind: 'need'
    });
    if (!result || !result.ok) {
      if (typeof showToast === 'function') showToast((result && result.message) || 'ذخیره اطلاعات انجام نشد.', 'error');
      return;
    }
    if (result.data && result.data.snapshot) {
      applyServerSnapshot(result.data.snapshot);
      try { window.db = db; } catch (e) {}
    }
    var newId = (result.data && result.data.id) || null;
    closeNeedRequestPage();
    if (typeof clearWizardDraft === 'function') clearWizardDraft();
    mobileRequestSuccess = true;
    mobileSuccessData = { type: savedType, service: savedService, id: newId, ts: Date.now() };
    try { sessionStorage.setItem('kelo_mobile_success', JSON.stringify(mobileSuccessData)); } catch (e) {}
    try { if (typeof refreshHomeFlow === 'function') refreshHomeFlow(); } catch (e) {}
    if (typeof setMobileTab === 'function') setMobileTab('request');
    if (typeof showToast === 'function') showToast('درخواست ثبت شد', 'success');
  }





  /* Machine types by service (Iran — single field, filtered) */
  var KELO_MACHINE_TYPES = {
    tractor: [
      'تراکتور + گاوآهن زراعی',
      'تراکتور + دیسک / هرس',
      'تراکتور + چیزل',
      'تراکتور + روتیواتور',
      'تراکتور باغی + ادوات باغی',
      'تراکتور شالیزاری + ادوات شالیزار',
      'تیلر دوچرخ',
      'سایر'
    ],
    planting: [
      'نشاکار برنج (۴ ردیفه)',
      'نشاکار برنج (۶ ردیفه)',
      'بذرکار / خطی‌کار گندم',
      'بذرکار پنوماتیک',
      'کودکار–بذرکار',
      'سایر'
    ],
    spray: [
      'سمپاش بوم‌دار',
      'سمپاش توربینی / بادبزنی',
      'سمپاش لانس‌دار',
      'سمپاش کتابی / موتوری',
      'پهپاد سمپاش',
      'سایر'
    ],
    harvest: [
      'کمباین برنج',
      'کمباین غلات / گندم',
      'دروگر برنج',
      'دروگر غلات',
      'خرمن‌کوب',
      'سایر'
    ]
  };
  // alias common service keys
  KELO_MACHINE_TYPES.shovel = KELO_MACHINE_TYPES.tractor;
  KELO_MACHINE_TYPES.tillage = KELO_MACHINE_TYPES.tractor;
  KELO_MACHINE_TYPES.disk = KELO_MACHINE_TYPES.tractor;
  KELO_MACHINE_TYPES.seeding = KELO_MACHINE_TYPES.planting;
  KELO_MACHINE_TYPES.spraying = KELO_MACHINE_TYPES.spray;
  KELO_MACHINE_TYPES.combine = KELO_MACHINE_TYPES.harvest;

  function machineTypesForService(serviceKey) {
    if (!serviceKey) return [];
    var list = KELO_MACHINE_TYPES[serviceKey];
    if (list && list.length) return list.slice();
    // fallback: try SERVICE_DEFS slug match
    return ['سایر'];
  }
  global.machineTypesForService = machineTypesForService;
  global.KELO_MACHINE_TYPES = KELO_MACHINE_TYPES;

  /* ========== Provide-request page (machine chip + area + dates + price) ========== */
  var _provideFleetCache = [];
  var _provideSelectedMachineId = null;
  var PROVIDE_MACHINE_PREF_KEY = 'kelo_provide_selected_machine_id';

  function readPreferredMachineId() {
    try {
      var uid = currentUser && currentUser.id;
      if (!uid) return null;
      var raw = localStorage.getItem(PROVIDE_MACHINE_PREF_KEY);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      if (obj && String(obj.userId) === String(uid) && obj.machineId) return obj.machineId;
    } catch (e) {}
    return null;
  }
  function writePreferredMachineId(machineId) {
    try {
      var uid = currentUser && currentUser.id;
      if (!uid) return;
      if (!machineId) { localStorage.removeItem(PROVIDE_MACHINE_PREF_KEY); return; }
      localStorage.setItem(PROVIDE_MACHINE_PREF_KEY, JSON.stringify({ userId: uid, machineId: machineId }));
    } catch (e) {}
  }

  function providePageEl() { return document.getElementById('keloProvideRequestPage'); }

  function closeProvideRequestPage() {
    var el = providePageEl();
    if (el) el.remove();
    var ms = document.getElementById('keloMachinePickerSheet');
    if (ms) ms.remove();
    var mf = document.getElementById('keloProvideMachineForm');
    if (mf) mf.remove();
    document.body.style.overflow = '';
    document.documentElement.removeAttribute('data-form-theme');
    if (wizard) {
      wizard.formSheetOpen = false;
      wizard._provideFlow = false;
    }
  }

  function openProvideRequestPage() {
    if (!currentUser) return;
    wizard = makeEmptyWizard();
    wizard.type = 'provide';
    wizard._provideFlow = true;
    wizard.formSheetOpen = true;
    document.documentElement.setAttribute('data-form-theme', 'orange');
    if (!wizard.data.dateStart) wizard.data.dateStart = localDateToIso(new Date());
    if (!wizard.data.priceUnit) wizard.data.priceUnit = 'تومان / هکتار';
    _provideSelectedMachineId = readPreferredMachineId();
    renderProvideRequestPage();
    loadProvideFleet();
  }
  global.openProvideRequestPage = openProvideRequestPage;
  global.closeProvideRequestPage = closeProvideRequestPage;

  function loadProvideFleet() {
    var done = function (list) {
      _provideFleetCache = Array.isArray(list) ? list.slice() : [];
      if (!_provideSelectedMachineId) _provideSelectedMachineId = readPreferredMachineId();
      if (_provideSelectedMachineId) {
        var m = selectedProvideMachine();
        if (m) applyMachineToWizard(m);
        else { _provideSelectedMachineId = null; writePreferredMachineId(null); }
      } else if (_provideFleetCache.length === 1) {
        _provideSelectedMachineId = _provideFleetCache[0].id;
        applyMachineToWizard(_provideFleetCache[0]);
        writePreferredMachineId(_provideSelectedMachineId);
      }
      paintProvideMachinePill();
      if (document.getElementById('provideMachinePickerBody')) paintProvideMachinePickerBody();
    };
    var parse = function (res) {
      if (!res) return [];
      if (res.ok && res.data && Array.isArray(res.data.fleet)) return res.data.fleet;
      if (res.ok && res.data && Array.isArray(res.data.machines)) return res.data.machines;
      if (res.ok && Array.isArray(res.data)) return res.data;
      return [];
    };
    var fromDb = function () {
      try {
        var uid = currentUser && currentUser.id;
        var db = (window.KeloService && window.KeloService.query && window.KeloService.query.mirror)
          ? window.KeloService.query.mirror() : (window.db || null);
        if (!db || !Array.isArray(db.fleet)) return [];
        return db.fleet.filter(function (x) { return x && !x.deleted && String(x.userId) === String(uid); });
      } catch (e) { return []; }
    };
    try {
      var svc = window.KeloService && window.KeloService.assets;
      if (svc && typeof svc.listFleet === 'function') {
        Promise.resolve(svc.listFleet()).then(function (res) {
          var list = parse(res);
          if (!list.length) list = fromDb();
          done(list);
        }).catch(function () { done(fromDb()); });
        return;
      }
      if (window.KeloLocalAdapter && typeof window.KeloLocalAdapter.listFleet === 'function') {
        Promise.resolve(window.KeloLocalAdapter.listFleet({ userId: currentUser && currentUser.id })).then(function (res) {
          var list = parse(res);
          if (!list.length) list = fromDb();
          done(list);
        }).catch(function () { done(fromDb()); });
        return;
      }
    } catch (e) {}
    done(fromDb());
  }

  function selectedProvideMachine() {
    if (!_provideSelectedMachineId) return null;
    return (_provideFleetCache || []).find(function (x) { return String(x.id) === String(_provideSelectedMachineId); }) || null;
  }

  function applyMachineToWizard(m) {
    if (!m || !wizard) return false;
    if (!wizard.data) wizard.data = {};
    wizard.data.machineId = m.id;
    wizard.data.machineType = m.machineType || m.name || '';
    wizard.data.capacity = m.capacity || '';
    if (m.service) wizard.service = m.service;
    if (m.photo) wizard.data.machinePhoto = m.photo;
    return true;
  }

  function paintProvideMachinePill() {
    var pill = document.getElementById('provideMachinePillLabel');
    if (!pill) return;
    var m = selectedProvideMachine();
    if (m) {
      pill.textContent = m.machineType || m.name || 'ماشین';
      pill.classList.remove('is-placeholder');
    } else {
      pill.textContent = 'انتخاب ماشین';
      pill.classList.add('is-placeholder');
    }
  }

  function renderProvideRequestPage() {
    var existing = providePageEl();
    var prevScroll = 0;
    if (existing) {
      var b = existing.querySelector('.provide-request-body, .mobile-sheet-body');
      if (b) prevScroll = b.scrollTop;
      existing.remove();
    }
    var page = document.createElement('div');
    page.id = 'keloProvideRequestPage';
    page.className = 'mobile-sheet-backdrop provide-request-page';
    page.style.zIndex = '5200';
    var hadPage = !!existing;
    var datesHtml = '<div class="mobile-two-col need-dates-row">'
      + '<div class="wizard-field-wrap" data-field-wrapper="dateStart">' + renderMobileDateField('dateStart', 'از تاریخ', true) + '</div>'
      + '<div class="wizard-field-wrap" data-field-wrapper="dateEnd">' + renderMobileDateField('dateEnd', 'تا تاریخ', false) + '</div>'
      + '</div>';
    var priceHtml = '<div class="wizard-field-wrap" data-field-wrapper="price"><div class="sidebar-field"><label>قیمت <span style="color:red">*</span></label>'
      + '<div class="mobile-two-col"><div><input id="wf_price" data-wizard-field="price" class="input" type="number" min="0" required value="' + escapeHtml(wizard.data.price || '') + '" placeholder="مثلاً 3000000" oninput="wizard.data.price=this.value"></div>'
      + '<div data-field-wrapper="priceUnit">' + renderMobilePriceUnitField(['priceUnit','واحد قیمت','select',['تومان / هکتار','تومان / روز','تومان / سرویس'],true]) + '</div></div></div></div>';
    var areaHtml = '<div class="wizard-field-wrap" data-field-wrapper="activityArea">' + renderActivityAreaField('activityArea', 'محدوده فعالیت', true, true) + '</div>';
    page.innerHTML =
      '<div class="mobile-sheet provide-request-inner' + (hadPage ? ' no-anim' : '') + '" role="dialog" aria-modal="true">'
      + '<button type="button" class="mobile-sheet-handle" aria-hidden="true"></button>'
      + '<div class="mobile-sheet-header need-request-header">'
      +   '<button type="button" class="mobile-sheet-back-btn" onclick="closeProvideRequestPage()" aria-label="بازگشت">' + KELO_BACK_CHEVRON_SVG + '</button>'
      +   '<h2 class="need-request-title">ارائه خدمت</h2><span></span>'
      + '</div>'
      + '<div class="mobile-sheet-body provide-request-body need-request-body">'
      +   '<div class="need-land-pill-wrap">'
      +     '<button type="button" class="need-land-pill provide-machine-pill" id="provideMachinePill" onclick="openProvideMachinePicker()">'
      +       '<span class="need-land-pill-label is-placeholder" id="provideMachinePillLabel">انتخاب ماشین</span>'
      +       '<i class="kelo-chevron down"></i>'
      +     '</button>'
      +   '</div>'
      +   areaHtml + datesHtml + priceHtml
      + '</div>'
      + '<div class="mobile-sheet-footer need-request-footer">'
      +   '<button type="button" class="btn btn-primary btn-block" onclick="submitProvideRequestPage()">ثبت خدمت</button>'
      + '</div></div>';
    document.body.appendChild(page);
    document.body.style.overflow = 'hidden';
    paintProvideMachinePill();
    if (prevScroll) {
      var nb = page.querySelector('.provide-request-body');
      if (nb) nb.scrollTop = prevScroll;
    }
    if (wizard.calendarOpen && wizard.calendarId) {
      try { renderCalendarModal(); } catch (e) {}
    }
  }
  global.renderProvideRequestPage = renderProvideRequestPage;

  function refreshProvideRequestFieldsOnly() {
    if (!wizard || !wizard._provideFlow) return;
    var page = providePageEl();
    if (!page) { renderProvideRequestPage(); return; }
    // Dates — replace only the two date wrappers
    ['dateStart', 'dateEnd'].forEach(function (id) {
      var wrap = page.querySelector('[data-field-wrapper="' + id + '"]');
      if (!wrap) return;
      var label = id === 'dateStart' ? 'از تاریخ' : 'تا تاریخ';
      wrap.innerHTML = renderMobileDateField(id, label, id === 'dateStart');
    });
    // Activity area trigger text only
    var areaWrap = page.querySelector('[data-field-wrapper="activityArea"]');
    if (areaWrap) {
      areaWrap.innerHTML = renderActivityAreaField('activityArea', 'محدوده فعالیت', true, true);
    }
    // Price unit label
    var unitWrap = page.querySelector('[data-field-wrapper="priceUnit"]');
    if (unitWrap) {
      unitWrap.innerHTML = renderMobilePriceUnitField(['priceUnit','واحد قیمت','select',['تومان / هکتار','تومان / روز','تومان / سرویس'],true]);
    }
    // Keep price input value in sync without rebuild
    var priceEl = document.getElementById('wf_price');
    if (priceEl && wizard.data.price != null && document.activeElement !== priceEl) {
      priceEl.value = wizard.data.price;
    }
    paintProvideMachinePill();
  }
  global.refreshProvideRequestFieldsOnly = refreshProvideRequestFieldsOnly;


  function openProvideMachinePicker() {
    loadProvideFleet();
    var existing = document.getElementById('keloMachinePickerSheet');
    if (existing) {
      paintProvideMachinePickerBody();
      return;
    }
    var bd = document.createElement('div');
    bd.id = 'keloMachinePickerSheet';
    bd.className = 'mobile-sheet-backdrop land-picker-backdrop machine-picker-backdrop';
    bd.style.zIndex = '5600';
    bd.innerHTML =
      '<div class="mobile-sheet land-picker-sheet" role="dialog" aria-modal="true">'
      + '<button type="button" class="mobile-sheet-handle" aria-hidden="true"></button>'
      + '<div class="land-picker-head-row">'
      +   '<div class="land-picker-title-group">'
      +     '<button type="button" class="land-picker-close" onclick="closeProvideMachinePicker()" aria-label="بستن">×</button>'
      +     '<strong class="land-picker-title">انتخاب ماشین</strong>'
      +   '</div>'
      +   '<button type="button" class="land-picker-new" onclick="startProvideNewMachine()">+ ماشین جدید</button>'
      + '</div>'
      + '<p class="land-picker-hint">برای ثبت ارائه خدمت، ابتدا ماشین خود را مشخص کنید.</p>'
      + '<div class="mobile-sheet-body land-picker-body" id="provideMachinePickerBody"></div>'
      + '<div class="mobile-sheet-footer"><button type="button" class="btn btn-primary btn-block" onclick="confirmProvideMachinePicker()">تأیید</button></div>'
      + '</div>';
    document.body.appendChild(bd);
    bd.addEventListener('click', function (e) { if (e.target === bd) closeProvideMachinePicker(); });
    paintProvideMachinePickerBody();
  }
  global.openProvideMachinePicker = openProvideMachinePicker;

  function closeProvideMachinePicker() {
    var el = document.getElementById('keloMachinePickerSheet');
    if (el) el.remove();
  }
  global.closeProvideMachinePicker = closeProvideMachinePicker;

  function paintProvideMachinePickerBody() {
    var body = document.getElementById('provideMachinePickerBody');
    if (!body) return;
    var list = _provideFleetCache || [];
    if (!list.length) {
      body.innerHTML = '<div class="land-picker-empty">'
        + '<p class="land-picker-empty-title">ماشینی ذخیره نشده.</p>'
        + '<p class="land-picker-empty-sub">برای ثبت ارائه خدمت، ابتدا ماشین خود را اضافه کنید.</p></div>';
      return;
    }
    body.innerHTML = '<div class="land-picker-options">' + list.map(function (m) {
      var active = String(m.id) === String(_provideSelectedMachineId);
      var title = m.machineType || m.name || 'ماشین';
      var svcName = (m.service && SERVICE_DEFS[m.service]) ? SERVICE_DEFS[m.service].name : (m.service || '');
      var meta = [svcName, m.capacity].filter(Boolean).join('  |  ');
      var idEsc = escapeHtml(String(m.id));
      return '<div class="land-picker-option' + (active ? ' is-selected' : '') + '">'
        + '<label class="land-picker-option-main">'
        +   '<input type="radio" name="keloProvideMachine" value="' + idEsc + '"'
        +   (active ? ' checked' : '') + ' onchange="selectProvideMachine(\'' + idEsc + '\', true)">'
        +   '<span class="land-picker-option-text">'
        +     '<strong class="land-picker-option-name">' + escapeHtml(title) + '</strong>'
        +     (meta ? '<span class="land-picker-option-addr">' + escapeHtml(meta) + '</span>' : '')
        +   '</span></label>'
        + '<div class="land-picker-option-actions">'
        +   '<button type="button" class="land-card-btn land-card-edit" onclick="event.preventDefault();event.stopPropagation();editProvideMachine(\'' + idEsc + '\')">ویرایش</button>'
        +   '<button type="button" class="land-card-btn land-card-del" onclick="event.preventDefault();event.stopPropagation();deleteProvideMachine(\'' + idEsc + '\')">حذف</button>'
        + '</div></div>';
    }).join('') + '</div>';
  }

  function selectProvideMachine(id, keepOpen) {
    _provideSelectedMachineId = id;
    writePreferredMachineId(id);
    var m = selectedProvideMachine();
    if (m) applyMachineToWizard(m);
    paintProvideMachinePill();
    if (document.getElementById('provideMachinePickerBody')) paintProvideMachinePickerBody();
    if (!keepOpen) closeProvideMachinePicker();
  }
  global.selectProvideMachine = selectProvideMachine;

  function confirmProvideMachinePicker() {
    if (!_provideSelectedMachineId) {
      if (typeof showToast === 'function') showToast('لطفاً یک ماشین را انتخاب کنید', 'error');
      return;
    }
    var m = selectedProvideMachine();
    if (m) applyMachineToWizard(m);
    paintProvideMachinePill();
    closeProvideMachinePicker();
  }
  global.confirmProvideMachinePicker = confirmProvideMachinePicker;

  function deleteProvideMachine(id) {
    if (!id || !confirm('این ماشین حذف شود؟')) return;
    var uid = currentUser && currentUser.id;
    var done = function (ok, msg) {
      if (!ok) { if (typeof showToast === 'function') showToast(msg || 'حذف انجام نشد', 'error'); return; }
      _provideFleetCache = (_provideFleetCache || []).filter(function (x) { return String(x.id) !== String(id); });
      if (String(_provideSelectedMachineId) === String(id)) {
        _provideSelectedMachineId = null;
        writePreferredMachineId(null);
      }
      paintProvideMachinePill();
      paintProvideMachinePickerBody();
      if (typeof showToast === 'function') showToast('ماشین حذف شد', 'success');
      loadProvideFleet();
    };
    try {
      var svc = window.KeloService && window.KeloService.assets;
      if (svc && typeof svc.deleteMachine === 'function') {
        Promise.resolve(svc.deleteMachine(id, uid)).then(function (res) { done(res && res.ok, res && res.message); });
        return;
      }
      if (window.KeloLocalAdapter && typeof window.KeloLocalAdapter.deleteMachine === 'function') {
        Promise.resolve(window.KeloLocalAdapter.deleteMachine({ id: id, userId: uid })).then(function (res) {
          done(res && res.ok, res && res.message);
        });
        return;
      }
    } catch (e) {}
    done(false);
  }
  global.deleteProvideMachine = deleteProvideMachine;

  function editProvideMachine(id) {
    var m = (_provideFleetCache || []).find(function (x) { return String(x.id) === String(id); });
    if (!m) return;
    closeProvideMachinePicker();
    openProvideMachineForm(m);
  }
  global.editProvideMachine = editProvideMachine;

  function startProvideNewMachine() {
    // Like + زمین جدید: close list, open form once without double-anim flicker
    wizard._provideOpenFromPicker = true;
    var picker = document.getElementById('keloMachinePickerSheet');
    if (picker) picker.remove();
    // open form in next frame so picker unmount does not clash with form mount
    requestAnimationFrame(function () {
      openProvideMachineForm(null);
      wizard._provideOpenFromPicker = false;
    });
  }
  global.startProvideNewMachine = startProvideNewMachine;

  function openProvideMachineForm(existing) {
    wizard._provideEditingMachineId = existing && existing.id ? existing.id : null;
    if (existing && existing.service) wizard.service = existing.service;
    var svc = wizard.service || (existing && existing.service) || '';
    var mtype = (existing && (existing.machineType || existing.name)) || (wizard._provideDraftMachineType || '');
    var cap = (existing && existing.capacity) || (wizard._provideDraftCapacity || '');
    var photo = (existing && existing.photo) || wizard._provideMachinePhoto || '';
    var customOther = (wizard._provideMachineOtherText || '');
    if (mtype && mtype !== 'سایر' && (machineTypesForService(svc) || []).indexOf(mtype) < 0) {
      customOther = mtype;
      mtype = 'سایر';
    }
    wizard._provideDraftMachineType = mtype;
    wizard._provideDraftCapacity = cap;
    wizard._provideMachinePhoto = photo || null;
    wizard._provideMachineOtherText = customOther;

    var existingPage = document.getElementById('keloProvideMachineForm');
    var soft = !!existingPage || !!wizard._provideOpenFromPicker;
    var page = existingPage;
    if (!page) {
      page = document.createElement('div');
      page.id = 'keloProvideMachineForm';
      page.className = 'mobile-sheet-backdrop need-new-land-page provide-machine-form-page';
      page.style.zIndex = '5700';
      // match land details page: no backdrop re-anim flash
      page.style.animation = 'none';
      document.body.appendChild(page);
    }

    var serviceLabel = (svc && SERVICE_DEFS[svc]) ? SERVICE_DEFS[svc].name : 'انتخاب کنید';
    var machineLabel = (mtype === 'سایر' && customOther) ? customOther : (mtype || 'انتخاب کنید');
    var title = wizard._provideEditingMachineId ? 'ویرایش ماشین' : 'ماشین جدید';
    var otherBox = (mtype === 'سایر')
      ? ('<div class="wizard-field-wrap" id="provideMachineOtherWrap"><div class="sidebar-field"><label>شرح ماشین</label>'
        + '<input type="text" id="provideMachineOther" class="input" placeholder="نوع ماشین را بنویسید" value="' + escapeHtml(customOther) + '" oninput="wizard._provideMachineOtherText=this.value"></div></div>')
      : '<div class="wizard-field-wrap" id="provideMachineOtherWrap" style="display:none"><div class="sidebar-field"><label>شرح ماشین</label>'
        + '<input type="text" id="provideMachineOther" class="input" placeholder="نوع ماشین را بنویسید" value="" oninput="wizard._provideMachineOtherText=this.value"></div></div>';

    page.innerHTML =
      '<div class="mobile-sheet need-new-land-inner provide-machine-form-inner' + (soft ? ' no-anim' : '') + '">'
      + '<button type="button" class="mobile-sheet-handle" aria-hidden="true"></button>'
      + '<div class="mobile-sheet-header need-new-land-header">'
      +   '<button type="button" class="land-picker-close" onclick="closeProvideMachineForm()" aria-label="بستن">×</button>'
      +   '<strong>' + escapeHtml(title) + '</strong><span></span>'
      + '</div>'
      + '<div class="mobile-sheet-body need-new-land-body">'
      +   '<div class="wizard-field-wrap" data-field-wrapper="machineCombo"><div class="sidebar-field"><label>نوع خدمت و ماشین‌آلات <span style="color:red">*</span></label>'
      +   '<button type="button" class="mobile-choice-trigger" onclick="openCombinedMachinePicker()"><span class="' + (mtype || svc ? '' : 'placeholder') + '" id="provideMachineComboLabel">'
      +     escapeHtml(svc && mtype ? (serviceLabel + ' · ' + machineLabel) : (svc ? serviceLabel : 'انتخاب کنید'))
      +   '</span><span class="kelo-inline-chevron"><i class="kelo-chevron down"></i></span></button>'
      +   '<input type="hidden" id="provideMachineService" value="' + escapeHtml(svc || '') + '">'
      +   '<input type="hidden" id="provideMachineType" value="' + escapeHtml(mtype || '') + '"></div></div>'
      +   otherBox
      +   '<div class="wizard-field-wrap"><div class="sidebar-field"><label>ظرفیت / مشخصه</label>'
      +   '<input type="text" id="provideMachineCap" class="input" placeholder="مثلاً ۴ تن در ساعت" value="' + escapeHtml(cap) + '" oninput="wizard._provideDraftCapacity=this.value"></div></div>'
      +   '<div class="wizard-field-wrap"><div class="sidebar-field"><label>تصویر ماشین (فقط ۱ عکس)</label>'
      +   '<input type="file" id="provideMachinePhoto" class="input" accept="image/*" onchange="onProvideMachinePhotoChange(this)">'
      +   '<div id="provideMachinePhotoPreview" class="provide-machine-photo-preview">' + (photo ? '<img src="' + escapeHtml(photo) + '" alt="">' : '') + '</div></div></div>'
      +   '<div class="wizard-field-wrap"><button type="button" class="btn btn-primary btn-block provide-save-machine-btn" onclick="saveProvideMachine()">' + (wizard._provideEditingMachineId ? 'ذخیره تغییرات' : 'ذخیره ماشین') + '</button></div>'
      + '</div></div>';
  }
  global.openProvideMachineForm = openProvideMachineForm;

  function openCombinedMachinePicker() {
    var currentSvc = (document.getElementById('provideMachineService') || {}).value || wizard.service || '';
    var currentType = (document.getElementById('provideMachineType') || {}).value || wizard._provideDraftMachineType || '';
    wizard._comboPickService = currentSvc || null;
    wizard._comboPickType = currentType || null;
    // accordion open state separate from selection
    wizard._comboOpenService = currentSvc || Object.keys(SERVICE_DEFS || {})[0] || null;

    var existing = document.getElementById('keloCombinedMachinePicker');
    if (existing) {
      paintCombinedMachinePickerBody();
      return;
    }
    var bd = document.createElement('div');
    bd.id = 'keloCombinedMachinePicker';
    bd.className = 'mobile-sheet-backdrop level3';
    bd.style.zIndex = '6900';
    bd.innerHTML =
      '<div class="mobile-sheet picker" role="dialog" aria-modal="true">'
      + '<button type="button" class="mobile-sheet-handle" aria-hidden="true"></button>'
      + '<div class="mobile-sheet-header">'
      +   '<button type="button" class="mobile-sheet-back-btn" onclick="closeCombinedMachinePicker()" aria-label="بازگشت">' + KELO_BACK_CHEVRON_SVG + '</button>'
      +   '<h2>نوع خدمت و ماشین</h2><span></span>'
      + '</div>'
      + '<div class="mobile-sheet-body" id="combinedMachinePickerBody"></div>'
      + '<div class="mobile-sheet-footer"><button type="button" class="btn btn-primary" onclick="confirmCombinedMachinePicker()">تأیید</button></div>'
      + '</div>';
    document.body.appendChild(bd);
    bd.addEventListener('click', function (e) {
      if (e.target === bd) { closeCombinedMachinePicker(); return; }
      // delegate from backdrop so re-paint of body keeps working
      onCombinedMachinePickerClick(e);
    });
    paintCombinedMachinePickerBody();
  }
  global.openCombinedMachinePicker = openCombinedMachinePicker;

  function paintCombinedMachinePickerBody() {
    var body = document.getElementById('combinedMachinePickerBody');
    if (!body) return;
    var html = '';
    var keys = Object.keys(SERVICE_DEFS || {});
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      var s = SERVICE_DEFS[key];
      if (!s) continue;
      var types = machineTypesForService(key) || [];
      var isOpen = wizard._comboOpenService === key;
      html += '<div class="combo-svc-block' + (isOpen ? ' is-open' : '') + '">';
      html += '<button type="button" class="combo-svc-head" data-combo-svc="' + key + '">'
        + '<strong>' + escapeHtml(s.name) + '</strong>'
        + '<i class="kelo-chevron ' + (isOpen ? 'up' : 'down') + '"></i></button>';
      if (isOpen) {
        html += '<div class="mobile-chip-group machine-type-chip-group combo-chip-list">';
        for (var j = 0; j < types.length; j++) {
          var name = types[j];
          var selected = (wizard._comboPickService === key && wizard._comboPickType === name);
          html += '<button type="button" class="mobile-chip' + (selected ? ' active' : '') + '" data-combo-svc="' + key + '" data-combo-idx="' + j + '">'
            + escapeHtml(name) + '</button>';
        }
        html += '</div>';
      }
      html += '</div>';
    }
    body.innerHTML = html;
  }
  global.paintCombinedMachinePickerBody = paintCombinedMachinePickerBody;

  // Event delegation — same pattern as Kelo132 chooseMachineTypeTemp (stable, no inline name args)
  function onCombinedMachinePickerClick(e) {
    var t = e.target;
    if (!t || !t.closest) return;
    var head = t.closest('.combo-svc-head');
    if (head) {
      e.preventDefault();
      e.stopPropagation();
      var key = head.getAttribute('data-combo-svc');
      // Toggle: same key closes; different key opens that section
      if (wizard._comboOpenService === key) {
        wizard._comboOpenService = null;
      } else {
        wizard._comboOpenService = key;
      }
      paintCombinedMachinePickerBody();
      return;
    }
    var row = t.closest('.mobile-chip[data-combo-idx], .combo-machine-row[data-combo-idx]');
    if (row) {
      e.preventDefault();
      e.stopPropagation();
      var svc = row.getAttribute('data-combo-svc');
      var idx = parseInt(row.getAttribute('data-combo-idx'), 10);
      var types = machineTypesForService(svc) || [];
      if (!svc || isNaN(idx) || !types[idx]) return;
      wizard._comboPickService = svc;
      wizard._comboPickType = types[idx];
      wizard._comboOpenService = svc;
      paintCombinedMachinePickerBody();
    }
  }
  global.onCombinedMachinePickerClick = onCombinedMachinePickerClick;

  // Click handled on backdrop in openCombinedMachinePicker (survives body re-paint)

  function toggleComboService(key) {
    if (wizard._comboOpenService === key) wizard._comboOpenService = null;
    else wizard._comboOpenService = key;
    paintCombinedMachinePickerBody();
  }
  global.toggleComboService = toggleComboService;

  function pickComboMachine(serviceKey, machineName) {
    wizard._comboPickService = serviceKey;
    wizard._comboPickType = machineName;
    wizard._comboOpenService = serviceKey;
    paintCombinedMachinePickerBody();
  }
  global.pickComboMachine = pickComboMachine;
  // Keep alias in case old markup remains
  function pickComboMachineEl(btn) {
    if (!btn) return;
    var svc = btn.getAttribute('data-combo-svc') || btn.getAttribute('data-svc');
    var idx = btn.getAttribute('data-combo-idx');
    if (idx != null) {
      var types = machineTypesForService(svc) || [];
      var name = types[parseInt(idx, 10)];
      if (name) pickComboMachine(svc, name);
      return;
    }
    var mtype = btn.getAttribute('data-mtype');
    if (svc && mtype) pickComboMachine(svc, mtype);
  }
  global.pickComboMachineEl = pickComboMachineEl;

  function confirmCombinedMachinePicker() {
    if (!wizard._comboPickService || !wizard._comboPickType) {
      if (typeof showToast === 'function') showToast('خدمت و نوع ماشین را انتخاب کنید', 'error');
      return;
    }
    wizard.service = wizard._comboPickService;
    wizard._provideDraftMachineType = wizard._comboPickType;
    var sh = document.getElementById('provideMachineService');
    var th = document.getElementById('provideMachineType');
    if (sh) sh.value = wizard.service;
    if (th) th.value = wizard._comboPickType;
    var lbl = document.getElementById('provideMachineComboLabel');
    if (lbl) {
      var sn = SERVICE_DEFS[wizard.service] ? SERVICE_DEFS[wizard.service].name : wizard.service;
      lbl.textContent = sn + ' · ' + wizard._comboPickType;
      lbl.classList.remove('placeholder');
    }
    var otherWrap = document.getElementById('provideMachineOtherWrap');
    if (otherWrap) {
      otherWrap.style.display = (wizard._comboPickType === 'سایر') ? '' : 'none';
    }
    if (wizard._comboPickType !== 'سایر') wizard._provideMachineOtherText = '';
    closeCombinedMachinePicker();
  }
  global.confirmCombinedMachinePicker = confirmCombinedMachinePicker;

  function closeCombinedMachinePicker() {
    var el = document.getElementById('keloCombinedMachinePicker');
    if (el) el.remove();
  }
  global.closeCombinedMachinePicker = closeCombinedMachinePicker;

  function openMachineTypePicker() { openCombinedMachinePicker(); }
  global.openMachineTypePicker = openMachineTypePicker;
  function closeMachineTypePicker() { closeCombinedMachinePicker(); }
  global.closeMachineTypePicker = closeMachineTypePicker;




  function closeProvideMachineForm() {
    var el = document.getElementById('keloProvideMachineForm');
    if (el) el.remove();
    wizard._provideEditingMachineId = null;
    wizard._provideMachinePhoto = null;
  }
  global.closeProvideMachineForm = closeProvideMachineForm;

  function onProvideMachinePhotoChange(input) {
    var file = input && input.files && input.files[0];
    if (!file) return;
    if (input.files.length > 1) {
      if (typeof showToast === 'function') showToast('فقط یک تصویر مجاز است', 'error');
    }
    var reader = new FileReader();
    reader.onload = function () {
      wizard._provideMachinePhoto = reader.result;
      var prev = document.getElementById('provideMachinePhotoPreview');
      if (prev) prev.innerHTML = '<img src="' + reader.result + '" alt="">';
    };
    reader.readAsDataURL(file);
  }
  global.onProvideMachinePhotoChange = onProvideMachinePhotoChange;

  function saveProvideMachine() {
    var service = (document.getElementById('provideMachineService') || {}).value || wizard.service || '';
    var machineType = ((document.getElementById('provideMachineType') || {}).value || wizard._provideDraftMachineType || '').trim();
    var capacity = ((document.getElementById('provideMachineCap') || {}).value || '').trim();
    var editingId = wizard._provideEditingMachineId || null;
    if (!service) { if (typeof showToast === 'function') showToast('نوع خدمت را انتخاب کنید', 'error'); return; }
    if (!machineType) { if (typeof showToast === 'function') showToast('نوع ماشین‌آلات را انتخاب کنید', 'error'); return; }
    if (machineType === 'سایر') {
      var otherTxt = ((document.getElementById('provideMachineOther') || {}).value || wizard._provideMachineOtherText || '').trim();
      if (!otherTxt) { if (typeof showToast === 'function') showToast('شرح ماشین (سایر) را بنویسید', 'error'); return; }
      machineType = otherTxt;
    }
    var nameKey = machineType.replace(/\s+/g, ' ').toLowerCase();
    var dup = (_provideFleetCache || []).some(function (x) {
      return x && String(x.id) !== String(editingId || '')
        && String(x.machineType || x.name || '').trim().replace(/\s+/g, ' ').toLowerCase() === nameKey;
    });
    if (dup) {
      if (typeof showToast === 'function') showToast('ماشینی با این نام از قبل دارید. نام دیگری انتخاب کنید.', 'error');
      return;
    }
    var payload = {
      service: service,
      machineType: machineType,
      name: machineType,
      capacity: capacity,
      photo: wizard._provideMachinePhoto || null,
      userId: currentUser && currentUser.id
    };
    if (editingId) payload.id = editingId;
    var finish = function (machine) {
      closeProvideMachineForm();
      if (machine && machine.id) {
        var i = -1;
        for (var k = 0; k < _provideFleetCache.length; k++) {
          if (String(_provideFleetCache[k].id) === String(machine.id)) { i = k; break; }
        }
        if (i >= 0) _provideFleetCache[i] = machine;
        else _provideFleetCache.push(machine);
        _provideSelectedMachineId = machine.id;
        writePreferredMachineId(machine.id);
        applyMachineToWizard(machine);
        paintProvideMachinePill();
      }
      if (typeof showToast === 'function') showToast(editingId ? 'ماشین به‌روزرسانی شد' : 'ماشین ذخیره شد', 'success');
      loadProvideFleet();
      openProvideMachinePicker();
    };
    var onRes = function (res) {
      if (res && res.ok) {
        var machine = (res.data && (res.data.machine || res.data.item || res.data)) || null;
        finish(machine);
      } else {
        if (typeof showToast === 'function') showToast((res && res.message) || 'ذخیره انجام نشد', 'error');
      }
    };
    try {
      var svc = window.KeloService && window.KeloService.assets;
      if (editingId && svc && typeof svc.updateMachine === 'function') {
        Promise.resolve(svc.updateMachine(payload)).then(onRes);
        return;
      }
      if (svc && typeof svc.createMachine === 'function') {
        Promise.resolve(svc.createMachine(payload)).then(onRes);
        return;
      }
      if (editingId && window.KeloLocalAdapter && window.KeloLocalAdapter.updateMachine) {
        Promise.resolve(window.KeloLocalAdapter.updateMachine(payload)).then(onRes);
        return;
      }
      if (window.KeloLocalAdapter && window.KeloLocalAdapter.createMachine) {
        Promise.resolve(window.KeloLocalAdapter.createMachine(payload)).then(onRes);
        return;
      }
    } catch (e) {}
    if (typeof showToast === 'function') showToast('سرویس دارایی در دسترس نیست', 'error');
  }
  global.saveProvideMachine = saveProvideMachine;

  function submitProvideRequestPage() {
    if (!currentUser) return;
    var m = selectedProvideMachine();
    if (!m && !_provideSelectedMachineId) {
      if (typeof showToast === 'function') showToast('لطفاً ماشین را انتخاب کنید', 'error');
      openProvideMachinePicker();
      return;
    }
    if (m) applyMachineToWizard(m);
    if (!wizard.service) {
      if (typeof showToast === 'function') showToast('خدمت ماشین مشخص نیست؛ ماشین را ویرایش کنید', 'error');
      return;
    }
    if (!Array.isArray(wizard.data.activityArea) || !wizard.data.activityArea.length) {
      if (typeof showToast === 'function') showToast('محدوده فعالیت را مشخص کنید', 'error');
      return;
    }
    if (!wizard.data.dateStart) {
      if (typeof showToast === 'function') showToast('تاریخ شروع را انتخاب کنید', 'error');
      return;
    }
    // sync price from input
    var priceEl = document.getElementById('wf_price');
    if (priceEl) wizard.data.price = priceEl.value;
    if (!wizard.data.price || !(Number(wizard.data.price) > 0)) {
      if (typeof showToast === 'function') showToast('قیمت را وارد کنید', 'error');
      return;
    }
    if (!wizard.data.priceUnit) wizard.data.priceUnit = 'تومان / هکتار';
    submitMobileFormFromProvide();
  }
  global.submitProvideRequestPage = submitProvideRequestPage;

  async function submitMobileFormFromProvide() {
    var savedType = 'provide';
    var savedService = wizard.service;
    var data = cloneObject(wizard.data);
    if (data.dateStart) data.date = data.dateStart;
    var requestApi = window.KeloService && window.KeloService.requests;
    if (!requestApi) { if (typeof showToast === 'function') showToast('سرویس درخواست در دسترس نیست.', 'error'); return; }
    var result = await requestApi.create({
      userId: currentUser.id,
      requesterName: currentUser.name,
      service: savedService,
      data: data,
      requestKind: 'provide'
    });
    if (!result || !result.ok) {
      if (typeof showToast === 'function') showToast((result && result.message) || 'ذخیره اطلاعات انجام نشد.', 'error');
      return;
    }
    if (result.data && result.data.snapshot) {
      applyServerSnapshot(result.data.snapshot);
      try { window.db = db; } catch (e) {}
    }
    var newId = (result.data && result.data.id) || null;
    closeProvideRequestPage();
    if (typeof clearWizardDraft === 'function') clearWizardDraft();
    mobileRequestSuccess = true;
    mobileSuccessData = { type: savedType, service: savedService, id: newId, ts: Date.now() };
    try { sessionStorage.setItem('kelo_mobile_success', JSON.stringify(mobileSuccessData)); } catch (e) {}
    try { if (typeof refreshHomeFlow === 'function') refreshHomeFlow(); } catch (e) {}
    if (typeof setMobileTab === 'function') setMobileTab('request');
    if (typeof showToast === 'function') showToast('خدمت ثبت شد', 'success');
  }


  global.KeloRequestUI = {
    name: 'Request',
    init: function () {
      if (_inited) return global.KeloRequestUI;
      _inited = true;
      return global.KeloRequestUI;
    },
    isReady: function () { return _inited; }
  };
  // auto-register handlers already assigned to global above

})(typeof window !== 'undefined' ? window : globalThis);
