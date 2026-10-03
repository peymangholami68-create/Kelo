(function(){
    function syncViewport(){
        var w = window.innerWidth;
        var v = w < 768 ? 'mobile' : w < 1200 ? 'tablet' : 'desktop';
        document.documentElement.setAttribute('data-viewport', v);
    }
    syncViewport();
    var raf;
    window.addEventListener('resize', function(){ cancelAnimationFrame(raf); raf = requestAnimationFrame(syncViewport); });
})();

/**
 * KELO app.js — Phase 18
 *
 * Shared state + shell render + DB helpers.
 * Application entry is KeloApp.init() in js/app/kelo-app.js (loads last).
 *
 * UI → KeloService → Domain → Adapter → Data
 */



var KELO_BACK_CHEVRON_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>';
var KELO_PENCIL_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';





function toggleFaq(button){
    const faqItem = button.parentElement;
    const isActive = faqItem.classList.contains('active');
    document.querySelectorAll('.faq-item').forEach(item => { item.classList.remove('active'); const b=item.querySelector('button'); if(b) b.setAttribute('aria-expanded','false'); });
    if(!isActive){ faqItem.classList.add('active'); button.setAttribute('aria-expanded','true'); }
}
function showFieldError(fieldId, message){
    clearFieldError(fieldId);
    const wrapper = document.querySelector('[data-field-wrapper="' + fieldId + '"]');
    if(!wrapper){ showToast(message,'error'); return false; }
    wrapper.classList.add('has-error');
    const err = document.createElement('div');
    err.className = 'field-error';
    err.setAttribute('data-error-for', fieldId);
    err.textContent = message;
    wrapper.appendChild(err);
    try{ wrapper.scrollIntoView({behavior:'smooth', block:'center'}); }catch(e){}
    return true;
}
function clearFieldError(fieldId){
    const wrapper = document.querySelector('[data-field-wrapper="' + fieldId + '"]');
    if(!wrapper) return;
    wrapper.classList.remove('has-error');
    const err = wrapper.querySelector('.field-error');
    if(err) err.remove();
}
function clearFieldErrors(){
    document.querySelectorAll('.field-error').forEach(function(e){ e.remove(); });
    document.querySelectorAll('.has-error').forEach(function(e){ e.classList.remove('has-error'); });
}
const DRAFT_PREFIX = 'kelo_wizard_draft_';
const SESSION_KEY = 'kelo_session_user_id';
const TAB_KEY = 'kelo_session_tab';
let _draftSaveTimer = null;






const defaultDB = {
    users:[
        {id:"u1", name:"کاربر نمونه", phone:"09120000001", nationalId:"0012345678", profileCompleted:true, profile:{province:"مازندران", city:"ساری", village:""}},
        {id:"u2", name:"محمد احمدی", phone:"09120000002", nationalId:"0023456789", profileCompleted:true, profile:{province:"مازندران", city:"جویبار", village:""}},
        {id:"admin", name:"مدیر KELO", phone:"09120000003", nationalId:"0034567890", systemRoles:["admin"], profileCompleted:true, profile:{}}
    ],
    machines:[
        {id:"m1", owner:"محمد احمدی", type:"کمباین برنج", location:"جویبار", rating:4.8, jobs:24, services:{harvest:8500000}},
        {id:"m2", owner:"محمد احمدی", type:"تراکتور", location:"ساری", rating:4.6, jobs:18, services:{tractor:3000000}},
        {id:"m3", owner:"محمد احمدی", type:"نشاکار", location:"قائم‌شهر", rating:4.4, jobs:12, services:{transplant:4500000}}
    ],
    requests:[], offers:[], listings:[], requestRecipients:[], bookings:[], deals:[], payments:[]
};
const DB_VERSION = 39;

