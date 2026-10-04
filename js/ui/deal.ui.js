/**
 * KELO — Deal UI (Phase 16)
 * Deal list, schedule, reports/reviews, deal helpers.
 */
(function (global) {
  'use strict';

  function getMyDeals(){
      return qdb().deals
          .filter(d=>d.userId===currentUser.id || d.providerId===currentUser.id)
          .slice()
          .sort((a,b)=>String(b.createdAt||b.created||'').localeCompare(String(a.createdAt||a.created||'')));
  }

  global.getMyDeals = getMyDeals;

  function isDealForUser(d){ return !!currentUser && (d.userId===currentUser.id || d.providerId===currentUser.id); }

  global.isDealForUser = isDealForUser;

  function dealEndDate(deal){
      const req=qdb().requests.find(r=>r.id===deal.requestId);
      return req ? (parseStoredDate(req.data?.dateEnd || req.data?.dateStart || req.data?.date) || null) : null;
  }

  global.dealEndDate = dealEndDate;

  function isDealPastEnd(deal){
      const end=dealEndDate(deal); if(!end) return false;
      const now=new Date(); now.setHours(0,0,0,0);
      return end.getTime() <= now.getTime();
  }

  global.isDealPastEnd = isDealPastEnd;

  function dealCounterparty(deal){
      if(!deal || !currentUser) return null;
      const isRequester = String(deal.userId) === String(currentUser.id);
      if(isRequester){
          if(deal.providerName || deal.providerPhone){
              return { name: deal.providerName || '—', phone: deal.providerPhone || '—' };
          }
          const u = qdb().users.find(function(x){ return String(x.id) === String(deal.providerId); });
          return u || null;
      }
      if(deal.requesterName || deal.requesterPhone){
          return { name: deal.requesterName || '—', phone: deal.requesterPhone || '—' };
      }
      const u = qdb().users.find(function(x){ return String(x.id) === String(deal.userId); });
      return u || null;
  }

  global.dealCounterparty = dealCounterparty;

  function renderDealCounterparty(deal, subLine){
      const user = dealCounterparty(deal);
      if(!user) return '';
      const name = user.name || '—';
      const phone = user.phone || '';
      const cpId = String(deal.userId) === String(currentUser.id) ? deal.providerId : deal.userId;
      const rating = getUserRating(cpId);
      let ratingHtml = '';
      if (rating && rating.count > 0) {
          ratingHtml = ' ' + keloRatingBadge(rating.average, rating.count);
      }
      let actionsHtml = '';
      if (phone) {
          const cleanPhone = String(phone).replace(/[^\d]/g, '');
          actionsHtml = '<span style="display:inline-flex;gap:8px;margin-right:auto">'
              + '<a href="tel:' + cleanPhone + '" style="width:40px;height:40px;border-radius:50%;background:#e8f5ec;color:#2b9a5e;display:inline-flex;align-items:center;justify-content:center;text-decoration:none" onclick="event.stopPropagation();"><svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.02-.24 11.36 11.36 0 0 0 3.57.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1 11.36 11.36 0 0 0 .57 3.57 1 1 0 0 1-.24 1.02l-2.2 2.2z"/></svg></a>'
              + '<button type="button" onclick="event.stopPropagation();showToast(\'چت به‌زودی\',\'info\');" style="width:40px;height:40px;border-radius:50%;background:#eef2fb;color:#5b7fd1;display:inline-flex;align-items:center;justify-content:center;border:0;cursor:pointer;padding:0"><svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z"/></svg></button>'
              + '</span>';
      }
      let subHtml = '';
      if (subLine) {
          subHtml = '<span style="font-size:11.5px;color:#8a928d;font-weight:600;line-height:1.5;margin-top:3px;text-align:right;display:block">' + escapeHtml(subLine) + '</span>';
      }
      return '<div style="display:flex;align-items:flex-start;gap:10px">'
          + '<span style="width:30px;height:30px;flex:0 0 30px;border-radius:9px;background:#f3f6ef;color:#6f973d;display:inline-flex;align-items:center;justify-content:center;margin-top:2px">' + keloCardIcon('role') + '</span>'
          + '<span style="display:flex;flex-direction:column;min-width:0;text-align:right;flex:1"><strong style="font-size:14px;color:#1F1F1F;font-weight:800;line-height:1.5">' + escapeHtml(name) + ratingHtml + '</strong>' + subHtml + '</span>'
          + actionsHtml
          + '</div>';
  }

  global.renderDealCounterparty = renderDealCounterparty;

  function openDealProblemReport(dealId){
      const d = qdb().deals.find(function(x){ return String(x.id) === String(dealId); });
      if(!d) return;
      const isFarmer = String(d.userId) === String(currentUser.id);
      const isProvider = String(d.providerId) === String(currentUser.id);
      if(!isFarmer && !isProvider) return;
      if(d.status === 'cancelled') return;
      const el = document.getElementById('keloDealProblem'); if(el) el.remove();
      const farmerReasons = [
          { id: 'no_show', label: 'ارائه‌دهنده در زمان توافق حاضر نشد' },
          { id: 'late', label: 'تأخیر زیاد در شروع یا اتمام کار' },
          { id: 'poor_quality', label: 'کیفیت کار با توافق مطابقت نداشت' },
          { id: 'extra_charge', label: 'درخواست مبلغ بیشتر از توافق' },
          { id: 'damage', label: 'آسیب به محصول، زمین یا تجهیزات' },
          { id: 'behavior', label: 'برخورد نامناسب' },
          { id: 'other', label: 'سایر موارد' }
      ];
      const providerReasons = [
          { id: 'no_payment', label: 'پرداخت انجام نشده یا ناقص است' },
          { id: 'not_ready', label: 'زمین یا محل کار آماده نبود' },
          { id: 'wrong_info', label: 'اطلاعات مساحت، آدرس یا زمان نادرست بود' },
          { id: 'cancelled_late', label: 'لغو یا تغییر ناگهانی از طرف کشاورز' },
          { id: 'access', label: 'عدم دسترسی مناسب به محل کار' },
          { id: 'behavior', label: 'برخورد نامناسب' },
          { id: 'other', label: 'سایر موارد' }
      ];
      const reasons = isFarmer ? farmerReasons : providerReasons;
      let reasonsHtml = '';
      reasons.forEach(function(r, idx){
          reasonsHtml += '<label class="deal-problem-option">'
              + '<input type="radio" name="keloProblemReason" value="' + r.id + '">'
              + '<span>' + escapeHtml(r.label) + '</span></label>';
      });
      const backdrop = document.createElement('div');
      backdrop.id = 'keloDealProblem';
      backdrop.className = 'mobile-sheet-backdrop';
      backdrop.style.zIndex = '5200';
      backdrop.innerHTML = '<div class="mobile-sheet">'
          + '<button type="button" class="mobile-sheet-handle"></button>'
          + '<div class="mobile-sheet-header"><button type="button" class="mobile-sheet-back-btn" onclick="closeDealProblemReport()">' + KELO_BACK_CHEVRON_SVG + '</button><h2>گزارش مشکل</h2><span></span></div>'
          + '<div class="mobile-sheet-body">'
          + '<p class="deal-problem-intro">مشکل پیش‌آمده را انتخاب کنید. تیم پشتیبانی در اسرع وقت بررسی می‌کند.</p>'
          + '<div class="deal-problem-options">' + reasonsHtml + '</div>'
          + '<div class="report-question"><div class="report-question-label">توضیح بیشتر (اختیاری)</div>'
          + '<textarea id="dealProblemNote" class="textarea" rows="3" style="width:100%;box-sizing:border-box;border:1.5px solid #E5E5E5;border-radius:12px;padding:12px;font-family:inherit;font-size:14px" placeholder="در صورت نیاز جزئیات را بنویسید..."></textarea></div>'
          + '</div>'
          + '<div class="mobile-sheet-footer"><button type="button" class="btn btn-brand" onclick="submitDealProblemReport(\'' + d.id + '\')">ثبت گزارش</button></div>'
          + '</div>';
      document.body.appendChild(backdrop);
  }

  global.openDealProblemReport = openDealProblemReport;

  function closeDealProblemReport(){
      const el = document.getElementById('keloDealProblem'); if(el) el.remove();
  }

  global.closeDealProblemReport = closeDealProblemReport;

  function openDealReport(dealId){
      const d=qdb().deals.find(x=>x.id===dealId);
      if(!d) return;
      const isFarmer=String(d.userId)===String(currentUser.id);
      const isProvider=String(d.providerId)===String(currentUser.id);
      if(!isFarmer && !isProvider) return;
      const el=document.getElementById('keloDealReport'); if(el) el.remove();
      const farmerQuestions=[
          {id:'quality',   label:'کیفیت انجام کار'},
          {id:'timing',    label:'وقت‌شناسی و حضور به‌موقع'},
          {id:'skill',     label:'مهارت و تخصص'},
          {id:'price',     label:'تطابق قیمت با توافق'},
          {id:'behavior',  label:'برخورد و رفتار حرفه‌ای'}
      ];
      const providerQuestions=[
          {id:'ready',     label:'آماده بودن زمین و محل کار'},
          {id:'coord',     label:'خوش‌قولی و هماهنگی'},
          {id:'payment',   label:'پرداخت به‌موقع'},
          {id:'respect',   label:'برخورد محترمانه'},
          {id:'accuracy',  label:'دقت در ارائه اطلاعات'}
      ];
      const questions = isFarmer ? farmerQuestions : providerQuestions;
      const reportTitle = isFarmer ? 'ارزیابی ارائه‌دهنده' : 'ارزیابی درخواست‌دهنده';
      const counterpartyName = (function(){
          const u = dealCounterparty(d);
          return u ? (u.name || '') : '';
      })();
      let bodyHtml='';
      if(counterpartyName){
          bodyHtml+='<p style="text-align:center;margin:0 0 18px;color:#5A635C;font-size:14px">نظر شما درباره <strong style="color:#1F1F1F">'+escapeHtml(counterpartyName)+'</strong></p>';
      }
      questions.forEach(function(q){
          let starsHtml='';
          for(let i=1;i<=5;i++){
              starsHtml+='<button type="button" class="report-star" data-q="'+q.id+'" data-val="'+i+'" onclick="setReportStar(\''+q.id+'\','+i+')">★</button>';
          }
          bodyHtml+='<div class="report-question"><div class="report-question-label">'+q.label+'</div><div class="report-stars" data-q="'+q.id+'">'+starsHtml+'</div></div>';
      });
      bodyHtml+='<div class="report-question"><div class="report-question-label">نظر آزاد (اختیاری)</div><textarea id="reportNote" class="textarea" rows="3" style="width:100%;box-sizing:border-box;border:1.5px solid #E5E5E5;border-radius:12px;padding:12px;font-family:inherit;font-size:14px" placeholder="تجربه خود را بنویسید..."></textarea></div>';
      const backdrop=document.createElement('div');
      backdrop.id='keloDealReport';
      backdrop.className='mobile-sheet-backdrop';
      backdrop.style.zIndex = '5200';
      backdrop.innerHTML='<div class="mobile-sheet">'
          +'<button type="button" class="mobile-sheet-handle"></button>'
          +'<div class="mobile-sheet-header"><button type="button" class="mobile-sheet-back-btn" onclick="closeDealReport()">'+KELO_BACK_CHEVRON_SVG+'</button><h2>'+escapeHtml(reportTitle)+'</h2><span></span></div>'
          +'<div class="mobile-sheet-body">'+bodyHtml+'</div>'
          +'<div class="mobile-sheet-footer"><button type="button" class="btn btn-brand" onclick="submitDealReport(\''+d.id+'\')">ثبت گزارش</button></div>'
          +'</div>';
      document.body.appendChild(backdrop);
      window.__keloReportRatings={};
  }

  global.openDealReport = openDealReport;

  function closeDealReport(){
      const el=document.getElementById('keloDealReport'); if(el) el.remove();
      window.__keloReportRatings=null;
  }

  global.closeDealReport = closeDealReport;

  function setReportStar(qId,val){
      if(!window.__keloReportRatings) window.__keloReportRatings={};
      window.__keloReportRatings[qId]=val;
      const container=document.querySelector('.report-stars[data-q="'+qId+'"]');
      if(!container) return;
      const stars=container.querySelectorAll('.report-star');
      stars.forEach(function(s,i){ if(i<val) s.classList.add('active'); else s.classList.remove('active'); });
  }

  global.setReportStar = setReportStar;

  function hasUserReviewedDeal(dealId){
      if (!currentUser) return false;
      return (qdb().reviews || []).some(function(r){
          return String(r.dealId) === String(dealId) && String(r.userId) === String(currentUser.id);
      });
  }

  global.hasUserReviewedDeal = hasUserReviewedDeal;

  function computeDealChip(d){
      if(!d) return { label: '', cls: 'progress' };
      if(d.status === 'cancelled') return { label: 'لغو شده', cls: 'cancelled' };
      const completed = (d.status === 'completed');
      const paid = (d.paymentStatus === 'paid');
      if(completed && paid) return { label: 'تمام شده', cls: 'completed' };
      if(completed && !paid) return { label: 'در انتظار پرداخت', cls: 'pending' };
      if(!completed && paid) return { label: 'پرداخت شده', cls: 'progress' };
      return { label: 'توافق شده', cls: 'progress' };
  }

  global.computeDealChip = computeDealChip;

  function renderMobileDealsList(){
      const deals=getMyDeals();
      if(!deals.length) return keloEmptyStateHtml('توافقی ثبت نشده', 'بعد از پذیرش یک درخواست، توافق شما اینجا نمایش داده می‌شود.');
      return deals.map(d=>{
          const req=qdb().requests.find(r=>r.id===d.requestId);
          const service=req ? req.service : d.service;
          const fakeReq = req || { data: Object.assign({}, d.requestData || {}, { serviceLocation: d.requestLocation }), area_ha: d.requestArea };
          const city = requestCityName(fakeReq);
          let _dateReq = req;
          if (req && req.requestKind === 'provide') {
              _dateReq = (qdb().requests || []).filter(function(r){
                  return r.requestKind === 'need' && r.service === req.service
                    && String(r.userId) === String(d.userId)
                    && r.status !== 'cancelled' && r.status !== 'completed';
              })[0] || req;
          }
          const date = (_dateReq ? requestCardDate(_dateReq) : (d.dateStart ? (d.dateStart===d.dateEnd || !d.dateEnd ? humanJalaliDate(d.dateStart) : humanJalaliDate(d.dateStart)+' تا '+humanJalaliDate(d.dateEnd)) : '—'));
          const isFarmer=String(d.userId)===String(currentUser.id);
          const machine=(req && req.data && req.data.machineType) ? req.data.machineType : (d.providerMachineType || '');
          const area=(req && req.data && (req.data.area || req.data.amount)) ? (req.data.area || req.data.amount) : (fakeReq.area_ha || null);
          const price=(d.total != null && d.total !== undefined) ? formatMoney(d.total) : '—';
          const subLine = isFarmer ? machine : (area ? (toPersianDigits(area) + ' هکتار') : '');
          const _chip = computeDealChip(d);
          const isPaid = (d.paymentStatus === 'paid');
          const isCompleted = (d.status === 'completed');
          let action = '';
          if (d.status === 'cancelled') {
              action = '';
          } else if (isCompleted && isPaid) {
              action = '';
          } else if (isFarmer) {
              if (isPaid) {
                  // Paid but not completed yet — farmer has no actions; chip shows پرداخت شده
                  action = '';
              } else {
                  // Unpaid: always can pay; cancel only if work not completed yet
                  const payBtn = '<button type="button" class="btn btn-brand" onclick="event.stopPropagation();openPaymentOptions(\'' + d.id + '\')">پرداخت</button>';
                  if (isCompleted) {
                      action = '<div class="offer-actions-row single">' + payBtn + '</div>';
                  } else {
                      action = '<div class="offer-actions-row">'
                          + payBtn
                          + '<button type="button" class="btn btn-reject" onclick="event.stopPropagation();cancelDeal(\'' + d.id + '\')">انصراف از کار</button>'
                          + '</div>';
                  }
              }
          } else {
              // Provider
              if (isCompleted) {
                  // Completed but unpaid — provider has no actions; chip shows در انتظار پرداخت
                  action = '';
              } else {
                  const completeBtn = '<button type="button" class="btn btn-brand" onclick="event.stopPropagation();completeDeal(\'' + d.id + '\')">اتمام کار</button>';
                  if (isPaid) {
                      action = '<div class="offer-actions-row single">' + completeBtn + '</div>';
                  } else {
                      action = '<div class="offer-actions-row">'
                          + completeBtn
                          + '<button type="button" class="btn btn-reject" onclick="event.stopPropagation();cancelDeal(\'' + d.id + '\')">انصراف از کار</button>'
                          + '</div>';
                  }
              }
          }
          const locDateLine = '<div style="display:flex;align-items:center;gap:14px;font-size:13px;color:#1F1F1F;font-weight:700;padding:4px 0;flex-wrap:wrap">'
              + '<span style="display:inline-flex;align-items:center;gap:5px"><span class="kelo-icon-inline">' + keloCardIcon('location') + '</span>' + escapeHtml(city) + '</span>'
              + '<span style="display:inline-flex;align-items:center;gap:5px"><span class="kelo-icon-inline">' + keloCardIcon('date') + '</span>' + escapeHtml(date) + '</span>'
              + '</div>';
          const priceLine = '<div class="offer-card-price">' + escapeHtml('قیمت کل: ' + price) + '</div>';
          const problemLink = (d.status === 'cancelled' || (isCompleted && isPaid))
              ? ''
              : '<div class="deal-problem-link-wrap"><span class="deal-problem-link" role="button" tabindex="0" onclick="event.stopPropagation();openDealProblemReport(\'' + d.id + '\')"><span class="deal-problem-icon" aria-hidden="true">!</span>گزارش مشکل</span></div>';
          var _locActive = (window.KeloDomain && window.KeloDomain.location && window.KeloDomain.location.isLocationSharingActive)
              ? window.KeloDomain.location.isLocationSharingActive(d) : (d.status !== 'completed' && d.status !== 'cancelled');
          var _locClick = _locActive
              ? ' role="button" tabindex="0" onclick="openDealLocationMap(\''+escapeHtml(String(d.id))+'\')"'
              : '';
          var _inactive = (d.status === 'cancelled') || (isCompleted && isPaid);
          var _cardStyle = _inactive
              ? 'cursor:default;opacity:.65'
              : (_locActive ? 'cursor:pointer' : 'cursor:default');
          return '<div class="mobile-activity-card kelo-service-card" style="'+_cardStyle+'" data-deal-id="'+escapeHtml(String(d.id))+'"'+_locClick+'>'
              +'<div class="kelo-card-head"><span class="kelo-card-head-icon">'+serviceCardIconSvg(service)+'</span><strong>'+escapeHtml(serviceName(service))+'</strong>'
              +  '<span class="kelo-card-status '+_chip.cls+'">'+_chip.label+'</span></div>'
              +'<div class="kelo-card-info-list">'
              +  renderDealCounterparty(d, subLine)
              +  locDateLine
              +'</div>'
              +priceLine
              +action
              +problemLink
              +'</div>';
      }).join('');
  }

  global.renderMobileDealsList = renderMobileDealsList;

  function collectScheduledItems(){
      if(!currentUser) return [];
      const rows = [];
      qdb().deals.forEach(d => {
          if(d.userId !== currentUser.id && d.providerId !== currentUser.id) return;
          if(d.status === 'cancelled' || d.status === 'completed') return;
          const req = qdb().requests.find(r => String(r.id) === String(d.requestId));
          // Prefer farmer NEED dates (not provider availability window)
          let needReq = req;
          if (req && req.requestKind === 'provide') {
              needReq = (qdb().requests || []).filter(function(r){
                  return r.requestKind === 'need'
                    && r.service === req.service
                    && (String(r.userId) === String(d.userId) || String(r.userId) === String(d.requesterId))
                    && r.status !== 'cancelled' && r.status !== 'completed';
              }).sort(function(a,b){ return new Date(b.createdAt||0) - new Date(a.createdAt||0); })[0] || req;
          }
          let startIso = null;
          let endIso = null;
          if (needReq) {
              startIso = (needReq.data && (needReq.data.dateStart || needReq.data.date)) || needReq.dateStart || null;
              endIso = (needReq.data && needReq.data.dateEnd) || needReq.dateEnd || startIso;
          }
          if (!startIso && d.requestData) {
              startIso = d.requestData.dateStart || d.requestData.date || null;
              endIso = d.requestData.dateEnd || startIso;
          }
          if (!startIso) {
              startIso = d.dateStart || null;
              endIso = d.dateEnd || startIso;
          }
          if(!startIso) return;
          const startDate = parseStoredDate(startIso);
          const endDate = parseStoredDate(endIso) || startDate;
          if(!startDate) return;
          const role = String(d.userId) === String(currentUser.id) ? 'کشاورز' : 'ارائه‌دهنده';
          const counterparty = String(d.userId) === String(currentUser.id)
              ? (d.providerName || d.counterparty || 'ارائه‌دهنده')
              : (d.requesterName || (req && req.requesterName) || 'کشاورز');
          // Prefer request location; for provider calendar, request may be missing in snapshot —
          // fall back to deal.location / requestData / requestLocation from server mapping.
          let city = '';
          if (req && typeof requestCityName === 'function') city = requestCityName(req) || '';
          if (!city && d.location) city = String(d.location);
          if (!city && d.requestData && typeof requestCityName === 'function') {
              city = requestCityName({ data: d.requestData }) || '';
          }
          if (!city && d.requestLocation) {
              const rl = d.requestLocation;
              city = (rl.label || rl.city || rl.province || '') || '';
          }
          const title = dealInvoiceServiceTitle(d, req);
          rows.push({
              dealId: d.id,
              requestId: req ? req.id : d.requestId,
              service: d.service || (req && req.service),
              title: title,
              city: city || '',
              startIso: startIso,
              endIso: endIso,
              start: startDate,
              end: endDate,
              role: role,
              counterparty: counterparty,
              total: d.total || 0
          });
      });
      rows.sort(function(a,b){ return a.start - b.start; });
      return rows;
  }

  global.collectScheduledItems = collectScheduledItems;

  function renderScheduleContent(){
      const items = collectScheduledItems();
      const today = new Date(); today.setHours(0,0,0,0);
      const upcoming = items.filter(function(it){ return it.end >= today; });
      if(!upcoming.length){
          return '<div class="schedule-empty"><div class="schedule-empty-icon"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg></div><h3 class="schedule-empty-title">کاری در پیش نیست</h3><p class="schedule-empty-desc">از این به بعد کاری در تقویم شما ثبت نشده است.</p></div>';
      }
      return upcoming.map(function(it){
          const p = getJalaliParts(it.start);
          const dateLabel = formatDealRangeDate(it.startIso, it.endIso);
          const locLine = it.city
              ? '<div class="schedule-card-line"><span class="kelo-icon-inline">' + keloCardIcon('location') + '</span>' + escapeHtml(it.city) + '</div>'
              : '';
          const dateLine = '<div class="schedule-card-line"><span class="kelo-icon-inline">' + keloCardIcon('date') + '</span>' + escapeHtml(dateLabel) + '</div>';
          return '<div class="schedule-card" role="button" tabindex="0" onclick="openDealFromSchedule(\'' + it.dealId + '\')">'
              + '<div class="schedule-card-date"><strong>' + toPersianDigits(p.day) + '</strong><span>' + JALALI_MONTH_NAMES[p.month-1] + '</span></div>'
              + '<div class="schedule-card-main">'
              +   '<strong>' + escapeHtml(it.title || serviceName(it.service)) + '</strong>'
              +   locLine
              +   dateLine
              + '</div>'
              + '</div>';
      }).join('');
  }

  global.renderScheduleContent = renderScheduleContent;

  function openDealFromSchedule(dealId){
      if(!currentUser || !dealId) return;
      closeMobileAccountSheet();
      setMobileOrdersSubTab('deals');
      setMobileTab('proposals');
      setTimeout(function(){
          var card = document.querySelector('.mobile-orders-body [data-deal-id="' + dealId + '"], [data-deal-id="' + dealId + '"]');
          if(card){
              card.scrollIntoView({ behavior: 'smooth', block: 'center' });
              card.classList.add('kelo-card-highlight');
              setTimeout(function(){ card.classList.remove('kelo-card-highlight'); }, 1800);
          }
      }, 280);
  }

  global.openDealFromSchedule = openDealFromSchedule;

  function openMobileSchedule(){
      if(!currentUser || isAdmin(currentUser)) return;
      const backdrop = document.getElementById('mobileAccountBackdrop');
      const sheet = document.getElementById('mobileAccountSheet');
      if(!backdrop || !sheet) return;
      if(!backdrop._keloBackdropBound){
          backdrop._keloBackdropBound = true;
          backdrop.addEventListener('click', function(e){ if(e.target === backdrop) closeMobileAccountSheet(); });
      }
      backdrop.classList.add('open'); backdrop.setAttribute('aria-hidden','false'); document.body.style.overflow='hidden';
      sheet.innerHTML = '<div class="mobile-account-head inner"><button type="button" class="mobile-account-back" onclick="closeMobileAccountSheet()" aria-label="بازگشت">'+KELO_BACK_CHEVRON_SVG+'</button><h2 class="mobile-account-title">تقویم</h2><span></span></div><div class="mobile-account-body">'+renderScheduleContent()+'</div>';
      attachSheetDragOnce(sheet);
  }

  global.openMobileSchedule = openMobileSchedule;

  function formatDealRangeDate(startIso, endIso){
      if(!startIso && !endIso) return '—';
      if(!endIso || String(endIso) === String(startIso)) return humanJalaliDate(startIso || endIso);
      const s = parseStoredDate(startIso);
      const e = parseStoredDate(endIso);
      if(!s || !e) return humanJalaliDate(startIso);
      const diffDays = Math.round((e.getTime() - s.getTime()) / 86400000);
      const sp = getJalaliParts(s);
      const ep = getJalaliParts(e);
      if(diffDays <= 0) return humanJalaliDate(startIso);
      if(diffDays === 1 && sp.month === ep.month && sp.year === ep.year){
          return toPersianDigits(sp.day)+' و '+toPersianDigits(ep.day)+' '+JALALI_MONTH_NAMES[sp.month-1]+' '+toPersianDigits(sp.year);
      }
      if(sp.month === ep.month && sp.year === ep.year){
          return toPersianDigits(sp.day)+' تا '+toPersianDigits(ep.day)+' '+JALALI_MONTH_NAMES[sp.month-1]+' '+toPersianDigits(sp.year);
      }
      return humanJalaliDate(startIso)+' تا '+humanJalaliDate(endIso);
  }

  global.formatDealRangeDate = formatDealRangeDate;

  function getMyReviewAverageForDeal(dealId){
      if(!currentUser) return null;
      var rev = (qdb().reviews || []).find(function(r){
          return String(r.dealId) === String(dealId) && String(r.userId) === String(currentUser.id);
      });
      if(!rev || !rev.ratings) return null;
      var vals = Object.keys(rev.ratings).map(function(k){ return Number(rev.ratings[k]) || 0; }).filter(function(n){ return n > 0; });
      if(!vals.length) return null;
      return vals.reduce(function(a,b){ return a + b; }, 0) / vals.length;
  }

  global.getMyReviewAverageForDeal = getMyReviewAverageForDeal;

  function dealPartyNames(deal){
      var providerName = deal.providerName || '';
      var requesterName = deal.requesterName || '';
      if(!providerName){
          var pu = (qdb().users || []).find(function(x){ return String(x.id) === String(deal.providerId); });
          providerName = pu ? (pu.name || '—') : '—';
      }
      if(!requesterName){
          var ru = (qdb().users || []).find(function(x){ return String(x.id) === String(deal.userId); });
          requesterName = ru ? (ru.name || '—') : '—';
      }
      return { providerName: providerName || '—', requesterName: requesterName || '—' };
  }

  global.dealPartyNames = dealPartyNames;

  function routeToDeal(dealId){
      const d=qdb().deals.find(x=>x.id===dealId && x.providerId===currentUser.id);
      if(!d) return;
      const req=qdb().requests.find(r=>r.id===d.requestId);
      if(!req){ showToast('درخواست پیدا نشد','error'); return; }
      openRequestLocationMap(req.id);
  }

  global.routeToDeal = routeToDeal;

  function calculateTotalForDeal(deal){ return Number(deal?.total)||0; }

  global.calculateTotalForDeal = calculateTotalForDeal;

  function getBackendUserPayload(extra){
      const e = extra || {};
      return {
          name: e.name !== undefined ? e.name : (currentUser ? currentUser.name : ''),
          phone: e.phone !== undefined ? e.phone : (currentUser ? currentUser.phone : ''),
          nationalId: e.nationalId !== undefined ? e.nationalId : (currentUser ? currentUser.nationalId : ''),
          profileCompleted: e.profileCompleted !== undefined ? !!e.profileCompleted : !!(currentUser && currentUser.profileCompleted),
          profile: cloneObject(e.profile !== undefined ? e.profile : ((currentUser && currentUser.profile) || {})),
          profileLocation: e.profileLocation !== undefined ? cloneObject(e.profileLocation) : (currentUser && currentUser.profileLocation ? cloneObject(currentUser.profileLocation) : null)
      };
  }

  global.getBackendUserPayload = getBackendUserPayload;

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


  /**
   * Phase 18 — module facade (idempotent).
   * Handlers remain on window for HTML onclick compatibility.
   */
  var _inited = false;

  function closeDealLocationMap(){
      try {
          if (window.KeloLocationService) window.KeloLocationService.stopAll();
      } catch (e) {}
      if (window._keloDealLocMap) {
          try { window._keloDealLocMap.remove(); } catch (e) {}
          window._keloDealLocMap = null;
      }
      window._keloDealLocProviderMarker = null;
      var sheet = document.getElementById('keloDealLocationSheet');
      if (sheet) sheet.remove();
      document.body.style.overflow = '';
  }
  global.closeDealLocationMap = closeDealLocationMap;

  function openDealLocationMap(dealId){
      if (!currentUser || !dealId) return;
      var d = (qdb().deals || []).find(function(x){ return String(x.id) === String(dealId); });
      if (!d) { showToast('توافق پیدا نشد', 'error'); return; }

      var Loc = window.KeloDomain && window.KeloDomain.location;
      var active = Loc && Loc.isLocationSharingActive ? Loc.isLocationSharingActive(d) : (d.status !== 'completed' && d.status !== 'cancelled');
      if (!active) {
          showToast('اشتراک موقعیت فقط در توافق فعال در دسترس است', 'error');
          return;
      }

      closeDealLocationMap();

      var dest = Loc && Loc.getFarmerDestination
          ? Loc.getFarmerDestination(d, qdb().requests || [])
          : null;
      var isProvider = Loc && Loc.isProvider
          ? Loc.isProvider(d, currentUser.id)
          : String(d.providerId) === String(currentUser.id);

      var navBtn = (isProvider && dest)
          ? '<button type="button" class="btn btn-brand" id="keloDealNavBtn" style="width:100%;margin-top:8px">مسیریابی تا محل کشاورز</button>'
          : '';
      var hint = isProvider
          ? 'موقعیت شما هر ۱۵ ثانیه به‌روز می‌شود تا وقتی این نقشه باز است.'
          : 'موقعیت ماشین‌دار وقتی نقشه را باز نگه دارد به‌روز می‌شود.';

      var sheet = document.createElement('div');
      sheet.id = 'keloDealLocationSheet';
      sheet.className = 'mobile-sheet-backdrop open';
      sheet.innerHTML =
          '<div class="mobile-sheet" style="height:88vh;max-height:88vh;display:flex;flex-direction:column">' +
          '<button type="button" class="mobile-sheet-handle"></button>' +
          '<div class="mobile-sheet-header">' +
          '<button type="button" class="mobile-sheet-back-btn" onclick="closeDealLocationMap()" aria-label="بازگشت">' +
          (typeof KELO_BACK_CHEVRON_SVG !== 'undefined' ? KELO_BACK_CHEVRON_SVG : '←') +
          '</button>' +
          '<h2 style="margin:0;font-size:16px;font-weight:800">موقعیت توافق</h2><span></span></div>' +
          '<div id="keloDealLocMap" style="flex:1;min-height:220px;background:#dfe7cc"></div>' +
          '<div style="padding:12px 16px 20px;border-top:1px solid rgba(0,0,0,.06)">' +
          '<div id="keloDealLocStatus" style="font-size:12px;color:#666;margin-bottom:6px;line-height:1.5">' + hint + '</div>' +
          navBtn +
          '</div></div>';
      document.body.appendChild(sheet);
      document.body.style.overflow = 'hidden';
      sheet.addEventListener('click', function(e){ if (e.target === sheet) closeDealLocationMap(); });

      requestAnimationFrame(function(){
          var el = document.getElementById('keloDealLocMap');
          if (!el || typeof L === 'undefined' || typeof createKeloMap !== 'function') {
              if (el) el.innerHTML = '<div style="padding:24px;text-align:center">نقشه در دسترس نیست</div>';
              return;
          }
          var center = dest ? [dest.lat, dest.lng] : [36.5659, 53.0586];
          var map = createKeloMap(el, { zoomControl: false, attributionControl: false }, center, dest ? 13 : 9);
          window._keloDealLocMap = map;

          if (dest) {
              L.circleMarker([dest.lat, dest.lng], {
                  radius: 9, color: '#fff', weight: 2, fillColor: '#78a83f', fillOpacity: 1
              }).addTo(map).bindPopup('<div class="map-card-popup"><strong>محل کشاورز</strong></div>');
          }

          var providerMarker = null;
          function upsertProviderMarker(lat, lng) {
              if (typeof lat !== 'number' || typeof lng !== 'number') return;
              if (providerMarker) {
                  providerMarker.setLatLng([lat, lng]);
              } else {
                  providerMarker = L.circleMarker([lat, lng], {
                      radius: 8, color: '#fff', weight: 2, fillColor: '#c4a035', fillOpacity: 1
                  }).addTo(map).bindPopup('<div class="map-card-popup"><strong>ماشین‌دار</strong></div>');
                  window._keloDealLocProviderMarker = providerMarker;
              }
              try {
                  if (dest) {
                      map.fitBounds(L.latLngBounds([[dest.lat, dest.lng], [lat, lng]]).pad(0.35));
                  } else {
                      map.setView([lat, lng], 14);
                  }
              } catch (e) {}
          }

          var statusEl = document.getElementById('keloDealLocStatus');
          function setStatus(msg) {
              if (statusEl) statusEl.textContent = msg;
          }

          if (window.KeloLocationService) {
              if (isProvider) {
                  window.KeloLocationService.startSharingLocation(dealId);
                  if (navigator.geolocation) {
                      navigator.geolocation.getCurrentPosition(function(pos){
                          upsertProviderMarker(pos.coords.latitude, pos.coords.longitude);
                      }, function(){}, { enableHighAccuracy: true, timeout: 15000 });
                  }
              }
              window.KeloLocationService.startPollingCounterpartyLocation(dealId, function(loc){
                  if (!loc) return;
                  upsertProviderMarker(Number(loc.lat), Number(loc.lng));
                  var age = loc.updatedAt ? Math.round((Date.now() - new Date(loc.updatedAt).getTime()) / 1000) : null;
                  if (age != null && age >= 0) {
                      setStatus('آخرین به‌روزرسانی: ' + (typeof toPersianDigits === 'function' ? toPersianDigits(age) : age) + ' ثانیه پیش');
                  }
              });
          }

          var nav = document.getElementById('keloDealNavBtn');
          if (nav && dest) {
              nav.addEventListener('click', function(){
                  if (window.KeloNavigationService && window.KeloNavigationService.openNavigationTo) {
                      window.KeloNavigationService.openNavigationTo(dest.lat, dest.lng, dest.label || 'محل کشاورز');
                  } else if (typeof openNavigationTo === 'function') {
                      openNavigationTo(dest.lat, dest.lng, dest.label || 'محل کشاورز');
                  }
              });
          }

          setTimeout(function(){ try { map.invalidateSize(true); } catch (e) {} }, 200);
      });
  }
  global.openDealLocationMap = openDealLocationMap;


  global.KeloDealUI = {
    name: 'Deal',
    init: function () {
      if (_inited) return global.KeloDealUI;
      _inited = true;
      return global.KeloDealUI;
    },
    isReady: function () { return _inited; }
  };
  // auto-register handlers already assigned to global above

})(typeof window !== 'undefined' ? window : globalThis);
