/**
 * KELO — Profile UI (Phase 13)
 * Profile screens, account sheet, edit, first profile, invoice UI.
 */
(function (global) {
  'use strict';

  function profileMapPickerHtml(placeholderText){
      return '<div class="profile-map-placeholder"><svg viewBox="0 0 24 24"><path d="M12 22s-8-7.5-8-13a8 8 0 1 1 16 0c0 5.5-8 13-8 13z"/><circle cx="12" cy="9" r="3"/></svg><span>'+escapeHtml(placeholderText)+'</span></div>';
  }

  global.profileMapPickerHtml = profileMapPickerHtml;

  function buildProfileFormFields(){
      const p=currentUser.profile||{};
      const provinceCities={
          "مازندران":["آمل","بابل","بابلسر","بهشهر","تنکابن","جویبار","چالوس","رامسر","ساری","سوادکوه","سوادکوه شمالی","سیمرغ","عباس‌آباد","فریدون‌کنار","قائم‌شهر","کلاردشت","گلوگاه","محمودآباد","میاندورود","نکا","نور","نوشهر"],
          "گیلان":["آستانه اشرفیه","آستارا","املش","بندر انزلی","رشت","رضوانشهر","رودبار","رودسر","سیاهکل","شفت","صومعه‌سرا","طوالش","فومن","لاهیجان","لنگرود","ماسال"]
      };
      const profileProvince=p.province||"مازندران";
      const cityOptions=(provinceCities[profileProvince]||[]).map(city=>'<option value="'+city+'" '+(p.city===city?'selected':'')+'>'+city+'</option>').join('');
      return '<div class="form-group"><label>نام کامل <span style="color:red">*</span></label><input id="pName" class="input" required value="'+escapeHtml(currentUser.name||"")+'" placeholder="نام و نام خانوادگی"></div><div class="form-group"><label>استان <span style="color:red">*</span></label><select id="pProvince" class="select" required onchange="updateProfileCities()"><option value="مازندران" '+(profileProvince==='مازندران'?'selected':'')+'>مازندران</option><option value="گیلان" '+(profileProvince==='گیلان'?'selected':'')+'>گیلان</option></select></div><div class="form-group"><label>شهر <span style="color:red">*</span></label><select id="pCity" class="select" required><option value="">انتخاب کنید</option>'+cityOptions+'</select></div><div class="form-group"><label>روستا (اختیاری)</label><input id="pVillage" class="input" value="'+escapeHtml(p.village||"")+'"></div>';
  }

  global.buildProfileFormFields = buildProfileFormFields;

  function updateProfileCities(){
      const province=document.getElementById("pProvince")?.value;
      const citySelect=document.getElementById("pCity");
      if(!citySelect)return;
      const current=citySelect.value;
      const provinceCities={
          "مازندران":["آمل","بابل","بابلسر","بهشهر","تنکابن","جویبار","چالوس","رامسر","ساری","سوادکوه","سوادکوه شمالی","سیمرغ","عباس‌آباد","فریدون‌کنار","قائم‌شهر","کلاردشت","گلوگاه","محمودآباد","میاندورود","نکا","نور","نوشهر"],
          "گیلان":["آستانه اشرفیه","آستارا","املش","بندر انزلی","رشت","رضوانشهر","رودبار","رودسر","سیاهکل","شفت","صومعه‌سرا","طوالش","فومن","لاهیجان","لنگرود","ماسال"]
      };
      citySelect.innerHTML='<option value="">انتخاب کنید</option>'+(provinceCities[province]||[]).map(c=>'<option value="'+escapeHtml(c)+'">'+escapeHtml(c)+'</option>').join('');
      if((provinceCities[province]||[]).includes(current)) citySelect.value=current;
  }

  global.updateProfileCities = updateProfileCities;

  function updateMobileAccountIdentity(){
      const name=(currentUser&&currentUser.name&&currentUser.name.trim())?currentUser.name:'کاربر';
      const phone=currentUser&&currentUser.phone?currentUser.phone:'—';
      const top=document.getElementById('mobileTopbarAvatar'); if(top) top.innerHTML=farmerAvatarSvg();
      const avatar=document.getElementById('mobileAccountAvatar'); if(avatar) avatar.innerHTML=farmerAvatarSvg();
      const n=document.getElementById('mobileAccountName'); if(n) n.textContent=name;
      const ph=document.getElementById('mobileAccountPhone'); if(ph) ph.textContent=toPersianDigits(phone);
  }

  global.updateMobileAccountIdentity = updateMobileAccountIdentity;

  function accountMenuIcon(type){
    const common='fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"';
    const icons={
      activities:'<svg viewBox="0 0 24 24" '+common+'><rect x="4" y="3.5" width="16" height="17" rx="2.5"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',
      deals:'<svg viewBox="0 0 24 24" '+common+'><rect x="4" y="5" width="16" height="13" rx="2"/><path d="M7 9h10M8 14h4"/></svg>',
      profile:'<svg viewBox="0 0 24 24" '+common+'><circle cx="12" cy="8" r="3.2"/><path d="M5.5 20c.8-4 3.1-5.8 6.5-5.8s5.7 1.8 6.5 5.8"/></svg>',
      logout:'<svg viewBox="0 0 24 24" '+common+'><path d="M10 4H6.5A2.5 2.5 0 0 0 4 6.5v11A2.5 2.5 0 0 0 6.5 20H10"/><path d="M13 7l5 5-5 5M18 12H9"/></svg>'
    }; return icons[type]||icons.profile;
  }

  global.accountMenuIcon = accountMenuIcon;

  function mobileAccountMenuMarkup(){ return ''; }

  global.mobileAccountMenuMarkup = mobileAccountMenuMarkup;

  function mobileAccountInnerHeader(title){
      return '<div class="mobile-account-head inner"><button type="button" class="mobile-account-back" onclick="closeMobileAccountSheet()" aria-label="بازگشت">'+KELO_BACK_CHEVRON_SVG+'</button><h2 class="mobile-account-title">'+escapeHtml(title)+'</h2><span></span></div>';
  }

  global.mobileAccountInnerHeader = mobileAccountInnerHeader;

  function mobileAccountProfileMarkup(){
      const name = (currentUser && currentUser.name && currentUser.name.trim()) ? currentUser.name.trim() : 'کاربر';
      const phone = currentUser && currentUser.phone ? toPersianDigits(currentUser.phone) : '—';
      const completedDeals = qdb().deals.filter(d => (d.userId===currentUser.id || d.providerId===currentUser.id) && d.status==='completed').length;
      const rating = getUserRating(currentUser.id);
      const ratingDisplay = rating ? (toPersianDigits(rating.average.toFixed(1)) + ' (' + toPersianDigits(rating.count) + '+)') : '—';

      const headerHtml = '<div class="mobile-account-head inner edit-head">'
          + '<button type="button" class="mobile-account-back" onclick="closeMobileAccountSheet()" aria-label="بازگشت">'+KELO_BACK_CHEVRON_SVG+'</button>'
          + '<h2 class="mobile-account-title">پروفایل</h2>'
          + '<button type="button" class="mobile-account-edit" onclick="openMobileAccountSection(\'edit\')" aria-label="ویرایش">'+KELO_PENCIL_SVG+'</button>'
          + '</div>';

      const bodyHtml = '<div class="mobile-account-body">'
          + '<div class="profile-hero">'
          +   '<div class="profile-avatar" id="mobileProfileAvatar">'+farmerAvatarSvg()+'</div>'
          +   '<h3 class="profile-name">'+escapeHtml(name)+'</h3>'
          +   '<span class="profile-phone">'+phone+'</span>'
          + '</div>'
          + '<h3 class="profile-section-title">آمار</h3>'
          + '<div class="profile-stats">'
          +   '<div class="profile-stat-card"><div class="profile-stat-icon"><svg viewBox="0 0 24 24"><path d="m11 17 2 2a1 1 0 1 0 3-3"/><path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87"/></svg></div><strong>'+toPersianDigits(completedDeals)+'</strong><span>کار انجام‌شده</span></div>'
          +   '<div class="profile-stat-card"><div class="profile-stat-icon"><svg viewBox="0 0 24 24"><path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z"/></svg></div><strong>'+ratingDisplay+'</strong><span>امتیاز</span></div>'
          + '</div>'
          + '<div class="profile-menu-list">'
          +   '<button type="button" class="profile-menu-row" onclick="openMobileAccountSection(\'invoice\')"><span class="profile-menu-icon"><svg viewBox="0 0 24 24"><path d="M6 3h12v18H6z"/><path d="M9 7h6M9 11h6M9 15h4"/></svg></span><span>فاکتور</span><i class="kelo-chevron left"></i></button>'
          +   '<button type="button" class="profile-menu-row" onclick="showToast(\'به‌زودی\',\'info\')"><span class="profile-menu-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></span><span>تنظیمات</span><i class="kelo-chevron left"></i></button>'
          +   '<button type="button" class="profile-menu-row" onclick="showToast(\'به‌زودی\',\'info\')"><span class="profile-menu-icon"><svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></span><span>حریم خصوصی</span><i class="kelo-chevron left"></i></button>'
          +   '<button type="button" class="profile-menu-row" onclick="showToast(\'به‌زودی\',\'info\')"><span class="profile-menu-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 1 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg></span><span>راهنما و پشتیبانی</span><i class="kelo-chevron left"></i></button>'
          +   '<button type="button" class="profile-menu-row" onclick="showToast(\'به‌زودی\',\'info\')"><span class="profile-menu-icon"><svg viewBox="0 0 24 24"><path d="M6 3h9l5 5v13H6z"/><path d="M9 7h4M9 11h6M9 15h6"/></svg></span><span>قوانین و شرایط استفاده</span><i class="kelo-chevron left"></i></button>'
          +   '<button type="button" class="profile-menu-row" onclick="showToast(\'به‌زودی\',\'info\')"><span class="profile-menu-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg></span><span>درباره Kelo</span><i class="kelo-chevron left"></i></button>'
          +   '<button type="button" class="profile-menu-row logout" onclick="closeMobileAccountSheet();logout()"><span class="profile-menu-icon"><svg viewBox="0 0 24 24"><path d="M10 4H6.5A2.5 2.5 0 0 0 4 6.5v11A2.5 2.5 0 0 0 6.5 20H10"/><path d="M13 7l5 5-5 5M18 12H9"/></svg></span><span>خروج از حساب</span></button>'
          + '</div>'
          + '</div>';
      return headerHtml + bodyHtml;
  }

  global.mobileAccountProfileMarkup = mobileAccountProfileMarkup;

  function mobileAccountInvoiceMarkup(){
      // فقط کارهای انجام‌شده (status=completed)
      const completedDeals = (qdb().deals||[]).filter(function(d){
          return isDealForUser(d) && d.status === 'completed';
      }).slice().sort(function(a,b){
          return String(b.completedAt || b.createdAt || '').localeCompare(String(a.completedAt || a.createdAt || ''));
      });

      const totalWorkCount = completedDeals.length;
      const paidByMe = completedDeals
          .filter(function(d){ return String(d.userId) === String(currentUser.id); })
          .reduce(function(sum,d){ return sum + (Number(d.total)||0); }, 0);
      const receivedByMe = completedDeals
          .filter(function(d){ return String(d.providerId) === String(currentUser.id); })
          .reduce(function(sum,d){ return sum + (Number(d.total)||0); }, 0);

      const cards = completedDeals.length ? completedDeals.map(function(d){
          const req = qdb().requests.find(function(r){ return r.id === d.requestId; });
          const isFarmer = String(d.userId) === String(currentUser.id);
          const cp = dealCounterparty(d);
          const cpName = (cp && cp.name) ? cp.name : (d.counterparty || '—');
          const title = dealInvoiceServiceTitle(d, req);
          const machine = (req && req.data && req.data.machineType) ? req.data.machineType
              : (d.providerMachineType || '');
          const areaRaw = (req && req.data && (req.data.area || req.data.amount))
              ? (req.data.area || req.data.amount)
              : (d.requestArea || null);
          const subLine = isFarmer
              ? (machine || '')
              : (areaRaw ? (toPersianDigits(areaRaw) + ' هکتار') : '');
          const total = Number(d.total) || 0;
          const startIso = (req && req.data && (req.data.dateStart || req.data.date))
              || d.dateStart || null;
          const endIso = (req && req.data && req.data.dateEnd) || d.dateEnd || null;
          const dateLabel = formatDealRangeDate(startIso, endIso);
          const myAvg = getMyReviewAverageForDeal(d.id);
          const rateBtn = myAvg != null
              ? '<span class="invoice-rate-done">' + toPersianDigits(myAvg.toFixed(1)) + ' ★</span>'
              : '<button type="button" class="invoice-rate-btn" onclick="event.stopPropagation();openDealReport(\'' + d.id + '\')">ثبت امتیاز</button>';

          return '<div class="mobile-activity-card kelo-service-card invoice-deal-card" onclick="openInvoiceDetail(\'' + d.id + '\')">'
              + '<div class="invoice-card-head">'
              +   '<strong class="invoice-card-title">' + escapeHtml(title) + '</strong>'
              +   rateBtn
              + '</div>'
              + '<div class="invoice-card-name">' + escapeHtml(cpName) + '</div>'
              + (subLine ? '<div class="invoice-card-sub">' + escapeHtml(subLine) + '</div>' : '')
              + '<div class="invoice-card-footer">'
              +   '<span class="invoice-card-amount"><span class="kelo-icon-inline">' + keloCardIcon('price') + '</span>' + escapeHtml(total ? formatMoney(total) : '—') + '</span>'
              +   '<span class="invoice-card-date"><span class="kelo-icon-inline">' + keloCardIcon('date') + '</span>' + escapeHtml(dateLabel) + '</span>'
              + '</div>'
              + '</div>';
      }).join('') : keloEmptyStateHtml('هنوز فاکتوری ندارید', 'پس از اتمام کار، فاکتورهای شما در این بخش نمایش داده می‌شود.');

      const invoiceHeader = '<div class="mobile-account-head inner">'
          + '<button type="button" class="mobile-account-back" onclick="openMobileAccountSection(\'profile\')" aria-label="بازگشت">' + KELO_BACK_CHEVRON_SVG + '</button>'
          + '<h2 class="mobile-account-title">فاکتور</h2><span></span></div>';

      const summary = '<div class="invoice-summary-card">'
          + '<div class="invoice-summary-head"><strong>خلاصه مالی</strong></div>'
          + '<div class="invoice-summary-stats">'
          + '<div><span>' + toPersianDigits(totalWorkCount) + '</span><strong>مجموع کار</strong></div>'
          + '<div><span>' + (paidByMe ? formatMoneyShort(paidByMe) : toPersianDigits(0)) + '</span><strong>پرداختی من</strong></div>'
          + '<div><span>' + (receivedByMe ? formatMoneyShort(receivedByMe) : toPersianDigits(0)) + '</span><strong>دریافتی من</strong></div>'
          + '</div></div>';

      return invoiceHeader + '<div class="mobile-account-body">' + summary + '<h3 class="mobile-account-section-label">صورت‌حساب‌های من</h3>' + cards + '</div>';
  }

  global.mobileAccountInvoiceMarkup = mobileAccountInvoiceMarkup;

  function mobileAccountEditMarkup(){
      const name = currentUser.name || '';
      const phone = currentUser.phone ? toPersianDigits(currentUser.phone) : '';
      const nid = currentUser.nationalId ? toPersianDigits(currentUser.nationalId) : '';
      const loc = currentUser.profileLocation;
      const previewRaw = wizard._pendingProfileLocation || loc;
      const previewLoc = previewRaw && typeof previewRaw.lat === 'number' && typeof previewRaw.lng === 'number'
          ? Object.assign({}, previewRaw, { city: previewRaw.city || nearestCityFromCoords(previewRaw.lat, previewRaw.lng), province: previewRaw.province || provinceFromCity(previewRaw.city || nearestCityFromCoords(previewRaw.lat, previewRaw.lng)) })
          : previewRaw;
      const showPreview = previewLoc && typeof previewLoc.lat === 'number' && typeof previewLoc.lng === 'number';

      const headerHtml = '<div class="mobile-account-head inner">'
          + '<button type="button" class="mobile-account-back" onclick="openMobileAccountSection(\'profile\')" aria-label="بازگشت">'+KELO_BACK_CHEVRON_SVG+'</button>'
          + '<h2 class="mobile-account-title">ویرایش اطلاعات</h2>'
          + '<span></span>'
          + '</div>';

      const mapInner = showPreview
          ? '<div class="profile-map-preview" id="profileMapPreview"></div>'
          : profileMapPickerHtml('انتخاب موقعیت روی نقشه');
      const cityBox = showPreview
          ? '<div class="profile-map-city-box">'+escapeHtml((previewLoc.city||'') + (previewLoc.province ? '، ' + previewLoc.province : ''))+'</div>'
          : '';

      const bodyHtml = '<div class="mobile-account-body">'
          + '<form class="profile-edit-form" novalidate onsubmit="return saveProfileEdit(event)">'
          +   '<div class="profile-avatar-big">'+farmerAvatarSvg()+'</div>'
          +   '<div class="profile-edit-field"><label>نام کامل <span style="color:red">*</span></label><input id="editName" class="profile-pill-input" type="text" value="'+escapeHtml(name)+'" placeholder="نام کامل" autocomplete="name"></div>'
          +   '<div class="profile-edit-field"><label>شماره موبایل <span style="color:red">*</span></label><input id="editPhone" class="profile-pill-input" type="tel" inputmode="numeric" maxlength="11" value="'+escapeHtml(phone)+'" placeholder="شماره موبایل" autocomplete="tel"></div>'
          +   '<div class="profile-edit-field"><label>کد ملی <span style="color:red">*</span></label><input id="editNationalId" class="profile-pill-input" type="text" inputmode="numeric" maxlength="10" value="'+escapeHtml(nid)+'" placeholder="کد ملی" autocomplete="off"></div>'
          +   '<div class="profile-map-wrap">'
          +     '<button type="button" class="profile-map-btn" onclick="activateProfileMapPicker()" aria-label="انتخاب موقعیت">'
          +       mapInner + cityBox
          +     '</button>'
          +   '</div>'
          +   '<button class="profile-save-btn" type="submit">ذخیره</button>'
          + '</form>'
          + '</div>';
      return headerHtml + bodyHtml;
  }

  global.mobileAccountEditMarkup = mobileAccountEditMarkup;

  function renderMobileAccountSection(section){
      const sheet=document.getElementById('mobileAccountSheet'); if(!sheet)return;
      if(section==='menu'){sheet.innerHTML=mobileAccountMenuMarkup();updateMobileAccountIdentity();attachSheetDragOnce(sheet);return;}
      if(section==='profile'){ sheet.innerHTML = mobileAccountProfileMarkup(); attachSheetDragOnce(sheet); return; }
      if(section==='invoice'){ sheet.innerHTML=mobileAccountInvoiceMarkup(); attachSheetDragOnce(sheet); return; }
      if(section==='edit'){
        sheet.innerHTML = mobileAccountEditMarkup();
        requestAnimationFrame(function(){
            if(wizard._pendingProfileLocation || (currentUser.profileLocation && typeof currentUser.profileLocation.lat === 'number')) {
                initializeProfileMapPreview();
            } else {
                autoDetectProfileLocation('edit');
            }
        });
        attachSheetDragOnce(sheet);
        return;
      }
      if(section==='activities'){
        const requests=qdb().requests.filter(r=>r.userId===currentUser.id).map(r=>({...r,__kind:'request'}));
        const listings=qdb().listings.filter(l=>l.userId===currentUser.id).map(l=>({...l,__kind:'listing'}));
        const items=[...requests,...listings].filter(item=>mobileActivityFilterMatches(item,mobileActivityFilter));
        const filters='<div class="mobile-account-filter-row"><button type="button" class="mobile-account-filter '+(mobileActivityFilter==='all'?'active':'')+'" onclick="setMobileActivityFilter(\'all\')">همه</button><button type="button" class="mobile-account-filter '+(mobileActivityFilter==='progress'?'active':'')+'" onclick="setMobileActivityFilter(\'progress\')">در حال انجام</button><button type="button" class="mobile-account-filter '+(mobileActivityFilter==='completed'?'active':'')+'" onclick="setMobileActivityFilter(\'completed\')">تکمیل شده</button></div>';
        const cards=items.length?items.map(item=>{
          const service=item.service;
          const meta=item.__kind==='request' ? requestCityName(item)+' · '+requestDate(item)+(requestAmount(item)?' · '+requestAmount(item):'') : formatActivityArea(item.data.activityArea)+(item.data.price?' · '+formatMoney(item.data.price):'');
          return '<div class="mobile-activity-card"><div class="activity-row"><div class="mobile-activity-main"><strong>'+escapeHtml(serviceName(service))+'</strong><span class="activity-meta">'+escapeHtml(meta)+'</span></div></div></div>';
        }).join(''):keloEmptyStateHtml('چیزی اینجا نیست', 'فعالیت‌های شما اینجا نمایش داده می‌شود.');
        sheet.innerHTML=mobileAccountInnerHeader('فعالیت‌های من')+'<div class="mobile-account-body">'+filters+cards+'</div>';
        attachSheetDragOnce(sheet);
        return;
      }
      if(section==='deals'){
        const receivedOffers=qdb().requestRecipients.filter(o=>o.providerId===currentUser.id && o.status==='pending');
        const myDealsList=qdb().deals.filter(d=>d.userId===currentUser.id || d.providerId===currentUser.id);
        const offersHtml=receivedOffers.length?receivedOffers.map(o=>{ const req=qdb().requests.find(r=>r.id===o.requestId); return '<div class="mobile-activity-card"><div class="activity-row"><div class="mobile-activity-main"><strong>'+escapeHtml(serviceName(req?.service||o.service))+'</strong><span class="activity-meta">'+escapeHtml(requestDate(req||{}))+' · '+(o.total?formatMoney(o.total):'توافقی')+'</span></div><button class="btn btn-primary" style="min-height:40px;padding:6px 12px;font-size:13px" onclick="acceptOffer(\''+o.id+'\')">پذیرش</button></div></div>'; }).join(''):'<p class="text-muted">پیشنهاد جدیدی وجود ندارد.</p>';
        const dealsHtml=myDealsList.length?myDealsList.map(d=>'<div class="mobile-activity-card"><div class="activity-row"><div class="mobile-activity-main"><strong>'+serviceName(d.service)+'</strong><span class="activity-meta">'+escapeHtml(d.counterparty||'—')+' · '+(d.total?formatMoney(d.total):'—')+'</span></div></div></div>').join(''):'<p class="text-muted">هنوز توافقی ثبت نشده است.</p>';
        sheet.innerHTML=mobileAccountInnerHeader('سفارش‌ها و توافق‌ها')+'<div class="mobile-account-body"><h3 class="mobile-account-section-label">درخواست‌های پیشنهادی</h3>'+offersHtml+'<h3 class="mobile-account-section-label" style="margin-top:20px">توافق‌های من</h3>'+dealsHtml+'</div>';
        attachSheetDragOnce(sheet);
      }
  }

  global.renderMobileAccountSection = renderMobileAccountSection;

  function openMobileAccountSection(section){ if(!currentUser || isAdmin(currentUser)) return; renderMobileAccountSection(section); }

  global.openMobileAccountSection = openMobileAccountSection;

  function openMobileProfileFromSheet(){openMobileAccountSection('profile');}

  global.openMobileProfileFromSheet = openMobileProfileFromSheet;

  function backToMobileAccountMenu(){ closeMobileAccountSheet(); }

  global.backToMobileAccountMenu = backToMobileAccountMenu;

  function editMobileProfile(){ renderMobileAccountSection('edit'); }

  global.editMobileProfile = editMobileProfile;

  function initializeProfileMapPreview(){
      const el = document.getElementById('profileMapPreview');
      if(!el || typeof L === 'undefined') return;
      if(window._keloProfileMap){ try{ window._keloProfileMap.remove(); }catch(e){} window._keloProfileMap = null; }
      const loc = wizard._pendingProfileLocation || currentUser.profileLocation;
      if(!loc || typeof loc.lat !== 'number') return;
      const map = createKeloMap(el, { zoomControl:false, attributionControl:false, dragging:false, scrollWheelZoom:false, doubleClickZoom:false, boxZoom:false, touchZoom:false, keyboard:false }, [loc.lat, loc.lng], 14);
      const pinIcon = L.divIcon({ className:'kelo-profile-pin', html:'<div style="width:34px;height:34px;background:#e74c3c;border:3px solid #fff;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 4px 12px rgba(0,0,0,.35);position:relative;"><div style="position:absolute;inset:6px;background:#fff;border-radius:50%;"></div></div>', iconSize:[34,34], iconAnchor:[17,34] });
      L.marker([loc.lat, loc.lng], { icon: pinIcon }).addTo(map);
      window._keloProfileMap = map;
      setTimeout(function(){ try{ map.invalidateSize(); }catch(e){} }, 80);
  }

  global.initializeProfileMapPreview = initializeProfileMapPreview;

  function activateProfileMapPicker(){
      wizard._profileMapMode = 'edit';
      wizard._pendingMapPoint = wizard._pendingProfileLocation ? cloneObject(wizard._pendingProfileLocation) : (currentUser.profileLocation ? cloneObject(currentUser.profileLocation) : null);
      openMobileMapPickerOverlay();
  }

  global.activateProfileMapPicker = activateProfileMapPicker;

  function activateProfileMapPickerForFirst(){
      wizard._profileMapMode = 'first';
      wizard._pendingMapPoint = wizard._pendingProfileLocation ? cloneObject(wizard._pendingProfileLocation) : (currentUser.profileLocation ? cloneObject(currentUser.profileLocation) : null);
      openMobileMapPickerOverlay();
  }

  global.activateProfileMapPickerForFirst = activateProfileMapPickerForFirst;

  function openAccountFromHeader(){ if(!currentUser || isAdmin(currentUser)) return; return openMobileAccountSheet(); }

  global.openAccountFromHeader = openAccountFromHeader;

  function autoDetectProfileLocation(mode){
      if(mode!=='first' && mode!=='edit') return;
      if(wizard._profileAutoGeoRequested) return;
      const existing=wizard._pendingProfileLocation || currentUser?.profileLocation;
      if(existing && typeof existing.lat==='number' && typeof existing.lng==='number') return;
      wizard._profileAutoGeoRequested=true;
      getKeloCurrentPosition(function(pos){
          const lat=Number(pos.coords.latitude), lng=Number(pos.coords.longitude);
          if(!Number.isFinite(lat)||!Number.isFinite(lng)) return;
          const city=nearestCityFromCoords(lat,lng), province=provinceFromCity(city);
          wizard._pendingProfileLocation={lat,lng,city,province,source:'gps'};
          wizard._profileAutoGeoRequested=false;
          if(mode==='first') showCompleteProfile();
          else if(document.getElementById('mobileAccountSheet')) renderMobileAccountSection('edit');
      },function(err){
          // Keep the manual map picker available when automatic detection is denied/unavailable.
          wizard._profileAutoGeoRequested=false;
          console.warn('KELO profile geolocation unavailable:',err);
      });
  }

  global.autoDetectProfileLocation = autoDetectProfileLocation;

  function dealInvoiceServiceTitle(deal, req){
      const service = (req && req.service) || deal.service;
      const base = serviceName(service);
      const data = (req && req.data) || deal.requestData || {};
      let sub = '';
      if(Array.isArray(data.crop) && data.crop.length) sub = data.crop[0];
      else if(typeof data.crop === 'string' && data.crop) sub = data.crop;
      else if(Array.isArray(data.landType) && data.landType.length) sub = data.landType[0];
      else if(typeof data.landType === 'string' && data.landType) sub = data.landType;
      return sub ? (base + ' ' + sub) : base;
  }

  global.dealInvoiceServiceTitle = dealInvoiceServiceTitle;

  function dealInvoiceNumber(deal){
      var s = String(deal && deal.id || '');
      var n = 0;
      for(var i=0;i<s.length;i++) n = ((n * 31) + s.charCodeAt(i)) >>> 0;
      return 1000 + (n % 9000);
  }

  global.dealInvoiceNumber = dealInvoiceNumber;

  function openInvoiceDetail(dealId){
      if(!currentUser) return;
      var d = (qdb().deals || []).find(function(x){ return String(x.id) === String(dealId) && isDealForUser(x); });
      if(!d || d.status !== 'completed'){ showToast('فاکتور پیدا نشد','error'); return; }
      window.__keloInvoiceDetailDealId = String(dealId);
      var req = (qdb().requests || []).find(function(r){ return r.id === d.requestId; });
      var parties = dealPartyNames(d);
      var service = serviceName((req && req.service) || d.service);
      var city = (function(){
          if(req){
              var n = requestCityName(req);
              if(n && n !== '—') return n;
          }
          // برچسب متنی سرور
          if(typeof d.location === 'string' && d.location.trim()) return d.location;
          if(typeof d.requestLocation === 'string' && d.requestLocation.trim()) return d.requestLocation;
          // آبجکت مختصات → نزدیک‌ترین شهر (نه [object Object])
          var loc = d.requestLocation;
          if(loc && typeof loc === 'object'){
              if(typeof loc.label === 'string' && loc.label) return loc.label;
              if(typeof loc.lat === 'number' && typeof loc.lng === 'number'){
                  var cityFromCoords = nearestCityFromCoords(loc.lat, loc.lng);
                  if(cityFromCoords) return cityFromCoords;
              }
          }
          if(d.requestData){
              if(d.requestData.serviceLocationLabel) return d.requestData.serviceLocationLabel;
              if(Array.isArray(d.requestData.activityArea) && d.requestData.activityArea.length){
                  return formatActivityArea(d.requestData.activityArea);
              }
              var sl = d.requestData.serviceLocation;
              if(sl && typeof sl.lat === 'number' && typeof sl.lng === 'number'){
                  var c2 = nearestCityFromCoords(sl.lat, sl.lng);
                  if(c2) return c2;
              }
          }
          return '—';
      })();
      var startIso = (req && req.data && (req.data.dateStart || req.data.date)) || d.dateStart || null;
      var endIso = (req && req.data && req.data.dateEnd) || d.dateEnd || null;
      var workDate = formatDealRangeDate(startIso, endIso);
      var areaRaw = (req && req.data && (req.data.area || req.data.amount)) ? (req.data.area || req.data.amount) : (d.requestArea || null);
      var amountLabel = areaRaw ? (toPersianDigits(areaRaw) + ' هکتار') : '—';
      var total = Number(d.total) || 0;
      var unitPrice = 0;
      if(areaRaw && Number(areaRaw) > 0) unitPrice = Math.round(total / Number(areaRaw));
      else unitPrice = total;
      var commission = keloCommissionAmount(total);
      var issueIso = d.completedAt || d.paidAt || d.createdAt || null;
      var issueDate = issueIso ? humanJalaliDate(issueIso) : '—';
      var invNo = toPersianDigits(dealInvoiceNumber(d));
      var payStatus = (d.paymentStatus === 'paid') ? 'پرداخت شده' : 'پرداخت نشده';
      var payMethod = '—';
      if(d.paymentStatus === 'paid'){
          if(d.paymentMethod === 'online') payMethod = 'آنلاین';
          else payMethod = 'نقدی';
      }
      function row(label, value){
          return '<div class="invoice-detail-row">'
              + '<span class="invoice-detail-label">' + escapeHtml(label) + '</span>'
              + '<span class="invoice-detail-value">' + escapeHtml(value == null || value === '' ? '—' : String(value)) + '</span>'
              + '</div>';
      }

      var body = '<div class="invoice-detail-sheet">'
          + '<div class="invoice-detail-block">'
          + row('شماره فاکتور', invNo)
          + row('تاریخ صدور', issueDate)
          + '</div>'
  + '<div class="invoice-detail-divider"></div>'
          + '<div class="invoice-detail-block">'
          + row('خدمت', service)
          + row('ارائه‌دهنده', parties.providerName)
          + row('دریافت‌کننده', parties.requesterName)
          + row('محل', city || '—')
          + row('تاریخ انجام', workDate)
          + row('مقدار', amountLabel)
          + row('قیمت واحد', unitPrice ? formatMoney(unitPrice) : '—')
          + row('کارمزد کلو', formatMoney(commission))
          + '</div>'
          + '<div class="invoice-detail-divider"></div>'
          + '<div class="invoice-detail-block">'
          + row('مبلغ کل', total ? formatMoney(total) : '—')
          + row('وضعیت کار', 'انجام شده')
          + row('وضعیت پرداخت', payStatus)
          + row('روش پرداخت', payMethod)
          + '</div>'
          + '</div>';

      var host = document.getElementById('mobileAccountSheet');
      if(!host){ showToast('فاکتور در دسترس نیست','error'); return; }
      var inner = host.querySelector('.mobile-sheet') || host;
      inner.innerHTML = '<div class="mobile-account-head inner">'
          + '<button type="button" class="mobile-account-back" onclick="closeInvoiceDetail()" aria-label="بازگشت">' + KELO_BACK_CHEVRON_SVG + '</button>'
          + '<h2 class="mobile-account-title">جزئیات فاکتور</h2><span></span></div>'
          + '<div class="mobile-account-body">' + body + '</div>';
      if(typeof attachSheetDragOnce === 'function') attachSheetDragOnce(inner);
  }

  global.openInvoiceDetail = openInvoiceDetail;

  function closeInvoiceDetail(){
      window.__keloInvoiceDetailDealId = null;
      renderMobileAccountSection('invoice');
  }

  global.closeInvoiceDetail = closeInvoiceDetail;

async function saveFirstProfile(e){
      e.preventDefault();
      if (!currentUser) return;
      const nameEl = document.getElementById('firstProfileName');
      const name = (nameEl ? nameEl.value : '').trim();
      const profile = Object.assign({}, currentUser.profile || {});
      const profileLocation = wizard._pendingProfileLocation ? cloneObject(wizard._pendingProfileLocation) : (currentUser.profileLocation ? cloneObject(currentUser.profileLocation) : null);
      if (profileLocation) {
          if (profileLocation.city) profile.city = profileLocation.city;
          if (profileLocation.province) profile.province = profileLocation.province;
      }

      const profileApi = window.KeloService && window.KeloService.profile;
      if (!profileApi) { showToast('سرویس پروفایل در دسترس نیست.','error'); return; }

      const result = await profileApi.save({
          userId: currentUser.id,
          name: name,
          profile: profile,
          profileLocation: profileLocation,
          profileCompleted: true
      });
      if (!result || !result.ok) {
          showToast((result && result.message) || 'ذخیره اطلاعات انجام نشد.','error');
          return;
      }
      currentUser = upsertAuthenticatedUserMirror(result.data.user);
      if (window.KeloState && window.KeloState.setCurrentUser) window.KeloState.setCurrentUser(currentUser);

      wizard._pendingProfileLocation = null;
      wizard._profileAutoGeoRequested = false;
      const av = document.getElementById('avatar'); if (av) av.innerText = currentUser.name;
      updateMobileAccountIdentity();
      const nav = document.getElementById('mobileBottomNav'); if (nav) nav.classList.remove('hidden');
      const app = document.getElementById('app');
      if (app) app.classList.remove('mobile-tab-profile-edit');
      showToast((result.message) || 'اطلاعات ذخیره شد','success');
      renderApp();
  }

  global.saveFirstProfile = saveFirstProfile;

  async function saveProfile(e){
      e.preventDefault();
      if (!currentUser) return;
      const name = document.getElementById("pName").value.trim();
      const province = document.getElementById("pProvince").value;
      const city = document.getElementById("pCity").value;
      const village = document.getElementById("pVillage").value.trim();
      const profile = { province: province, city: city, village: village || "" };

      const profileApi = window.KeloService && window.KeloService.profile;
      if (!profileApi) { showToast('سرویس پروفایل در دسترس نیست.','error'); return; }

      const result = await profileApi.save({
          userId: currentUser.id,
          name: name,
          profile: profile,
          profileCompleted: true,
          requireCity: true
      });
      if (!result || !result.ok) {
          showToast((result && result.message) || 'ذخیره اطلاعات انجام نشد.','error');
          return;
      }
      currentUser = upsertAuthenticatedUserMirror(result.data.user);
      if (window.KeloState && window.KeloState.setCurrentUser) window.KeloState.setCurrentUser(currentUser);

      const av = document.getElementById("avatar"); if (av) av.innerText = currentUser.name;
      updateMobileAccountIdentity();
      const sheetOpen = document.getElementById('mobileAccountBackdrop') && document.getElementById('mobileAccountBackdrop').classList.contains('open');
      if (sheetOpen) {
          renderMobileAccountSection('profile');
          return;
      }
      const nav = document.getElementById('mobileBottomNav'); if (nav) nav.classList.remove('hidden');
      const app = document.getElementById('app');
      if (app) app.classList.remove('mobile-tab-profile-edit');
      renderApp();
  }

  global.saveProfile = saveProfile;

  async function saveProfileEdit(e){
      if (e) { e.preventDefault(); e.stopPropagation(); }
      if (!currentUser) return false;
      const nameEl = document.getElementById('editName');
      const phoneEl = document.getElementById('editPhone');
      const nidEl = document.getElementById('editNationalId');
      const name = (nameEl ? nameEl.value : '').trim();
      const phoneRaw = (phoneEl ? phoneEl.value : '').trim();
      const nidRaw = (nidEl ? nidEl.value : '').trim();
      if (!name) { showToast('نام کامل را وارد کنید','error'); if (nameEl) nameEl.focus(); return false; }
      if (!phoneRaw) { showToast('شماره موبایل را وارد کنید','error'); if (phoneEl) phoneEl.focus(); return false; }
      if (!nidRaw) { showToast('کد ملی را وارد کنید','error'); if (nidEl) nidEl.focus(); return false; }

      const profile = Object.assign({}, currentUser.profile || {});
      const profileLocation = wizard._pendingProfileLocation ? cloneObject(wizard._pendingProfileLocation) : (currentUser.profileLocation ? cloneObject(currentUser.profileLocation) : null);
      if (profileLocation) {
          if (profileLocation.city) profile.city = profileLocation.city;
          if (profileLocation.province) profile.province = profileLocation.province;
      }

      const profileApi = window.KeloService && window.KeloService.profile;
      if (!profileApi) { showToast('سرویس پروفایل در دسترس نیست.','error'); return; }

      const result = await profileApi.save({
          userId: currentUser.id,
          name: name,
          phone: phoneRaw,
          nationalId: nidRaw,
          profile: profile,
          profileLocation: profileLocation,
          profileCompleted: true,
          allowIdentityChange: true
      });
      if (!result || !result.ok) {
          showToast((result && result.message) || 'ذخیره اطلاعات انجام نشد.','error');
          return;
      }
      currentUser = upsertAuthenticatedUserMirror(result.data.user);
      if (window.KeloState && window.KeloState.setCurrentUser) window.KeloState.setCurrentUser(currentUser);

      const av = document.getElementById('avatar'); if (av) av.innerText = currentUser.name;
      wizard._pendingProfileLocation = null;
      showToast((result.message) || 'اطلاعات ذخیره شد','success');
      renderMobileAccountSection('profile');
  }

  global.saveProfileEdit = saveProfileEdit;

  function showCompleteProfile(){
      document.getElementById("sidebar").innerHTML="";
      // جلوی تب ثبت‌درخواست سفید و ناوبری قبل از تکمیل پروفایل
      try{ sessionStorage.removeItem(TAB_KEY); }catch(e){}
      window.__keloMobileTab = null;
      const appEl = document.getElementById('app');
      if(appEl){
          appEl.classList.remove('mobile-tab-home','mobile-tab-request','mobile-tab-proposals','mobile-tab-request-offers');
          appEl.classList.add('mobile-tab-profile-edit');
      }
      const nav = document.getElementById('mobileBottomNav');
      if(nav) nav.classList.add('hidden');
      updateMobileHeader('تکمیل پروفایل');
      const name = currentUser.name || '';
      const loc = currentUser.profileLocation;
      const previewRaw = wizard._pendingProfileLocation || loc;
      const previewLoc = previewRaw && typeof previewRaw.lat === 'number' && typeof previewRaw.lng === 'number'
          ? Object.assign({}, previewRaw, { city: previewRaw.city || nearestCityFromCoords(previewRaw.lat, previewRaw.lng), province: previewRaw.province || provinceFromCity(previewRaw.city || nearestCityFromCoords(previewRaw.lat, previewRaw.lng)) })
          : previewRaw;
      const showPreview = previewLoc && typeof previewLoc.lat === 'number' && typeof previewLoc.lng === 'number';

      const mapInner = showPreview
          ? '<div class="profile-map-preview" id="profileMapPreview"></div>'
          : profileMapPickerHtml('انتخاب موقعیت روی نقشه (اختیاری)');
      const cityBox = showPreview
          ? '<div class="profile-map-city-box">'+escapeHtml((previewLoc.city||'') + (previewLoc.province ? '، ' + previewLoc.province : ''))+'</div>'
          : '';

      document.getElementById("appContent").innerHTML =
          '<div class="profile-section" style="position:relative;min-height:100%;background:#fff;padding:16px 16px 28px">'
          + '<div class="panel card" style="max-width:100%;margin:0;border:0;box-shadow:none;border-radius:0;padding:12px 4px 8px;position:relative">'
          +   '<div class="panel-title" style="justify-content:center;margin-bottom:18px"><h3 style="margin:0">تکمیل پروفایل</h3></div>'
          +   '<form class="profile-edit-form" onsubmit="saveFirstProfile(event)">'
          +     '<div class="profile-avatar-big">'+farmerAvatarSvg()+'</div>'
          +     '<div class="profile-edit-field"><label>نام و نام خانوادگی <span style="color:red">*</span></label><input id="firstProfileName" class="profile-pill-input" type="text" value="'+escapeHtml(name)+'" placeholder="نام و نام خانوادگی" required></div>'
          +     '<div class="profile-map-wrap">'
          +       '<button type="button" class="profile-map-btn" onclick="activateProfileMapPickerForFirst()" aria-label="انتخاب موقعیت">'
          +         mapInner + cityBox
          +       '</button>'
          +     '</div>'
          +     '<button class="profile-save-btn" type="submit">ذخیره</button>'
          +   '</form>'
          + '</div></div>';

      requestAnimationFrame(function(){
          if(wizard._pendingProfileLocation || (currentUser.profileLocation && typeof currentUser.profileLocation.lat === 'number')) {
              initializeProfileMapPreview();
          }
          // Previously called autoDetectProfileLocation('first') here, which
          // silently requested GPS and auto-revealed the map/chip without the
          // user tapping anything. The cover placeholder should only open when
          // the user explicitly taps it (activateProfileMapPickerForFirst),
          // matching the map field on the "need service" page.
      });
  }

  global.showCompleteProfile = showCompleteProfile;

  function cancelProfileEdit(){
      const nav=document.getElementById('mobileBottomNav'); if(nav) nav.classList.remove('hidden');
      const app=document.getElementById('app');
      if(app) app.classList.remove('mobile-tab-profile-edit');
      const tab = window.__keloMobileTab || 'home';
      if(tab === 'request-offers') setMobileTab('proposals');
      else setMobileTab(tab);
  }

  global.cancelProfileEdit = cancelProfileEdit;


  /**
   * Phase 18 — module facade (idempotent).
   * Handlers remain on window for HTML onclick compatibility.
   */
  var _inited = false;
  global.KeloProfileUI = {
    name: 'Profile',
    init: function () {
      if (_inited) return global.KeloProfileUI;
      _inited = true;
      return global.KeloProfileUI;
    },
    isReady: function () { return _inited; }
  };
  // auto-register handlers already assigned to global above

})(typeof window !== 'undefined' ? window : globalThis);