const RECEIVE_FIELDS = [
    ["area","مساحت زمین","areaSlider",{min:0.5,max:50,step:0.5,unit:"هکتار",default:2},true],
    ["dateStart","تاریخ شروع","jalaliDate","",true],
    ["dateEnd","تاریخ پایان","jalaliDate","",false],
    ["note","توضیحات","textarea","توضیحات تکمیلی...",false],
    ["serviceLocation","محل انجام خدمت","mapLocation","",true]
];
const PROVIDE_FIELDS = [
    ["activityArea","محدوده فعالیت این خدمت","activityArea","",true],
    ["machineType","نوع ماشین آلات","text","مثلاً کمباین کلاس لکسیون ۶۳۰",true],
    ["capacity","ظرفیت / مشخصه","text","مثلاً ۴ تن در ساعت",false],
    ["price","قیمت","number","مثلاً 3000000",true],
    ["priceUnit","واحد قیمت","select",["تومان / هکتار","تومان / روز","تومان / سرویس"],true],
    ["dateStart","از تاریخ","jalaliDate","",true],
    ["dateEnd","تا تاریخ","jalaliDate","",false],
    ["note","توضیحات","textarea","توضیحات تکمیلی...",false],
    ["images","تصاویر","file","",false]
];

const SERVICE_DEFS = {
    tractor:  { name:"شخم و دیسک", desc:"آماده‌سازی زمین برای کاشت", receive:RECEIVE_FIELDS, provide:PROVIDE_FIELDS },
    planting: { name:"کاشت",       desc:"بذرپاشی، ردیف‌کاری و نشاکاری", receive:RECEIVE_FIELDS, provide:PROVIDE_FIELDS },
    spray:    { name:"سمپاشی",     desc:"مبارزه با آفات، بیماری‌ها و علف‌های هرز", receive:RECEIVE_FIELDS, provide:PROVIDE_FIELDS },
    harvest:  { name:"برداشت",     desc:"برداشت محصولات با ماشین‌آلات", receive:RECEIVE_FIELDS, provide:PROVIDE_FIELDS }
};

const SERVICE_L3_FIELDS = {
    tractor:  [{ id:'landType', label:'', options:['زمین زراعی','زمین باغی'], multi:true, required:true }],
    planting: [{ id:'crop', label:'', options:['برنج','گندم','سایر'], multi:true, required:true }],
    spray:    [{ id:'crop', label:'', options:['برنج','گندم','مرکبات','سایر'], multi:true, required:true }],
    harvest:  [{ id:'crop', label:'', options:['برنج','گندم','سایر'], multi:true, required:true }]
};



