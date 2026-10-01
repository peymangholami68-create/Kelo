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
      sb.innerHTML = '<div class="mobile-request-base"><h2>چه کاری برایتان انجام دهیم؟</h2><p>یکی از گزینه‌های زیر را انتخاب کنید</p><div class="role-cards"><button type="button" class="role-card farmer" onclick="openMobileFormSheet(\'receive\')"><div class="role-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22V9"/><path d="M12 13C12 7 6 5 6 5s0 6 6 8"/><path d="M12 13c0-6 6-8 6-8s0 6-6 8"/></svg></div><strong>نیاز به خدمت دارم</strong><span>برای زمین من تراکتور یا کمباین بفرست</span></button><button type="button" class="role-card machine" onclick="openMobileFormSheet(\'provide\')"><div class="role-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="7" cy="18" r="3"/><circle cx="18" cy="18" r="2.5"/><path d="M2 14h3a2 2 0 0 1 2 2v3"/><path d="M7 13V6a1 1 0 0 1 1-1h3l2 5"/><path d="M13 10h4l2 4"/></svg></div><strong>خدمات ارائه می‌دم</strong><span>ماشین‌آلات من آماده کاره</span></button></div></div>';
  }

  global.renderMobileRequestBase = renderMobileRequestBase;

  function requestRecipientCount(requestId, status){
      return db.requestRecipients.filter(x=>x.requestId===requestId && (!status || x.status===status)).length;
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
      const hasPendingRecipients = db.requestRecipients.some(x => x.requestId === r.id && x.status === 'pending');
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
      return '<div class="mobile-activity-card kelo-service-card"' + extraAttrs + '>'
          + '<div class="kelo-card-head"><span class="kelo-card-head-icon">' + serviceCardIconSvg(service) + '</span><div style="flex:1;min-width:0"><strong style="display:block">' + escapeHtml(serviceName(service)) + '</strong>' + subTitleHtml + '</div></div>'
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

      const bodyHtml = '<div class="mobile-sheet-body">' + serviceFieldHtml + fieldsHtml + '</div>';
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
      wizard.servicePickerTemp = { service: wizard.service || null, options: JSON.parse(JSON.stringify(wizard.serviceOptions || {})) };
      wizard.servicePickerExpanded = wizard.service || null;
      wizard.servicePickerSearch = '';
      renderMobileServicePicker();
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
      const temp = wizard.servicePickerTemp || { service:null, options:{} };
      const search = (wizard.servicePickerSearch || '').trim().toLowerCase();
      const serviceKeys = ['tractor','planting','spray','harvest'];

      const cardsHtml = serviceKeys.map(function(key){
          const s = SERVICE_DEFS[key];
          const subfields = SERVICE_L3_FIELDS[key] || [];
          const isSelected = temp.service === key;
          const matchesServiceName = !search || s.name.toLowerCase().includes(search);
          const filteredSubfields = subfields.map(function(sf){ return Object.assign({}, sf, { filteredOptions: sf.options.filter(function(o){ return !search || o.toLowerCase().includes(search); }) }); }).filter(function(sf){ return sf.filteredOptions.length > 0; });
          if(search && !matchesServiceName && filteredSubfields.length === 0) return '';
          const expanded = search ? (filteredSubfields.length > 0) : (wizard.servicePickerExpanded === key);
          const hasBody = subfields.length > 0;
          const subHtml = (subfields.length ? filteredSubfields : []).map(function(sf){
              const current = temp.options[sf.id];
              const arr = Array.isArray(current) ? current : (current ? [current] : []);
              const chips = (sf.filteredOptions || sf.options).map(function(o){ const active = arr.indexOf(o) >= 0; return '<button type="button" class="mobile-chip ' + (active ? 'active' : '') + '" onclick="toggleServicePickerChip(\'' + sf.id + '\',\'' + escapeHtml(o) + '\',' + (sf.multi ? 'true' : 'false') + ')">' + escapeHtml(o) + '</button>'; }).join('');
              return '<div class="mobile-service-subfield"><div class="mobile-chip-group">' + chips + '</div></div>';
          }).join('');
          return '<div class="mobile-service-card ' + (expanded ? 'expanded' : '') + (isSelected ? ' selected' : '') + '"><button type="button" class="mobile-service-card-head" onclick="toggleServicePickerCard(\'' + key + '\')"><span>' + escapeHtml(s.name) + '</span>' + (hasBody ? '<span class="kelo-inline-chevron"><i class="kelo-chevron down"></i></span>' : '<span style="width:20px"></span>') + '</button>' + (expanded && hasBody ? '<div class="mobile-service-card-body">' + subHtml + '</div>' : '') + '</div>';
      }).join('');

      const searchHtml = '<div class="mobile-sheet-search-wrap"><div class="mobile-sheet-search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><input type="text" placeholder="جستجو" value="' + escapeHtml(wizard.servicePickerSearch || '') + '" oninput="filterServicePicker(this.value)"></div></div>';
      const headerHtml = '<button type="button" class="mobile-sheet-handle" aria-label="دستگیره"></button><div class="mobile-sheet-header"><button type="button" class="mobile-sheet-back-btn" onclick="closeMobileServicePicker()" aria-label="بازگشت">'+KELO_BACK_CHEVRON_SVG+'</button><h2>انتخاب خدمت</h2><span></span></div>';
      const bodyHtml = '<div class="mobile-sheet-body">' + searchHtml + (cardsHtml || '<div style="text-align:center;padding:30px;color:var(--neutral-600);font-size:14px">نتیجه‌ای یافت نشد</div>') + '</div>';
      const footerHtml = '<div class="mobile-sheet-footer"><button type="button" class="btn btn-primary" onclick="confirmMobileServicePicker()">تایید</button></div>';

      let sheet = backdrop.querySelector('.mobile-sheet');
      if(!sheet){ sheet = document.createElement('div'); sheet.className = 'mobile-sheet picker'; backdrop.appendChild(sheet); }
      sheet.innerHTML = headerHtml + bodyHtml + footerHtml;
  }

  global.renderMobileServicePicker = renderMobileServicePicker;

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
      const subs = SERVICE_L3_FIELDS[temp.service] || [];
      for(let i=0;i<subs.length;i++){ const sf = subs[i]; if(!sf.required) continue; const v = temp.options[sf.id]; const empty = sf.multi ? (!Array.isArray(v) || !v.length) : !v; if(empty){ showToast('لطفاً یکی از گزینه‌ها را انتخاب کنید', 'error'); return; } }
      wizard.service = temp.service;
      // فقط گزینه‌های همان خدمت انتخاب‌شده
      const keep = {};
      (SERVICE_L3_FIELDS[temp.service] || []).forEach(function(sf){
          if(temp.options[sf.id] !== undefined) keep[sf.id] = temp.options[sf.id];
      });
      wizard.serviceOptions = JSON.parse(JSON.stringify(keep));
      closeMobileServicePicker();
      renderMobileFormSheet();
  }

  global.confirmMobileServicePicker = confirmMobileServicePicker;

  function getJalaliParts(date){ const parts=jalaliPartsFormatter.formatToParts(date).reduce((o,p)=>{ if(['year','month','day'].includes(p.type))o[p.type]=Number(p.value); return o; },{}); return {year:parts.year,month:parts.month,day:parts.day}; }

  global.getJalaliParts = getJalaliParts;

  function jalaliToDate(jy,jm,jd){ const key=jy+'/'+jm+'/'+jd; if(jalaliDateCache.has(key))return new Date(jalaliDateCache.get(key)); const approx=new Date(jy+621,0,1,12); for(let offset=-370;offset<=370;offset++){ const candidate=new Date(approx); candidate.setDate(approx.getDate()+offset); const p=getJalaliParts(candidate); if(p.year===jy && p.month===jm && p.day===jd){ jalaliDateCache.set(key,candidate.getTime()); return candidate; } } return null; }

  global.jalaliToDate = jalaliToDate;

  function getJalaliMonthLength(year,month){ if(month<=6)return 31; if(month<=11)return 30; const start=jalaliToDate(year,12,1), next=jalaliToDate(year+1,1,1); return Math.round((next-start)/86400000); }

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
      const next=shiftJalaliMonth(wizard.calendarYear,wizard.calendarMonth,delta);
      wizard.calendarYear=next.year; wizard.calendarMonth=next.month;
      if(wizard.formSheetOpen){ renderCalendarModal(); } else { renderWizard(); }
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
          if(wizard.formSheetOpen) renderMobileFormSheet(); else renderWizard();
      }
  }

  global.toggleJalaliDate = toggleJalaliDate;

  function confirmJalaliPicker(event){ if(event){event.preventDefault();event.stopPropagation();} wizard.calendarOpen=false; wizard.calendarId=''; wizard.calendarRangeStart=null; if(wizard.formSheetOpen){ const m=document.getElementById('keloCalendarModal'); if(m) m.remove(); renderMobileFormSheet(); } else { renderWizard(); } }

  global.confirmJalaliPicker = confirmJalaliPicker;

  function renderJalaliCalendar(id,multi,help){
      const year=wizard.calendarYear||getJalaliParts(new Date()).year;
      const month=wizard.calendarMonth||getJalaliParts(new Date()).month;
      const days=getJalaliMonthLength(year,month);
      const first=jalaliToDate(year,month,1);
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
      return '<div class="jalali-calendar"><div class="jalali-calendar-head"><button type="button" class="jalali-month-btn" onclick="changeJalaliMonth(-1)"><i class="kelo-chevron right"></i></button><strong>'+JALALI_MONTH_NAMES[month-1]+' '+toPersianDigits(year)+'</strong><button type="button" class="jalali-month-btn" onclick="changeJalaliMonth(1)"><i class="kelo-chevron left"></i></button></div><div class="jalali-calendar-weekdays">'+JALALI_WEEK_NAMES.map(w=>'<span class="jalali-weekday">'+w.slice(0,2)+'</span>').join('')+'</div><div class="jalali-calendar-days">'+dayButtons+'</div></div>'+footer;
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
      const ownerUser=db.users.find(u=>u.id===listing.userId);
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
              listings: db.listings || [],
              machines: db.machines || [],
              users: db.users || [],
              bookings: db.bookings || [],
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
      db.listings
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
      db.machines
        .filter(m=>m.services && m.services[request.service]!==undefined)
        .forEach(m=>{
            const ownerUser=db.users.find(u=>u.name===m.owner);
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
      }
      showToast((result.message) || 'درخواست حذف شد','success');
      renderMobileProposals();
  }

  global.deleteRequest = deleteRequest;

  function editRequest(requestId){
      const req=(window.KeloService && window.KeloService.query)
        ? window.KeloService.query.getMyRequest(requestId)
        : db.requests.find(r=>r.id===requestId && r.userId===currentUser.id);
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
      if(wizard.formSheetOpen) renderMobileFormSheet();
  }

  global.choosePriceUnit = choosePriceUnit;

  function renderCalendarModal(){
      const existing = document.getElementById('keloCalendarModal');
      if(existing) existing.remove();
      if(!wizard.calendarOpen || !wizard.calendarId) return;
      if(!wizard.formSheetOpen) return;
      const id = wizard.calendarId;
      const multi = wizard.calendarMulti;
      const modal = document.createElement('div');
      modal.id = 'keloCalendarModal';
      modal.className = 'kelo-calendar-modal';
      modal.innerHTML = '<div class="kelo-calendar-modal-backdrop" onclick="closeCalendarModal()"></div><div class="kelo-calendar-modal-box">' + renderJalaliCalendar(id, multi, '') + '</div>';
      document.body.appendChild(modal);
  }

  global.renderCalendarModal = renderCalendarModal;

  function closeCalendarModal(){
      wizard.calendarOpen = false;
      wizard.calendarId = '';
      wizard.calendarRangeStart = null;
      const modal = document.getElementById('keloCalendarModal');
      if(modal) modal.remove();
      if(wizard.formSheetOpen) renderMobileFormSheet();
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
