/**
 * KELO utils — formatting (Phase 10)
 */
(function (global) {
  'use strict';

  function fmtNum(n){ const num = Number(n) || 0; try { return new Intl.NumberFormat('fa-IR').format(num); } catch(e){ return String(num); } }
  global.fmtNum = fmtNum;

  function toPersianDigits(value){ return String(value??'').replace(/\d/g,d=>'۰۱۲۳۴۵۶۷۸۹'[Number(d)]); }
  global.toPersianDigits = toPersianDigits;

  function escapeHtml(value){ return String(value??'').replace(/[&<>'"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
  global.escapeHtml = escapeHtml;

  function normalizeDigits(value){ return String(value||"").replace(/[۰-۹]/g,d=>String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٠-٩]/g,d=>String("٠١٢٣٤٥٦٧٨٩".indexOf(d))); }
  global.normalizeDigits = normalizeDigits;

function formatMoneyShort(value){
    const n = Number(value) || 0;
    if(n >= 1000000){ const m = n / 1000000; return toPersianDigits(m >= 10 ? Math.round(m) : m.toFixed(1)) + 'م'; }
    if(n >= 1000){ return toPersianDigits(Math.round(n / 1000)) + 'هـ'; }
    return toPersianDigits(n);
}
  global.formatMoneyShort = formatMoneyShort;

function formatMoney(value){ return fmtNum(Number(value)||0)+' تومان'; }
  global.formatMoney = formatMoney;

function getUserRating(userId){
    const reviews = (db.reviews || []).filter(function(r){ return String(r.targetId) === String(userId); });
    if (!reviews.length) return null;
    let total = 0, count = 0;
    reviews.forEach(function(r){
        if (r.ratings) {
            Object.keys(r.ratings).forEach(function(k){ total += Number(r.ratings[k]) || 0; count++; });
        }
    });
    if (!count) return null;
    return { average: total / count, count: reviews.length };
}
  global.getUserRating = getUserRating;

function daysBetween(a, b){ const ms = 86400000; return Math.round((b - a) / ms) + 1; }
  global.daysBetween = daysBetween;

function localDateToIso(date){ const y=date.getFullYear(),m=String(date.getMonth()+1).padStart(2,'0'),d=String(date.getDate()).padStart(2,'0'); return y+'-'+m+'-'+d; }
  global.localDateToIso = localDateToIso;

function isoToLocalDate(iso){ if(!(typeof iso==='string' && /^\d{4}-\d{2}-\d{2}$/.test(iso)))return null; const p=iso.split('-').map(Number); return new Date(p[0],p[1]-1,p[2],12); }
  global.isoToLocalDate = isoToLocalDate;

function parseStoredDate(value){ if(typeof value!=='string')return null; const n=normalizeDigits(value).trim(); if(/^\d{4}-\d{2}-\d{2}T/.test(n))return new Date(n); if(/^\d{4}-\d{2}-\d{2}$/.test(n))return isoToLocalDate(n); const m=n.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/); if(m){ const y=Number(m[1]),mo=Number(m[2]),d=Number(m[3]); if(y>=1300 && y<1600) return jalaliToDate(y,mo,d); } return null; }
  global.parseStoredDate = parseStoredDate;

function keloCommissionAmount(total){
    var t = Number(total) || 0;
    return Math.round(t * 0.13);
}
  global.keloCommissionAmount = keloCommissionAmount;

function rangesOverlap(aStart,aEnd,bStart,bEnd){
    if(!aStart || !aEnd || !bStart || !bEnd) return false;
    return aStart.getTime() <= bEnd.getTime() && bStart.getTime() <= aEnd.getTime();
}
  global.rangesOverlap = rangesOverlap;

function calculateTotal(request,data,fallbackPrice){
    if (window.KeloDomain && window.KeloDomain.pricing && window.KeloDomain.pricing.calculateTotal) {
        // Prefer domain; for day-based pricing use app parseStoredDate via temporary override on data
        return window.KeloDomain.pricing.calculateTotal(request, data, fallbackPrice);
    }
    const price = Number(data && data.price) || Number(fallbackPrice) || 0;
    const unit = String((data && data.priceUnit) || '');
    if(!request) return price;
    const reqData = request.data || {};
    if(unit.includes('هکتار')){
        const area = Number(reqData.area) || Number(reqData.amount) || 0;
        return price * area;
    }
    if(unit.includes('تن')){
        const amount = Number(reqData.amount) || Number(reqData.area) || 0;
        return price * amount;
    }
    if(unit.includes('روز')){
        const start = parseStoredDate(reqData.dateStart || reqData.date);
        const end = parseStoredDate(reqData.dateEnd || reqData.dateStart || reqData.date);
        if(start && end){
            const millisecondsPerDay = 24 * 60 * 60 * 1000;
            const days = Math.floor((end.getTime() - start.getTime()) / millisecondsPerDay) + 1;
            return price * Math.max(days,1);
        }
        return price;
    }
    if(unit.includes('سرویس')){
        return price;
    }
    return price;
}
  global.calculateTotal = calculateTotal;

function roleLabel(r){ return ({farmer:'کشاورز',provider:'ارائه‌دهنده',admin:'مدیر'})[r]||r; }
  global.roleLabel = roleLabel;

function toggleAllCities(province, checked){
    const current=getActivityAreaRows();
    const index=current.findIndex(x=>x.province===province);
    if(checked){ if(index>=0) current[index]={province,cities:[],all:true}; else current.push({province,cities:[],all:true}); }
    else if(index>=0){ current.splice(index,1); }
    wizard.data.activityArea=current; wizard.activityProvince=province; wizard.activityOpen=true; wizard.activitySearch='';
    saveWizardDraftDebounced(); refreshActivityAreaUI();
}
  global.toggleAllCities = toggleAllCities;

function farmerAvatarSvg(){
    const name=(currentUser && currentUser.name && currentUser.name.trim())?currentUser.name.trim():'ک';
    const initial=name.charAt(0);
    const colors=['#78a83f','#d7aa43','#5d9ab2','#8a6fb0','#cf6a4a'];
    const idx=name.length%colors.length;
    return '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;display:block"><defs><linearGradient id="avGrad'+idx+'" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="'+colors[idx]+'"/><stop offset="100%" stop-color="'+colors[(idx+1)%colors.length]+'"/></linearGradient></defs><rect width="100" height="100" fill="url(#avGrad'+idx+')"/><text x="50" y="50" text-anchor="middle" dominant-baseline="central" font-family="Vazirmatn,Tahoma,Arial,sans-serif" font-size="44" font-weight="900" fill="#fff">'+escapeHtml(initial)+'</text></svg>';
}
  global.farmerAvatarSvg = farmerAvatarSvg;

})(typeof window !== 'undefined' ? window : globalThis);