function cloneObject(obj){ return JSON.parse(JSON.stringify(obj)); }
function cloneDefaultDB(){ return cloneObject(defaultDB); }
function initializeDB(){
    let stored=null;
    try{ stored=JSON.parse(localStorage.getItem("kelo_db")); }catch(e){ stored=null; }
    const base=stored && typeof stored==="object" ? stored : cloneDefaultDB();
    base.users=Array.isArray(base.users)?base.users:[];
    base.machines=Array.isArray(base.machines)?base.machines:[];
    base.requests=Array.isArray(base.requests)?base.requests:[];
    base.offers=Array.isArray(base.offers)?base.offers:[];
    base.listings=Array.isArray(base.listings)?base.listings:[];
    base.requestRecipients=Array.isArray(base.requestRecipients)?base.requestRecipients:[];
    base.bookings=Array.isArray(base.bookings)?base.bookings:[];
    base.deals=Array.isArray(base.deals)?base.deals:[];
    base.payments=Array.isArray(base.payments)?base.payments:[];
    base.users.forEach(u=>{
        // Commercial roles are transaction/context data, not account roles.
        if(Array.isArray(u.roles)){
            const sys = u.roles.filter(r => ['admin','support','superadmin'].includes(r));
            if(sys.length) u.systemRoles = Array.from(new Set([...(u.systemRoles||[]), ...sys]));
            delete u.roles;
        }
        if(u.role && ['admin','support','superadmin'].includes(u.role)){
            u.systemRoles = Array.from(new Set([...(u.systemRoles||[]), u.role]));
        }
        delete u.role;
        if(!Array.isArray(u.systemRoles)) u.systemRoles=[];
        if(!u.profile) u.profile={};
        if(u.profileCompleted===undefined) u.profileCompleted=!!u.name;
    });
    defaultDB.users.forEach(demo=>{
        const existing=base.users.find(u=>u.id===demo.id);
        if(existing){
            existing.name=demo.name; existing.phone=demo.phone; existing.nationalId=demo.nationalId;
            if(demo.systemRoles) existing.systemRoles=cloneObject(demo.systemRoles);
            delete existing.roles; delete existing.role;
            if(!existing.profile) existing.profile=cloneObject(demo.profile||{});
        }
        else base.users.push(cloneObject(demo));
    });
    if(Number(stored?stored._version:0) < 39 && Array.isArray(base.offers)){
        base.offers.forEach(o=>{ if(o.status==='pending') o.status='legacy'; });
    }
    base._version=DB_VERSION;
    try{ localStorage.setItem("kelo_db",JSON.stringify(base)); }
    catch(e){ console.error('KELO initializeDB save failed:', e); }
    return base;
}
let db=initializeDB();
/* Phase 18 fix: data layer reads window.db — must be the same object */
window.db = db;
/* Phase 11: currentUser via window.KeloState bridge */
if (window.KeloState && window.KeloState.installWindowBridge) window.KeloState.installWindowBridge();




function applyServerSnapshot(snapshot){
    if(!snapshot) return;
    const data=snapshot.data||snapshot;
    ['requests','listings','requestRecipients','bookings','deals','payments','machines'].forEach(function(k){
        if(Array.isArray(data[k])) db[k]=cloneObject(data[k]);
    });
    // Marketplace data is authoritative on the server. Keep localStorage only
    // as a harmless UI/draft cache; never treat it as the production database.
    if (Array.isArray(data.reviews)) {
        db.reviews = cloneObject(data.reviews);
    } else {
        try {
            const savedReviews = JSON.parse(localStorage.getItem('kelo_reviews') || '[]');
            if (Array.isArray(savedReviews)) db.reviews = savedReviews;
        } catch(e) { db.reviews = db.reviews || []; }
    }
    db._serverSyncedAt=Date.now();
}
async function refreshServerSnapshot(render){
    if (window.KeloSync && typeof window.KeloSync.bootstrapSnapshot === 'function') {
        const result = await window.KeloSync.bootstrapSnapshot();
        if (!result) return;
        applyServerSnapshot(result);
    } else {
        if (!(window.KeloService && window.KeloService.mode && window.KeloService.mode() === 'server')) return;
        const result = await window.KeloBackend.bootstrap();
        applyServerSnapshot(result);
    }
    // اگر پروفایل کامل نیست، renderApp صفحه تکمیل پروفایل را پاک نکند
    if (render && currentUser && currentUser.profileCompleted) renderApp();
}






/* Phase 14 fix: wizard lives on window; full init after request.ui loads makeEmptyWizard */
(function () {
  var _wizard = {
    type: null,
    service: null,
    data: {},
    formSheetOpen: false,
    servicePickerOpen: false,
    mapPickMode: false,
    calendarOpen: false,
    calendarId: null,
    servicePickerTemp: null,
    servicePickerExpanded: null,
    servicePickerSearch: '',
    _pendingProfileLocation: null,
    _pendingMapPoint: null
  };
  try {
    Object.defineProperty(window, 'wizard', {
      configurable: true,
      enumerable: true,
      get: function () { return _wizard; },
      set: function (v) { if (v) _wizard = v; }
    });
  } catch (e) {
    window.wizard = _wizard;
  }
})();
let mapContext=null;
let authMode="public";
let mobileRequestSuccess = false;
let mobileSuccessData = null;
function saveDB(){
    db._version=DB_VERSION;
    try{
        localStorage.setItem("kelo_db",JSON.stringify(db));
        return true;
    }catch(e){
        console.error('KELO saveDB failed:', e);
        showToast && showToast('ذخیره اطلاعات انجام نشد. فضای ذخیره‌سازی مرورگر کافی نیست.','error');
        return false;
    }
}








function ensureSystemRoles(user){ if(!user) return []; if(!Array.isArray(user.systemRoles)) user.systemRoles=[]; return user.systemRoles; }


let mobileAccountView='menu';


let mobileActivityFilter='all';
























function renderApp(){
    if(currentUser && !currentUser.profileCompleted && !isAdmin(currentUser)){
        showCompleteProfile();
        return;
    }
    document.getElementById("avatar").innerText=(currentUser.name && currentUser.name.trim())?currentUser.name:"کاربر";
    updateMobileAccountIdentity();
    if(isAdmin(currentUser)) renderAdmin(); else renderUser();
}

function renderUser(){
    if(currentUser && !currentUser.profileCompleted){ showCompleteProfile(); return; }
    setMobileTab(window.__keloMobileTab||'home');
}

function onMobilePlusClick(){
    sessionStorage.removeItem('kelo_mobile_success');
    mobileRequestSuccess = false; mobileSuccessData = null;
    clearWizardDraft();
    resetMobileWizardFlow();
    setMobileTab('request');
}

function renderMobileHome(){
    const c=document.getElementById('appContent');
    c.className='content';
    const banners = [
        { src: 'https://cdn.imgurl.ir/uploads/u42901_b._farmer.jpg', alt: 'کشاورز' },
        { src: 'https://cdn.imgurl.ir/uploads/x229369_b._machindar.jpg', alt: 'ماشین‌دار' },
        { src: 'https://cdn.imgurl.ir/uploads/b97617_B._online.jpg', alt: 'آنلاین' }
    ];
    const nB = banners.length;
    const slidePct = (100 / nB).toFixed(6);
    const slides = banners.map(function(b, i){
        return '<div class="home-banner-slide' + (i === 0 ? ' is-active' : '') + '" data-index="' + i + '" style="flex:0 0 ' + slidePct + '%;width:' + slidePct + '%;max-width:' + slidePct + '%">'
            + '<img src="' + b.src + '" alt="' + b.alt + '" loading="' + (i === 0 ? 'eager' : 'lazy') + '"'
            + ' onerror="this.style.background=\'linear-gradient(135deg,#9dc457,#d4b75c)\';this.removeAttribute(\'src\')">'
            + '</div>';
    }).join('');
    const dots = banners.map(function(_, i){
        return '<button type="button" class="home-banner-dot' + (i === 0 ? ' is-active' : '') + '" data-index="' + i + '" aria-label="بنر ' + (i + 1) + '"></button>';
    }).join('');
    const n = banners.length;
    c.innerHTML = '<div class="mobile-home-page">'
        + '<div class="home-banner-slider" id="homeBannerSlider">'
        +   '<div class="home-banner-viewport">'
        +     '<div class="home-banner-track" id="homeBannerTrack" style="width:' + (n * 100) + '%">' + slides + '</div>'
        +   '</div>'
        +   '<div class="home-banner-dots" id="homeBannerDots">' + dots + '</div>'
        + '</div>'
        + '</div>';
    initHomeBannerSlider();
}

function initHomeBannerSlider(){
    const track = document.getElementById('homeBannerTrack');
    const dotsWrap = document.getElementById('homeBannerDots');
    if (!track || !dotsWrap) return;
    if (window._homeBannerTimer) {
        clearInterval(window._homeBannerTimer);
        window._homeBannerTimer = null;
    }
    const slides = Array.prototype.slice.call(track.querySelectorAll('.home-banner-slide'));
    const dots = Array.prototype.slice.call(dotsWrap.querySelectorAll('.home-banner-dot'));
    if (!slides.length) return;
    let index = 0;
    let touchStartX = null;

    function goTo(i){
        index = (i + slides.length) % slides.length;
        slides.forEach(function(s, n){ s.classList.toggle('is-active', n === index); });
        dots.forEach(function(d, n){ d.classList.toggle('is-active', n === index); });
        // Track is 300% wide (3 slides); move by one-third per slide
        var step = 100 / slides.length;
        track.style.transform = 'translateX(' + (-index * step) + '%)';
    }

    dots.forEach(function(dot){
        dot.addEventListener('click', function(){
            const i = Number(dot.getAttribute('data-index') || 0);
            goTo(i);
            restart();
        });
    });

    const viewport = track.parentElement;
    if (viewport) {
        viewport.addEventListener('touchstart', function(e){
            if (!e.touches || !e.touches[0]) return;
            touchStartX = e.touches[0].clientX;
        }, { passive: true });
        viewport.addEventListener('touchend', function(e){
            if (touchStartX == null || !e.changedTouches || !e.changedTouches[0]) return;
            const dx = e.changedTouches[0].clientX - touchStartX;
            touchStartX = null;
            if (Math.abs(dx) < 40) return;
            // RTL: swipe right → previous, swipe left → next
            if (dx > 0) goTo(index - 1);
            else goTo(index + 1);
            restart();
        }, { passive: true });
    }

    function restart(){
        if (window._homeBannerTimer) clearInterval(window._homeBannerTimer);
        window._homeBannerTimer = setInterval(function(){ goTo(index + 1); }, 4500);
    }

    goTo(0);
    restart();
}
window.initHomeBannerSlider = initHomeBannerSlider;
















































































let mobileOrdersSubTab = 'requests';









































let keloNominatimLastRequestAt = 0;
let keloNominatimQueueTimer = null;
let keloNominatimController = null;

















let keloMap=null,keloUserMarker=null,keloAccuracy=null,keloPickMarker=null,keloLocationWatch=null;
const KELO_CITY_COORDS={
    // مازندران
    'ساری':[36.5659,53.0586],'جویبار':[36.6412,52.9120],'بابل':[36.5513,52.6789],'آمل':[36.4696,52.3507],
    'قائم‌شهر':[36.4630,52.8610],'قائمشهر':[36.4630,52.8610],'بابلسر':[36.7025,52.6576],'بهشهر':[36.6926,53.5526],
    'تنکابن':[36.8167,50.8708],'نکا':[36.6508,53.2993],'نور':[36.5732,52.0112],'نوشهر':[36.6489,51.4960],
    'چالوس':[36.6550,51.4200],'رامسر':[36.9198,50.6446],'محمودآباد':[36.6312,52.2630],'فریدون‌کنار':[36.6850,52.5210],'فریدونکنار':[36.6850,52.5210],
    'عباس‌آباد':[36.7270,51.1060],'عباس آباد':[36.7270,51.1060],'کلاردشت':[36.5050,51.1600],'گلوگاه':[36.7270,53.8080],
    'میاندورود':[36.5900,53.2000],'سیمرغ':[36.5800,52.8200],'سوادکوه':[36.0500,52.9500],'سوادکوه شمالی':[36.2500,53.0000],
    // گیلان
    'رشت':[37.2808,49.5832],'لاهیجان':[37.2070,50.0039],'لنگرود':[37.1964,50.1531],'آستارا':[38.4291,48.8720],
    'بندر انزلی':[37.4714,49.4597],'انزلی':[37.4714,49.4597],'رودسر':[37.1370,50.2859],'رودبار':[36.8240,49.4222],
    'آستانه اشرفیه':[37.2595,49.9444],'فومن':[37.2239,49.3122],'صومعه‌سرا':[37.2950,49.3200],'صومعه سرا':[37.2950,49.3200],
    'شفت':[37.1700,49.4000],'سیاهکل':[37.1520,49.8710],'املش':[37.0960,50.1860],'رضوانشهر':[37.5510,49.1390],
    'ماسال':[37.3620,49.1320],'طوالش':[37.9000,48.9000],'هشتپر':[37.9000,48.9000]
};
// سقف فاصله (کیلومتر) برای قبول برچسب شهر — جلو اشتباه تنکابن→رامسر و مشابه
const KELO_CITY_MAX_DIST_KM = 12;






const JALALI_MONTH_NAMES=['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
const JALALI_WEEK_NAMES=['شنبه','یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه'];
const jalaliPartsFormatter=new Intl.DateTimeFormat('en-US-u-ca-persian-nu-latn',{year:'numeric',month:'numeric',day:'numeric'});
const jalaliDateCache=new Map();




























const KELO_GEOGRAPHY={"مازندران":["آمل","بابل","بابلسر","بهشهر","تنکابن","جویبار","چالوس","رامسر","ساری","سوادکوه","سوادکوه شمالی","سیمرغ","عباس‌آباد","فریدون‌کنار","قائم‌شهر","کلاردشت","گلوگاه","محمودآباد","میاندورود","نکا","نور","نوشهر"],"گیلان":["آستانه اشرفیه","آستارا","املش","بندر انزلی","رشت","رضوانشهر","رودبار","رودسر","سیاهکل","شفت","صومعه‌سرا","طوالش","فومن","لاهیجان","لنگرود","ماسال"]};



























document.addEventListener('input', function(e){ syncWizardFieldValue(e.target); });
document.addEventListener('change', function(e){ syncWizardFieldValue(e.target); });






































const driveImageMap={"harvest.jpg":"https://cdn.imgurl.ir/uploads/c669299_harvest.jpg","pickup.jpg":"https://cdn.imgurl.ir/uploads/b00687_pickup.jpg","spray.jpg":"https://cdn.imgurl.ir/uploads/a133_spray.jpg","tractor.jpg":"https://cdn.imgurl.ir/uploads/f75498_tractor.jpg","transplant.jpg":"https://cdn.imgurl.ir/uploads/g9655_transant.jpg"};

document.addEventListener('keydown', function(e){
    if(e.key !== 'Escape') return;
    if(document.getElementById('keloCalendarModal')){ closeCalendarModal(); return; }
    if(document.getElementById('keloPriceUnitSheet')){ closePriceUnitSheet(); return; }
    if(document.getElementById('keloSelectSheet')){ closeMobileSelectSheet(); return; }
    if(document.getElementById('keloActivityAreaSheet')){ closeActivityAreaSheet(); return; }
    if(document.getElementById('keloServicePickerBackdrop')){ closeMobileServicePicker(); return; }
    if(document.getElementById('keloFormSheetBackdrop')){ closeMobileFormSheet(); return; }
    if(document.getElementById('keloMobileMapPickerOverlay')){ closeMobileLocationPicker(); return; }
    var acc = document.getElementById('mobileAccountBackdrop');
    if(acc && acc.classList.contains('open')){ closeMobileAccountSheet(); return; }
});

/* Phase 18 — shell APIs on window */
window.saveDB = saveDB;
window.renderApp = renderApp;
window.renderUser = renderUser;
window.renderMobileHome = renderMobileHome;
window.onMobilePlusClick = onMobilePlusClick;
window.refreshServerSnapshot = refreshServerSnapshot;
window.applyServerSnapshot = applyServerSnapshot;
window.initializeDB = initializeDB;
window.cloneObject = cloneObject;
window.showFieldError = showFieldError;
window.clearFieldError = clearFieldError;
window.clearFieldErrors = clearFieldErrors;
window.toggleFaq = toggleFaq;
if (typeof driveImageMap !== 'undefined') window.driveImageMap = driveImageMap;
window.db = db;

