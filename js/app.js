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

var KELO_BACK_CHEVRON_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>';
var KELO_PENCIL_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';

function showToast(message, type){
    type = type || 'info';
    let toast = document.getElementById('keloToast');
    if(!toast){ toast = document.createElement('div'); toast.id = 'keloToast'; document.body.appendChild(toast); }
    toast.className = 'kelo-toast ' + type + ' show';
    toast.textContent = message;
    clearTimeout(window._keloToastTimer);
    window._keloToastTimer = setTimeout(function(){ toast.classList.remove('show'); }, 2800);
}
function fmtNum(n){ const num = Number(n) || 0; try { return new Intl.NumberFormat('fa-IR').format(num); } catch(e){ return String(num); } }
function toPersianDigits(value){ return String(value??'').replace(/\d/g,d=>'۰۱۲۳۴۵۶۷۸۹'[Number(d)]); }
function escapeHtml(value){ return String(value??'').replace(/[&<>'"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
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
function saveWizardDraft(){
    if(!currentUser || isAdmin(currentUser)) return;
    if(!wizard.type) return;
    const draft = { type: wizard.type, service: wizard.service, data: wizard.data, serviceOptions: wizard.serviceOptions, ts: Date.now() };
    try{ localStorage.setItem(DRAFT_PREFIX + currentUser.id, JSON.stringify(draft)); }catch(e){}
}
function saveWizardDraftDebounced(){ clearTimeout(_draftSaveTimer); _draftSaveTimer = setTimeout(saveWizardDraft, 500); }
function clearWizardDraft(){ if(!currentUser) return; try{ localStorage.removeItem(DRAFT_PREFIX + currentUser.id); }catch(e){} }
function saveSession(){
    try{
        if(window.KeloBackend && window.KeloBackend.remoteAvailable){
            localStorage.removeItem(SESSION_KEY);
            return;
        }
        if(currentUser) localStorage.setItem(SESSION_KEY, currentUser.id);
    }catch(e){}
}
function clearSession(){
    try{ localStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(TAB_KEY); }catch(e){}
}
function setAppActive(active){
    if(active){ document.documentElement.classList.add('kelo-app-active'); document.body.classList.add('kelo-app-active'); }
    else { document.documentElement.classList.remove('kelo-app-active'); document.body.classList.remove('kelo-app-active'); }
}
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
    ["machineType","نوع ماشین آلات","text","مثلاً کمباین کلاس لکسیون ۶۳۰",false],
    ["capacity","ظرفیت / مشخصه","text","مثلاً ۴ تن در ساعت",false],
    ["price","قیمت","number","مثلاً 3000000",true],
    ["priceUnit","واحد قیمت","select",["تومان / هکتار","تومان / ساعت","تومان / روز","تومان / سرویس"],true],
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
let currentUser=null;

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
let wizard=makeEmptyWizard();
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
function normalizeDigits(value){ return String(value||"").replace(/[۰-۹]/g,d=>String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٠-٩]/g,d=>String("٠١٢٣٤٥٦٧٨٩".indexOf(d))); }
function normalizePhone(value){ let p=normalizeDigits(value).replace(/\s+/g,"").trim(); if(p.startsWith("+98"))p="0"+p.substring(3); else if(p.startsWith("98"))p="0"+p.substring(2); return p; }
function normalizeNationalId(value){ return normalizeDigits(value).replace(/\D/g,"").trim(); }
function showAuthError(message){ const box=document.getElementById("authError"); if(!box){ showToast(message,'error'); return; } box.textContent=message; box.style.display="block"; }
function clearAuthError(){ const box=document.getElementById("authError"); if(box){ box.textContent=""; box.style.display="none"; } }
function openLogin(){
    authMode="public";
    const modal=document.getElementById("loginModal");
    if(modal) modal.classList.remove("hidden");
    const title=modal ? modal.querySelector(".modal-head h2") : null;
    if(title) title.textContent="ورود یا ثبت نام";
    clearAuthError();
}
function openAdminLogin(){
    authMode="admin";
    const modal=document.getElementById("loginModal");
    if(modal) modal.classList.remove("hidden");
    const title=modal ? modal.querySelector(".modal-head h2") : null;
    if(title) title.textContent="ورود مدیریت";
    clearAuthError();
}
function closeLogin(){
    const modal=document.getElementById("loginModal");
    if(modal) modal.classList.add("hidden");
    const phone=document.getElementById("loginPhone"), nid=document.getElementById("loginNationalId");
    if(phone)phone.value=""; if(nid)nid.value="";
    clearAuthError();
}
function ensureSystemRoles(user){ if(!user) return []; if(!Array.isArray(user.systemRoles)) user.systemRoles=[]; return user.systemRoles; }
function isAdmin(user){ return !!user && ensureSystemRoles(user).includes("admin"); }
function activateRemoteUserCache(){
    try{
        db.users = [];
        const snapshot=cloneObject(db);
        snapshot.users=[];
        localStorage.setItem('kelo_db', JSON.stringify(snapshot));
    }catch(e){}
}
function syncRemoteUserIntoLocalCache(user){
    if(!user) return;
    const existing=db.users.find(u=>u.id===user.id);
    const cached={
        id:user.id,
        name:user.name||"",
        phone:user.phone||"",
        profileCompleted:!!user.profileCompleted,
        profile:cloneObject(user.profile||{}),
        profileLocation:user.profileLocation?cloneObject(user.profileLocation):null,
        systemRoles:cloneObject(user.systemRoles||[])
    };
    if(existing) Object.assign(existing,cached); else db.users.push(cached);
    if(window.KeloBackend && window.KeloBackend.remoteAvailable){
        // Do not persist national ID into browser storage in remote mode.
        try{
            const snapshot=cloneObject(db);
            snapshot.users=(snapshot.users||[]).map(u=>{ const x=Object.assign({},u); delete x.nationalId; return x; });
            localStorage.setItem('kelo_db', JSON.stringify(snapshot));
        }catch(e){}
    }
}
function enterAuthenticatedApp(user, options){
    options=options||{};
    currentUser=user;
    syncRemoteUserIntoLocalCache(user);
    if(!options.skipSessionSave) saveSession();
    closeLogin();
    const landing=document.getElementById("landing"), app=document.getElementById("app");
    if(landing) landing.classList.add("hidden");
    if(app) app.classList.remove("hidden");
    setAppActive(true);
    const preStyle=document.getElementById('keloPreloadHideLanding'); if(preStyle) preStyle.remove();
    if(!currentUser.profileCompleted) showCompleteProfile();
    else renderApp();
}
async function login(e){
    e.preventDefault(); clearAuthError();
    const phone=normalizePhone(document.getElementById("loginPhone").value);
    const nationalId=normalizeNationalId(document.getElementById("loginNationalId").value);
    if(!/^09\d{9}$/.test(phone)){ showAuthError("شماره تلفن همراه معتبر نیست."); return; }
    if(!/^\d{10}$/.test(nationalId)){ showAuthError("کد ملی باید ۱۰ رقم باشد."); return; }

    if(window.KeloBackend){
        try{
            const apiAvailable = await window.KeloBackend.bootstrap();
            if(apiAvailable){
                const result=await window.KeloBackend.login(phone,nationalId,authMode);
                enterAuthenticatedApp(result.user);
                return;
            }
        }catch(error){
            showAuthError(error.message || 'ورود انجام نشد.');
            return;
        }
    }

    if(authMode==="admin"){ adminLoginValues(phone,nationalId); return; }
    const existing=db.users.find(u=>normalizePhone(u.phone)===phone);
    if(existing){
        if(normalizeNationalId(existing.nationalId)!==nationalId){ showAuthError("این شماره همراه قبلاً با کد ملی دیگری ثبت شده است."); return; }
        currentUser=existing; saveSession(); closeLogin();
        document.getElementById("landing").classList.add("hidden");
        document.getElementById("app").classList.remove("hidden");
        setAppActive(true);
        if(!currentUser.profileCompleted) showCompleteProfile(); else renderApp();
        return;
    }
    const duplicate=db.users.find(u=>normalizeNationalId(u.nationalId)===nationalId);
    if(duplicate){ showAuthError("این کد ملی قبلاً ثبت شده است."); return; }
    const newUser={ id:"u_"+Date.now()+"_"+Math.random().toString(36).slice(2,8), name:"", phone, nationalId, profileCompleted:false, profile:{} };
    db.users.push(newUser); saveDB(); currentUser=newUser; saveSession(); closeLogin();
    document.getElementById("landing").classList.add("hidden");
    document.getElementById("app").classList.remove("hidden");
    setAppActive(true);
    showCompleteProfile();
}
async function adminLoginValues(phone,nationalId){
    if(window.KeloBackend){
        try{
            const apiAvailable=await window.KeloBackend.bootstrap();
            if(apiAvailable){
                const result=await window.KeloBackend.login(phone,nationalId,'admin');
                enterAuthenticatedApp(result.user);
                return;
            }
        }catch(error){ showAuthError(error.message || 'ورود مدیریت انجام نشد.'); return; }
    }
    const admin=db.users.find(u=>isAdmin(u) && normalizePhone(u.phone)===phone);
    if(!admin || normalizeNationalId(admin.nationalId)!==nationalId){ showAuthError("اطلاعات ورود مدیر صحیح نیست."); return; }
    currentUser=admin; saveSession(); closeLogin();
    document.getElementById("landing").classList.add("hidden");
    document.getElementById("app").classList.remove("hidden");
    setAppActive(true);
    renderApp();
}
async function logout(){
    closeMobileAccountSheet();
    if(window.KeloBackend && window.KeloBackend.remoteAvailable){ await window.KeloBackend.logout(); }
    currentUser=null; clearSession();
    const app=document.getElementById("app"), landing=document.getElementById("landing"), modal=document.getElementById("loginModal");
    if(app)app.classList.add("hidden"); if(landing)landing.classList.remove("hidden"); if(modal)modal.classList.add("hidden");
    setAppActive(false);
    const preStyle = document.getElementById('keloPreloadHideLanding');
    if(preStyle) preStyle.remove();
    window.location.hash=""; clearAuthError(); window.scrollTo({top:0,behavior:"auto"});
}

function profileMapPickerHtml(placeholderText){
    return '<div class="profile-map-placeholder"><svg viewBox="0 0 24 24"><path d="M12 22s-8-7.5-8-13a8 8 0 1 1 16 0c0 5.5-8 13-8 13z"/><circle cx="12" cy="9" r="3"/></svg><span>'+escapeHtml(placeholderText)+'</span></div>';
}

function showCompleteProfile(){
    document.getElementById("sidebar").innerHTML="";
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
        } else {
            autoDetectProfileLocation('first');
        }
    });
    const nav=document.getElementById('mobileBottomNav'); if(nav) nav.classList.add('hidden');
    const app=document.getElementById('app');
    if(app) app.classList.add('mobile-tab-profile-edit');
}

async function saveFirstProfile(e){
    e.preventDefault();
    const nameEl = document.getElementById('firstProfileName');
    const name = (nameEl ? nameEl.value : '').trim();
    if(!name || name.length < 2){ showToast('نام و نام خانوادگی را وارد کنید.', 'error'); return; }

    let user = currentUser;
    user.profile = user.profile || {};
    if(wizard._pendingProfileLocation){
        user.profileLocation = cloneObject(wizard._pendingProfileLocation);
        if(user.profileLocation.city) user.profile.city = user.profileLocation.city;
        if(user.profileLocation.province) user.profile.province = user.profileLocation.province;
    }
    user.name = name;
    user.profileCompleted = true;

    if(window.KeloBackend && window.KeloBackend.remoteAvailable){
        try{
            user = await window.KeloBackend.updateCurrentUser({
                name:user.name,
                phone:user.phone,
                nationalId:user.nationalId,
                profileCompleted:true,
                profile:user.profile,
                profileLocation:user.profileLocation || null
            });
        }catch(error){ showToast(error.message || 'ذخیره اطلاعات انجام نشد.','error'); return; }
    } else {
        const localUser=db.users.find(u=>u.id===currentUser.id);
        if(localUser) Object.assign(localUser,user);
        saveDB();
    }
    currentUser = user;
    syncRemoteUserIntoLocalCache(user);
    wizard._pendingProfileLocation = null;
    wizard._profileAutoGeoRequested = false;
    document.getElementById('avatar').innerText = currentUser.name;
    updateMobileAccountIdentity();
    const nav=document.getElementById('mobileBottomNav'); if(nav) nav.classList.remove('hidden');
    const app=document.getElementById('app');
    if(app) app.classList.remove('mobile-tab-profile-edit');
    showToast('اطلاعات ذخیره شد','success');
    renderApp();
}

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
function cancelProfileEdit(){
    const nav=document.getElementById('mobileBottomNav'); if(nav) nav.classList.remove('hidden');
    const app=document.getElementById('app');
    if(app) app.classList.remove('mobile-tab-profile-edit');
    const tab = window.__keloMobileTab || 'home';
    if(tab === 'request-offers') setMobileTab('proposals');
    else setMobileTab(tab);
}

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
async function saveProfile(e){
    e.preventDefault();
    const name=document.getElementById("pName").value.trim();
    const province=document.getElementById("pProvince").value;
    const city=document.getElementById("pCity").value;
    const village=document.getElementById("pVillage").value.trim();
    if(!name || name.length<2){ showToast('نام کامل را وارد کنید.','error'); return; }
    if(!city){ showToast('شهر را انتخاب کنید.','error'); return; }

    let user=currentUser;
    user.name=name;
    user.profile={province,city,village:village||""};
    user.profileCompleted=true;
    if(window.KeloBackend && window.KeloBackend.remoteAvailable){
        try{
            user=await window.KeloBackend.updateCurrentUser({
                name:user.name,
                phone:user.phone,
                nationalId:user.nationalId,
                profileCompleted:true,
                profile:user.profile,
                profileLocation:user.profileLocation || null
            });
        }catch(error){ showToast(error.message || 'ذخیره اطلاعات انجام نشد.','error'); return; }
    } else {
        const localUser=db.users.find(u=>u.id===currentUser.id);
        if(localUser) Object.assign(localUser,user);
        saveDB();
    }
    currentUser=user;
    syncRemoteUserIntoLocalCache(user);
    document.getElementById("avatar").innerText=currentUser.name;
    updateMobileAccountIdentity();
    const sheetOpen = document.getElementById('mobileAccountBackdrop') && document.getElementById('mobileAccountBackdrop').classList.contains('open');
    if(sheetOpen){ renderMobileAccountSection('profile'); return; }
    const nav=document.getElementById('mobileBottomNav'); if(nav) nav.classList.remove('hidden');
    const app=document.getElementById('app'); if(app) app.classList.remove('mobile-tab-profile-edit');
    renderApp();
}
async function saveProfileEdit(e){
    e.preventDefault();
    const nameEl=document.getElementById('editName');
    const phoneEl=document.getElementById('editPhone');
    const nidEl=document.getElementById('editNationalId');
    const name=(nameEl?nameEl.value:'').trim();
    const phoneRaw=(phoneEl?phoneEl.value:'').trim();
    const nidRaw=(nidEl?nidEl.value:'').trim();
    const phone=normalizePhone(phoneRaw);
    const nid=normalizeNationalId(nidRaw);
    if(!name || name.length<2){ showToast('نام کامل را وارد کنید.','error'); return; }
    if(!/^09\d{9}$/.test(phone)){ showToast('شماره همراه معتبر نیست.','error'); return; }
    if(!/^\d{10}$/.test(nid)){ showToast('کد ملی باید ۱۰ رقم باشد.','error'); return; }

    let user=currentUser;
    user.name=name; user.phone=phone; user.nationalId=nid; user.profileCompleted=true;
    if(wizard._pendingProfileLocation){
        user.profileLocation=cloneObject(wizard._pendingProfileLocation);
        user.profile=user.profile||{};
        if(user.profileLocation.city) user.profile.city=user.profileLocation.city;
        if(user.profileLocation.province) user.profile.province=user.profileLocation.province;
    }

    if(window.KeloBackend && window.KeloBackend.remoteAvailable){
        try{
            user=await window.KeloBackend.updateCurrentUser({
                name:user.name,
                phone:user.phone,
                nationalId:user.nationalId,
                profileCompleted:true,
                profile:user.profile||{},
                profileLocation:user.profileLocation || null
            });
        }catch(error){ showToast(error.message || 'ذخیره اطلاعات انجام نشد.','error'); return; }
    } else {
        const localUser=db.users.find(u=>u.id===currentUser.id);
        if(localUser) Object.assign(localUser,user);
        saveDB();
    }
    currentUser=user;
    syncRemoteUserIntoLocalCache(user);
    document.getElementById('avatar').innerText=currentUser.name;
    wizard._pendingProfileLocation=null;
    showToast('اطلاعات ذخیره شد','success');
    renderMobileAccountSection('profile');
}
function farmerAvatarSvg(){
    const name=(currentUser && currentUser.name && currentUser.name.trim())?currentUser.name.trim():'ک';
    const initial=name.charAt(0);
    const colors=['#78a83f','#d7aa43','#5d9ab2','#8a6fb0','#cf6a4a'];
    const idx=name.length%colors.length;
    return '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;display:block"><defs><linearGradient id="avGrad'+idx+'" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="'+colors[idx]+'"/><stop offset="100%" stop-color="'+colors[(idx+1)%colors.length]+'"/></linearGradient></defs><rect width="100" height="100" fill="url(#avGrad'+idx+')"/><text x="50" y="50" text-anchor="middle" dominant-baseline="central" font-family="Vazirmatn,Tahoma,Arial,sans-serif" font-size="44" font-weight="900" fill="#fff">'+escapeHtml(initial)+'</text></svg>';
}
function updateMobileAccountIdentity(){
    const name=(currentUser&&currentUser.name&&currentUser.name.trim())?currentUser.name:'کاربر';
    const phone=currentUser&&currentUser.phone?currentUser.phone:'—';
    const top=document.getElementById('mobileTopbarAvatar'); if(top) top.innerHTML=farmerAvatarSvg();
    const avatar=document.getElementById('mobileAccountAvatar'); if(avatar) avatar.innerHTML=farmerAvatarSvg();
    const n=document.getElementById('mobileAccountName'); if(n) n.textContent=name;
    const ph=document.getElementById('mobileAccountPhone'); if(ph) ph.textContent=toPersianDigits(phone);
}
let mobileAccountView='menu';
function accountMenuIcon(type){
  const common='fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"';
  const icons={
    activities:'<svg viewBox="0 0 24 24" '+common+'><rect x="4" y="3.5" width="16" height="17" rx="2.5"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',
    deals:'<svg viewBox="0 0 24 24" '+common+'><rect x="4" y="5" width="16" height="13" rx="2"/><path d="M7 9h10M8 14h4"/></svg>',
    profile:'<svg viewBox="0 0 24 24" '+common+'><circle cx="12" cy="8" r="3.2"/><path d="M5.5 20c.8-4 3.1-5.8 6.5-5.8s5.7 1.8 6.5 5.8"/></svg>',
    logout:'<svg viewBox="0 0 24 24" '+common+'><path d="M10 4H6.5A2.5 2.5 0 0 0 4 6.5v11A2.5 2.5 0 0 0 6.5 20H10"/><path d="M13 7l5 5-5 5M18 12H9"/></svg>'
  }; return icons[type]||icons.profile;
}
function serviceCardIcon(service){
    const icons={
      tractor:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10h3v4H7z" fill="#ffe0b2"/><path d="M3 20h18M5 16l4-8 4 8M15 16l4-8" fill="none" stroke="#e65100" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      planting:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22v-9M12 13C12 7 6 5 6 5s0 6 6 8M12 13c0-6 6-8 6-8s0 6-6 8" fill="none" stroke="#2e7d32" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      spray:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z" fill="none" stroke="#0277bd" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      harvest:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 22h20M12 2v20M8 6c2 0 4 2 4 4M16 6c-2 0-4 2-4 4M8 12c2 0 4 2 4 4M16 12c-2 0-4 2-4 4" fill="none" stroke="#f57f17" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    }; return icons[service]||icons.tractor;
}
function mobileActivityFilterMatches(item,filter){ if(filter==='all') return true; return filter==='completed' ? (item.__kind==='request' && item.status==='accepted') : !(item.__kind==='request' && item.status==='accepted'); }
let mobileActivityFilter='all';
function setMobileActivityFilter(filter){ mobileActivityFilter=filter||'all'; renderMobileAccountSection('activities'); }

function mobileAccountMenuMarkup(){ return ''; }
function mobileAccountInnerHeader(title){
    return '<div class="mobile-account-head inner"><button type="button" class="mobile-account-back" onclick="closeMobileAccountSheet()" aria-label="بازگشت">'+KELO_BACK_CHEVRON_SVG+'</button><h2 class="mobile-account-title">'+escapeHtml(title)+'</h2><span></span></div>';
}

function mobileAccountProfileMarkup(){
    const name = (currentUser && currentUser.name && currentUser.name.trim()) ? currentUser.name.trim() : 'کاربر';
    const phone = currentUser && currentUser.phone ? toPersianDigits(currentUser.phone) : '—';
    const completedDeals = db.deals.filter(d => (d.userId===currentUser.id || d.providerId===currentUser.id) && d.status==='completed').length;
    const ratingDisplay = '—';

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
        +   '<button type="button" class="profile-menu-row logout" onclick="closeMobileAccountSheet();logout()"><span class="profile-menu-icon"><svg viewBox="0 0 24 24"><path d="M10 4H6.5A2.5 2.5 0 0 0 4 6.5v11A2.5 2.5 0 0 0 6.5 20H10"/><path d="M13 7l5 5-5 5M18 12H9"/></svg></span><span>خروج از حساب</span></button>'
        + '</div>'
        + '</div>';
    return headerHtml + bodyHtml;
}

function mobileAccountInvoiceMarkup(){
    const deals = (db.deals||[]).filter(d => isDealForUser(d) && d.status!=='cancelled');
    const payments = (db.payments||[]).filter(p => p.status==='paid');
    const paidDealIds = new Set(payments.map(p=>p.dealId));
    const paidDeals = deals.filter(d => paidDealIds.has(d.id) || d.paymentStatus==='paid');

    const totalWorkCount = paidDeals.length;
    const paidByMe = paidDeals
        .filter(d => d.userId===currentUser.id)
        .reduce((sum,d) => sum + (Number(d.total)||0), 0);
    const receivedByMe = paidDeals
        .filter(d => d.providerId===currentUser.id)
        .reduce((sum,d) => sum + (Number(d.total)||0), 0);

    const cards = paidDeals.length ? paidDeals.slice().sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||''))).map(d=>{
        const req=db.requests.find(r=>r.id===d.requestId);
        const date=requestDate(req||{});
        const isRequester=d.userId===currentUser.id;
        const role=isRequester?'دریافت خدمت':'ارائه خدمت';
        const status=isRequester?'پرداخت‌شده':'دریافت‌شده';
        const total=Number(d.total)||0;
        return '<div class="mobile-activity-card">'
            +'<div class="activity-row"><div class="mobile-activity-icon '+escapeHtml(d.service||'')+'">'+serviceCardIcon(d.service)+'</div>'
            +'<div class="mobile-activity-main"><strong>'+escapeHtml(serviceName(d.service))+'</strong><span class="activity-meta">'+escapeHtml([date,role,d.counterparty||''].filter(Boolean).join(' · '))+'</span></div>'
            +'<div class="mobile-activity-status completed">'+escapeHtml(status)+'</div></div>'
            +'<div class="offer-card-price">'+(total?formatMoney(total):'—')+'</div>'
            +'<span class="offer-card-price-unit">'+(isRequester?'مبلغ پرداخت‌شده این کار':'مبلغ دریافت‌شده این کار')+'</span>'
            +'</div>';
    }).join('') : keloEmptyStateHtml('هنوز فاکتوری ندارید','پس از ثبت پرداخت، صورتحساب‌های شما در این بخش نمایش داده می‌شود.');

    const invoiceHeader = '<div class="mobile-account-head inner">'
        +'<button type="button" class="mobile-account-back" onclick="openMobileAccountSection(\'profile\')" aria-label="بازگشت">'+KELO_BACK_CHEVRON_SVG+'</button>'
        +'<h2 class="mobile-account-title">فاکتور</h2><span></span></div>';

    const summary='<div class="invoice-summary-card">'
        +'<div class="invoice-summary-head"><strong>خلاصه مالی</strong></div>'
        +'<div class="invoice-summary-stats">'
        +'<div><span>مجموع کار</span><strong>'+toPersianDigits(totalWorkCount)+'</strong></div>'
        +'<div><span>مبلغ پرداخت شده</span><strong>'+formatMoney(paidByMe)+'</strong></div>'
        +'<div><span>مبلغ دریافت شده</span><strong>'+formatMoney(receivedByMe)+'</strong></div>'
        +'</div></div>';
    return invoiceHeader+'<div class="mobile-account-body"><h3 class="mobile-account-section-label">صورت‌حساب‌های من</h3>'+cards+'</div>';
}

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
        + '<form class="profile-edit-form" onsubmit="saveProfileEdit(event)">'
        +   '<div class="profile-avatar-big">'+farmerAvatarSvg()+'</div>'
        +   '<div class="profile-edit-field"><label>نام کامل <span style="color:red">*</span></label><input id="editName" class="profile-pill-input" type="text" value="'+escapeHtml(name)+'" placeholder="نام کامل" required></div>'
        +   '<div class="profile-edit-field"><label>شماره موبایل <span style="color:red">*</span></label><input id="editPhone" class="profile-pill-input" type="tel" inputmode="numeric" maxlength="11" value="'+escapeHtml(phone)+'" placeholder="شماره موبایل" required></div>'
        +   '<div class="profile-edit-field"><label>کد ملی <span style="color:red">*</span></label><input id="editNationalId" class="profile-pill-input" type="text" inputmode="numeric" maxlength="10" value="'+escapeHtml(nid)+'" placeholder="کد ملی" required></div>'
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
      const requests=db.requests.filter(r=>r.userId===currentUser.id).map(r=>({...r,__kind:'request'}));
      const listings=db.listings.filter(l=>l.userId===currentUser.id).map(l=>({...l,__kind:'listing'}));
      const items=[...requests,...listings].filter(item=>mobileActivityFilterMatches(item,mobileActivityFilter));
      const filters='<div class="mobile-account-filter-row"><button type="button" class="mobile-account-filter '+(mobileActivityFilter==='all'?'active':'')+'" onclick="setMobileActivityFilter(\'all\')">همه</button><button type="button" class="mobile-account-filter '+(mobileActivityFilter==='progress'?'active':'')+'" onclick="setMobileActivityFilter(\'progress\')">در حال انجام</button><button type="button" class="mobile-account-filter '+(mobileActivityFilter==='completed'?'active':'')+'" onclick="setMobileActivityFilter(\'completed\')">تکمیل شده</button></div>';
      const cards=items.length?items.map(item=>{
        const service=item.service;
        const meta=item.__kind==='request' ? requestCityName(item)+' · '+requestDate(item)+(requestAmount(item)?' · '+requestAmount(item):'') : formatActivityArea(item.data.activityArea)+(item.data.price?' · '+formatMoney(item.data.price):'');
        return '<div class="mobile-activity-card"><div class="activity-row"><div class="mobile-activity-icon '+service+'">'+serviceCardIcon(service)+'</div><div class="mobile-activity-main"><strong>'+escapeHtml(serviceName(service))+'</strong><span class="activity-meta">'+escapeHtml(meta)+'</span></div></div></div>';
      }).join(''):keloEmptyStateHtml('چیزی اینجا نیست', 'فعالیت‌های شما اینجا نمایش داده می‌شود.');
      sheet.innerHTML=mobileAccountInnerHeader('فعالیت‌های من')+'<div class="mobile-account-body">'+filters+cards+'</div>';
      attachSheetDragOnce(sheet);
      return;
    }
    if(section==='deals'){
      const receivedOffers=db.requestRecipients.filter(o=>o.providerId===currentUser.id && o.status==='pending');
      const myDealsList=db.deals.filter(d=>d.userId===currentUser.id || d.providerId===currentUser.id);
      const offersHtml=receivedOffers.length?receivedOffers.map(o=>{ const req=db.requests.find(r=>r.id===o.requestId); return '<div class="mobile-activity-card"><div class="activity-row"><div class="mobile-activity-main"><strong>'+escapeHtml(serviceName(req?.service||o.service))+'</strong><span class="activity-meta">'+escapeHtml(requestDate(req||{}))+' · '+(o.total?formatMoney(o.total):'توافقی')+'</span></div><button class="btn btn-primary" style="min-height:40px;padding:6px 12px;font-size:13px" onclick="acceptOffer(\''+o.id+'\')">پذیرش</button></div></div>'; }).join(''):'<p class="text-muted">پیشنهاد جدیدی وجود ندارد.</p>';
      const dealsHtml=myDealsList.length?myDealsList.map(d=>'<div class="mobile-activity-card"><div class="activity-row"><div class="mobile-activity-main"><strong>'+serviceName(d.service)+'</strong><span class="activity-meta">'+escapeHtml(d.counterparty||'—')+' · '+(d.total?formatMoney(d.total):'—')+'</span></div></div></div>').join(''):'<p class="text-muted">هنوز توافقی ثبت نشده است.</p>';
      sheet.innerHTML=mobileAccountInnerHeader('سفارش‌ها و توافق‌ها')+'<div class="mobile-account-body"><h3 class="mobile-account-section-label">درخواست‌های پیشنهادی</h3>'+offersHtml+'<h3 class="mobile-account-section-label" style="margin-top:20px">توافق‌های من</h3>'+dealsHtml+'</div>';
      attachSheetDragOnce(sheet);
    }
}
function attachSheetDragOnce(sheet){ if(!sheet) return; sheet._keloDragAttached = true; }
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
function closeMobileAccountSheet(){
    const el=document.getElementById('mobileAccountBackdrop');
    if(el){el.classList.remove('open');el.setAttribute('aria-hidden','true');document.body.style.overflow='';}
    if(window._keloProfileMap){ try{ window._keloProfileMap.remove(); }catch(e){} window._keloProfileMap=null; }
    wizard._pendingProfileLocation = null;
    wizard._profileAutoGeoRequested = false;
}
function openMobileAccountSection(section){ if(!currentUser || isAdmin(currentUser)) return; renderMobileAccountSection(section); }
function openMobileProfileFromSheet(){openMobileAccountSection('profile');}
function backToMobileAccountMenu(){ closeMobileAccountSheet(); }
function editMobileProfile(){ renderMobileAccountSection('edit'); }

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
function activateProfileMapPicker(){
    wizard._profileMapMode = 'edit';
    wizard._pendingMapPoint = wizard._pendingProfileLocation ? cloneObject(wizard._pendingProfileLocation) : (currentUser.profileLocation ? cloneObject(currentUser.profileLocation) : null);
    openMobileMapPickerOverlay();
}
function activateProfileMapPickerForFirst(){
    wizard._profileMapMode = 'first';
    wizard._pendingMapPoint = wizard._pendingProfileLocation ? cloneObject(wizard._pendingProfileLocation) : (currentUser.profileLocation ? cloneObject(currentUser.profileLocation) : null);
    openMobileMapPickerOverlay();
}

function renderApp(){
    document.getElementById("avatar").innerText=(currentUser.name && currentUser.name.trim())?currentUser.name:"کاربر";
    updateMobileAccountIdentity();
    if(isAdmin(currentUser)) renderAdmin(); else renderUser();
}
function openAccountFromHeader(){ if(!currentUser || isAdmin(currentUser)) return; return openMobileAccountSheet(); }
function renderUser(){ setMobileTab(window.__keloMobileTab||'home'); }
function updateMobileHeader(title){
    const t=document.getElementById('mobileAppTitle'); if(t)t.textContent=title||'خانه';
    const nav=document.getElementById('mobileBottomNav');
    if(nav){ nav.querySelectorAll('button[data-tab]').forEach(b=>{ b.classList.toggle('active', b.dataset.tab === window.__keloMobileTab); }); }
    const badge=document.getElementById('mobileNotificationBadge');
    if(badge && currentUser){ const n=db.requestRecipients.filter(o=>o.providerId===currentUser.id && o.status==='pending').length; badge.textContent=toPersianDigits(n); badge.classList.toggle('hidden',!n); }
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
function onMobilePlusClick(){
    sessionStorage.removeItem('kelo_mobile_success');
    mobileRequestSuccess = false; mobileSuccessData = null;
    clearWizardDraft();
    resetMobileWizardFlow();
    setMobileTab('request');
}
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
function renderMobileHome(){
    const c=document.getElementById('appContent');
    c.className='content';
    c.innerHTML='<div class="mobile-home-page"><div class="mobile-home-hero"><img src="https://cdn.imgurl.ir/uploads/s3128_home.jpg" alt="کِلو" onerror="this.style.background=\'linear-gradient(135deg,#9dc457,#d4b75c)\';this.removeAttribute(\'src\')"><h2>کِلو</h2><p>دسترسی سریع به ادوات کشاورزی<br>و اپراتورهای متخصص در منطقه شما</p><button type="button" class="mobile-home-action" onclick="onMobilePlusClick()">ثبت درخواست</button></div></div>';
}
function resetMobileWizardFlow(){ wizard = makeEmptyWizard(); }
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

function keloEmptyStateHtml(title, desc, actionHtml){
    const icon = '<svg viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M3 12h18"/></svg>';
    return '<div class="kelo-empty-state-box"><div class="kelo-empty-icon">'+icon+'</div><h3 class="kelo-empty-title">'+escapeHtml(title)+'</h3><p class="kelo-empty-desc">'+escapeHtml(desc)+'</p>'+(actionHtml?'<div class="kelo-empty-action">'+actionHtml+'</div>':'')+'</div>';
}

function renderMobileRequest(){
    const saved = sessionStorage.getItem('kelo_mobile_success');
    if(saved){ try{ const data = JSON.parse(saved); if(Date.now() - (data.ts||0) < 5 * 60 * 1000){ mobileRequestSuccess = true; mobileSuccessData = data; } else { sessionStorage.removeItem('kelo_mobile_success'); } }catch(e){ sessionStorage.removeItem('kelo_mobile_success'); } }
    if(mobileRequestSuccess){ renderMobileSuccessScreen(); return; }
    const c = document.getElementById('appContent');
    if(c){ c.className='content'; c.innerHTML=''; }
    setMobileSheet(true);
    renderMobileRequestBase();
}
function renderMobileRequestBase(){
    const sb = document.getElementById('sidebar');
    if(!sb) return;
    sb.innerHTML = '<div class="mobile-request-base"><h2>چه کاری برایتان انجام دهیم؟</h2><p>یکی از گزینه‌های زیر را انتخاب کنید</p><div class="role-cards"><button type="button" class="role-card farmer" onclick="openMobileFormSheet(\'receive\')"><div class="role-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22V9"/><path d="M12 13C12 7 6 5 6 5s0 6 6 8"/><path d="M12 13c0-6 6-8 6-8s0 6-6 8"/></svg></div><strong>نیاز به خدمت دارم</strong><span>برای زمین من تراکتور یا کمباین بفرست</span></button><button type="button" class="role-card machine" onclick="openMobileFormSheet(\'provide\')"><div class="role-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="7" cy="18" r="3"/><circle cx="18" cy="18" r="2.5"/><path d="M2 14h3a2 2 0 0 1 2 2v3"/><path d="M7 13V6a1 1 0 0 1 1-1h3l2 5"/><path d="M13 10h4l2 4"/></svg></div><strong>خدمات ارائه می‌دم</strong><span>ماشین‌آلات من آماده کاره</span></button></div></div>';
}
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
const CALENDAR_ICON_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>';
function renderMobileDateField(id, label, required){
    if(id === 'dateStart' && !wizard.data[id]){ wizard.data[id] = localDateToIso(new Date()); }
    const finalDisplay = wizard.data[id] ? humanJalaliDate(wizard.data[id]) : '';
    const placeholder = id === 'dateEnd' ? 'تاریخ پایان' : 'تاریخ شروع';
    return '<div class="sidebar-field jalali-date-field" data-date-field="'+id+'"><label>'+escapeHtml(label)+(required?' <span style="color:red">*</span>':'')+'</label><button type="button" class="jalali-date-trigger" onclick="toggleJalaliPicker(\''+escapeHtml(id)+'\',false);return false;"><span class="'+(finalDisplay?'date-value':'placeholder')+'">'+escapeHtml(finalDisplay || placeholder)+'</span><span class="date-arrow">'+CALENDAR_ICON_SVG+'</span></button></div>';
}
function renderMobilePriceInput(field){
    const [id,label,type,extra,required]=field;
    const placeholder=mobileFieldPlaceholder(id,label,type,extra);
    return '<input id="wf_'+id+'" data-wizard-field="'+escapeHtml(id)+'" class="input" type="number" min="0" '+(required?'required':'')+' value="'+escapeHtml(wizard.data[id]||'')+'" placeholder="'+escapeHtml(placeholder)+'">';
}
function renderMobilePriceUnitField(field){
    const [id] = field;
    const value = wizard.data[id] || '';
    const display = value || 'واحد قیمت';
    const isPlaceholder = !value;
    return '<button type="button" class="mobile-choice-trigger" onclick="openPriceUnitSheet()"><span class="'+(isPlaceholder?'placeholder':'')+'">'+escapeHtml(display)+'</span><span class="kelo-inline-chevron"><i class="kelo-chevron down"></i></span></button>';
}
function openPriceUnitSheet(){
    const options = ['تومان / هکتار','تومان / ساعت','تومان / روز','تومان / سرویس'];
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
function closePriceUnitSheet(){ const el=document.getElementById('keloPriceUnitSheet'); if(el) el.remove(); }
function choosePriceUnit(value){
    wizard.data.priceUnit = value;
    clearFieldError('priceUnit');
    saveWizardDraftDebounced();
    closePriceUnitSheet();
    if(wizard.formSheetOpen) renderMobileFormSheet();
}

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
function closeCalendarModal(){
    wizard.calendarOpen = false;
    wizard.calendarId = '';
    wizard.calendarRangeStart = null;
    const modal = document.getElementById('keloCalendarModal');
    if(modal) modal.remove();
    if(wizard.formSheetOpen) renderMobileFormSheet();
}

function openMobileServicePicker(){
    wizard.servicePickerOpen = true;
    wizard.servicePickerTemp = { service: wizard.service || null, options: JSON.parse(JSON.stringify(wizard.serviceOptions || {})) };
    wizard.servicePickerExpanded = wizard.service || null;
    wizard.servicePickerSearch = '';
    renderMobileServicePicker();
}
function closeMobileServicePicker(){
    wizard.servicePickerOpen = false;
    wizard.servicePickerTemp = null;
    wizard.servicePickerExpanded = null;
    wizard.servicePickerSearch = '';
    const el = document.getElementById('keloServicePickerBackdrop');
    if(el) el.remove();
}
function filterServicePicker(value){
    wizard.servicePickerSearch = value || '';
    renderMobileServicePicker();
    requestAnimationFrame(function(){ const input = document.querySelector('.mobile-sheet-search input'); if(input){ input.focus(); try{ input.setSelectionRange(input.value.length, input.value.length); }catch(e){} } });
}
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
function toggleServicePickerCard(serviceKey){
    if(wizard.servicePickerExpanded === serviceKey){ wizard.servicePickerExpanded = null; }
    else { wizard.servicePickerExpanded = serviceKey; if(wizard.servicePickerTemp){ wizard.servicePickerTemp.service = serviceKey; const subs = SERVICE_L3_FIELDS[serviceKey] || []; subs.forEach(function(sf){ if(wizard.servicePickerTemp.options[sf.id] === undefined){ wizard.servicePickerTemp.options[sf.id] = sf.multi ? [] : ''; } }); } }
    renderMobileServicePicker();
}
function toggleServicePickerChip(fieldId, value, multi){
    const temp = wizard.servicePickerTemp;
    if(!temp) return;
    if(multi){ let arr = Array.isArray(temp.options[fieldId]) ? temp.options[fieldId].slice() : []; const idx = arr.indexOf(value); if(idx >= 0) arr.splice(idx, 1); else arr.push(value); temp.options[fieldId] = arr; }
    else { temp.options[fieldId] = (temp.options[fieldId] === value) ? '' : value; }
    renderMobileServicePicker();
}
function confirmMobileServicePicker(){
    const temp = wizard.servicePickerTemp;
    if(!temp || !temp.service){ showToast('لطفاً یک خدمت انتخاب کنید', 'error'); return; }
    const subs = SERVICE_L3_FIELDS[temp.service] || [];
    for(let i=0;i<subs.length;i++){ const sf = subs[i]; if(!sf.required) continue; const v = temp.options[sf.id]; const empty = sf.multi ? (!Array.isArray(v) || !v.length) : !v; if(empty){ showToast('لطفاً یکی از گزینه‌ها را انتخاب کنید', 'error'); return; } }
    wizard.service = temp.service;
    wizard.serviceOptions = JSON.parse(JSON.stringify(temp.options));
    closeMobileServicePicker();
    renderMobileFormSheet();
}
function submitMobileForm(){
    clearFieldErrors();
    if(!wizard.service){ showToast('لطفاً نوع خدمت را انتخاب کنید', 'error'); return; }
    const subs = SERVICE_L3_FIELDS[wizard.service] || [];
    for(let i=0;i<subs.length;i++){ const sf = subs[i]; if(!sf.required) continue; const v = wizard.serviceOptions[sf.id]; const empty = sf.multi ? (!Array.isArray(v) || !v.length) : !v; if(empty){ showToast('لطفاً یکی از گزینه‌ها را انتخاب کنید', 'error'); return; } }
    const fields = mobileL2Fields();
    let ok = true;
    for(let i=0;i<fields.length;i++){ if(!validateMobileField(fields[i])) ok = false; }
    if(!ok){ const err = document.querySelector('#keloFormSheetBackdrop .field-error'); if(err) err.scrollIntoView({behavior:'smooth', block:'center'}); return; }
    Object.keys(wizard.serviceOptions || {}).forEach(function(k){ wizard.data[k] = wizard.serviceOptions[k]; });
    finalizeMobileForm();
}
function finalizeMobileForm(){
    if(!currentUser) return;
    const savedType = wizard.type, savedService = wizard.service;
    let newId = null;
    const fields = mobileL2Fields();
    const data = cloneObject(wizard.data || {});
    fields.forEach(function(f){
        const id = f[0], type = f[2];
        const el = document.getElementById('wf_' + id);
        if(type === 'file' && el) data[id] = Array.from(el.files || []).map(function(x){ return x.name; });
    });
    if(data.dateStart) data.date = data.dateStart;
    if(wizard.type === 'receive'){
        if(wizard.editRequestId){
            const request=db.requests.find(r=>r.id===wizard.editRequestId && r.userId===currentUser.id);
            if(!request){ showToast('درخواست برای ویرایش پیدا نشد','error'); return; }
            if(['accepted','agreed','in_progress','completed'].includes(request.status)){ showToast('این درخواست دیگر قابل ویرایش نیست','error'); return; }
            request.service=savedService;
            request.data=data;
            request.requesterName=currentUser.name;
            request.updated=new Date().toISOString();
            db.requestRecipients=db.requestRecipients.filter(x=>x.requestId!==request.id);
            newId=request.id;
        }else{
            const request = { id: "r" + Date.now() + Math.random().toString(36).slice(2,6), userId: currentUser.id, requesterName: currentUser.name, service: savedService, data: data, status: "pending", created: new Date().toISOString() };
            db.requests.push(request);
            newId = request.id;
        }
        saveDB();
    } else {
        const listing = { id: "l" + Date.now() + Math.random().toString(36).slice(2,6), userId: currentUser.id, providerName: currentUser.name, service: savedService, data: data, status: "active", created: new Date().toISOString() };
        db.listings.push(listing); saveDB();
        newId = listing.id;
    }
    clearWizardDraft(); closeMobileFormSheet();
    mobileRequestSuccess = true;
    mobileSuccessData = { type: savedType, service: savedService, id: newId, ts: Date.now(), updated: !!wizard.editRequestId };
    try{ sessionStorage.setItem('kelo_mobile_success', JSON.stringify(mobileSuccessData)); }catch(e){}
    resetMobileWizardFlow();
    renderMobileRequest();
}
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
function nearestCityFromCoords(lat, lng){
    let best = null, bestDist = Infinity;
    for(const [name, coords] of Object.entries(KELO_CITY_COORDS)){ const d = geoDistanceKm([lat, lng], coords); if(d < bestDist){ bestDist = d; best = name; } }
    return best || '';
}
function provinceFromCity(city){
    if(!city) return '';
    for(const [prov, cities] of Object.entries(KELO_GEOGRAPHY)){ if(cities.includes(city)) return prov; }
    return '';
}
function requestCityName(r){
    const loc = r?.data?.serviceLocation;
    if(loc && typeof loc.lat === 'number' && typeof loc.lng === 'number'){ const city = nearestCityFromCoords(loc.lat, loc.lng); if(city) return city; }
    if(r?.data?.activityArea && Array.isArray(r.data.activityArea) && r.data.activityArea.length){ const first = r.data.activityArea[0]; if(first.all || !first.cities?.length) return first.province; return first.cities[0] || first.province; }
    return r?.data?.city || r?.data?.province || '—';
}
function mobileProposalRequests(){
    return db.requests
        .filter(r=>r.userId===currentUser.id)
        .slice()
        .sort((a,b)=>String(b.created||'').localeCompare(String(a.created||'')));
}
function requestRecipientCount(requestId, status){
    return db.requestRecipients.filter(x=>x.requestId===requestId && (!status || x.status===status)).length;
}
function getMyReceivedOffers(){
    return db.requestRecipients
        .filter(x=>x.providerId===currentUser.id && x.status==='pending')
        .slice()
        .sort((a,b)=>String(a.createdAt||'').localeCompare(String(b.createdAt||'')));
}
function getMyDeals(){
    return db.deals
        .filter(d=>d.userId===currentUser.id || d.providerId===currentUser.id)
        .slice()
        .sort((a,b)=>String(b.createdAt||b.created||'').localeCompare(String(a.createdAt||a.created||'')));
}
function getRequestStatusLabel(r){
    if(!r) return '';
    if(r.status==='completed') return 'تمام شده';
    if(r.status==='accepted' || r.status==='agreed' || r.status==='in_progress') return 'توافق شده';
    const hasPendingRecipients = db.requestRecipients.some(x=>x.requestId===r.id && x.status==='pending');
    if(hasPendingRecipients) return 'در حال بررسی';
    return 'ایجاد شده';
}
function getRequestStatusClass(r){
    if(!r) return 'progress';
    return (r.status==='completed' ? 'completed' : (r.status==='accepted' || r.status==='agreed' || r.status==='in_progress' ? 'completed' : 'progress'));
}
function editRequest(requestId){
    const req=db.requests.find(r=>r.id===requestId && r.userId===currentUser.id);
    if(!req || req.status==='accepted' || req.status==='agreed' || req.status==='in_progress' || req.status==='completed'){
        showToast('این درخواست دیگر قابل ویرایش نیست','error'); return;
    }
    wizard=makeEmptyWizard();
    wizard.type='receive';
    wizard.formSheetOpen=true;
    wizard.service=req.service;
    wizard.serviceOptions=cloneObject(req.data || {});
    wizard.data=cloneObject(req.data || {});
    wizard.editRequestId=req.id;
    if(!wizard.data.dateStart) wizard.data.dateStart=wizard.data.date||localDateToIso(new Date());
    document.documentElement.setAttribute('data-form-theme','blue');
    renderMobileFormSheet();
}
function deleteRequest(requestId){
    const req=db.requests.find(r=>r.id===requestId && r.userId===currentUser.id);
    if(!req) return;
    if(req.status==='accepted' || req.status==='agreed' || req.status==='in_progress' || req.status==='completed'){
        showToast('درخواست توافق‌شده قابل حذف نیست','error'); return;
    }
    if(!confirm('این درخواست حذف شود؟')) return;
    db.requestRecipients=db.requestRecipients.filter(x=>x.requestId!==requestId);
    db.requests=db.requests.filter(x=>x.id!==requestId);
    saveDB();
    showToast('درخواست حذف شد','success');
    renderMobileProposals();
}
function rejectOffer(recipientId){
    const recipient=db.requestRecipients.find(x=>x.id===recipientId && x.providerId===currentUser.id);
    if(!recipient) return;
    if(!confirm('این درخواست رد شود؟')) return;
    recipient.status='rejected';
    recipient.respondedAt=new Date().toISOString();
    saveDB();
    showToast('درخواست رد شد','success');
    renderMobileProposals();
    updateMobileHeader('کارهای من');
}
function formatMoneyShort(value){
    const n = Number(value) || 0;
    if(n >= 1000000){ const m = n / 1000000; return toPersianDigits(m >= 10 ? Math.round(m) : m.toFixed(1)) + 'م'; }
    if(n >= 1000){ return toPersianDigits(Math.round(n / 1000)) + 'هـ'; }
    return toPersianDigits(n);
}
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
function renderMobileOffersList(){
    const recipients = getMyReceivedOffers();
    if(!recipients.length) return keloEmptyStateHtml('چیزی اینجا نیست', 'پیشنهادهای ارسالی به درخواست شما، پس از ارسال اینجا نمایش داده می‌شود.');
    return recipients.map(o => {
        const req = db.requests.find(r => r.id === o.requestId);
        if(!req) return '';
        const service = req.service;
        const city = requestCityName(req);
        const date = requestDate(req);
        const area = requestAmount(req);
        const meta = [city, date, area].filter(Boolean).join(' · ');
        const unitLine = formatOfferUnitLine(o, req);
        return '<div class="mobile-activity-card">'
            +'<div class="activity-row"><div class="mobile-activity-icon '+service+'">'+serviceCardIcon(service)+'</div>'
            +'<div class="mobile-activity-main"><strong>'+escapeHtml(serviceName(service))+'</strong><span class="activity-meta">'+escapeHtml(meta)+'</span></div></div>'
            +'<div class="offer-card-price">'+(o.total?formatMoney(o.total):'توافقی')+'</div>'
            +(unitLine?'<span class="offer-card-price-unit">'+escapeHtml(unitLine)+'</span>':'')
            +'<div class="offer-actions-row"><button type="button" class="btn btn-reject" onclick="rejectOffer(\''+o.id+'\')">رد کار</button><button type="button" class="btn btn-accept" onclick="acceptOffer(\''+o.id+'\')">پذیرش کار</button></div>'
            +'</div>';
    }).join('');
}
function isDealForUser(d){ return !!currentUser && (d.userId===currentUser.id || d.providerId===currentUser.id); }
function dealEndDate(deal){
    const req=db.requests.find(r=>r.id===deal.requestId);
    return req ? (parseStoredDate(req.data?.dateEnd || req.data?.dateStart || req.data?.date) || null) : null;
}
function isDealPastEnd(deal){
    const end=dealEndDate(deal); if(!end) return false;
    const now=new Date(); now.setHours(0,0,0,0);
    return end.getTime() <= now.getTime();
}
function renderMobileDealsList(){
    const deals=getMyDeals();
    if(!deals.length) return keloEmptyStateHtml('توافقی ثبت نشده', 'بعد از پذیرش یک درخواست، توافق شما اینجا نمایش داده می‌شود.');
    return deals.map(d=>{
        const req=db.requests.find(r=>r.id===d.requestId);
        const service=req ? req.service : d.service;
        const city=req ? requestCityName(req) : '—';
        const date=req ? requestDate(req) : '—';
        const isFarmer=d.userId===currentUser.id;
        const role=isFarmer ? 'درخواست‌دهنده' : 'ارائه‌دهنده';
        let action='';
        if(d.status==='completed'){
            action='<div class="offer-card-price">✓ کار تمام شده</div>';
        }else if(isFarmer){
            action='<div class="offer-actions-row"><button type="button" class="btn btn-brand" onclick="payDeal(\''+d.id+'\')">'+(d.paymentStatus==='paid'?'پرداخت شد':'پرداخت')+'</button><button type="button" class="btn btn-reject" onclick="cancelDeal(\''+d.id+'\')">انصراف کار</button></div>';
        }else{
            if(isDealPastEnd(d)){
                action='<div class="offer-actions-row"><button type="button" class="btn btn-brand" onclick="completeDeal(\''+d.id+'\')">اتمام کار</button><button type="button" class="btn btn-reject" onclick="cancelDeal(\''+d.id+'\')">انصراف کار</button></div>';
            }else{
                action='<div class="offer-actions-row"><button type="button" class="btn btn-brand" onclick="routeToDeal(\''+d.id+'\')">مسیریابی</button><button type="button" class="btn btn-reject" onclick="cancelDeal(\''+d.id+'\')">انصراف کار</button></div>';
            }
        }
        return '<div class="mobile-activity-card"><div class="activity-row"><div class="mobile-activity-icon '+service+'">'+serviceCardIcon(service)+'</div><div class="mobile-activity-main"><strong>'+escapeHtml(serviceName(service))+'</strong><span class="activity-meta">'+escapeHtml([city,date,role].filter(Boolean).join(' · '))+'</span></div><div class="mobile-activity-status '+(d.status==='completed'?'completed':'progress')+'">'+(d.status==='completed'?'تمام شده':'توافق شده')+'</div></div><div class="offer-card-price">'+(d.total?formatMoney(d.total):'—')+'</div>'+action+'</div>';
    }).join('');
}
let mobileOrdersSubTab = 'requests';
function setMobileOrdersSubTab(tab){
    const allowed = ['requests','offers','deals'];
    mobileOrdersSubTab = allowed.includes(tab) ? tab : 'requests';
    renderMobileProposals();
}
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
                const sentCount=requestRecipientCount(r.id);
                const actions=(r.status==='pending' || r.status==='created')
                    ? '<div class="offer-actions-row"><button type="button" class="btn btn-reject" onclick="event.stopPropagation();deleteRequest(\''+r.id+'\')">حذف درخواست</button><button type="button" class="btn btn-brand" onclick="event.stopPropagation();editRequest(\''+r.id+'\')">ویرایش درخواست</button></div>'
                    : '';
                const sentNote=sentCount ? '<span class="offer-card-price-unit">'+toPersianDigits(sentCount)+' ماشین‌دار در جریان</span>' : '';
                return '<div class="mobile-activity-card" style="cursor:pointer" onclick="openRequestOffersMap(\''+r.id+'\')">'
                    +'<div class="activity-row"><div class="mobile-activity-icon '+r.service+'">'+serviceCardIcon(r.service)+'</div>'
                    +'<div class="mobile-activity-main"><strong>'+escapeHtml(serviceName(r.service))+'</strong><span class="activity-meta">'+escapeHtml(requestCityName(r))+' · '+escapeHtml(requestDate(r))+(requestAmount(r)?' · '+escapeHtml(requestAmount(r)):'')+'</span></div>'
                    +'<div class="mobile-activity-status '+cls+'">'+escapeHtml(label)+'</div></div>'+sentNote+actions+'</div>';
            }).join('');
        }
    }else if(mobileOrdersSubTab==='offers'){
        bodyHtml=renderMobileOffersList();
    }else{
        bodyHtml=renderMobileDealsList();
    }
    c.innerHTML=tabsHtml+'<div class="mobile-orders-body">'+bodyHtml+'</div>';
}
function collectScheduledItems(){
    if(!currentUser) return [];
    const rows = [];
    db.deals.forEach(d => {
        if(d.userId !== currentUser.id && d.providerId !== currentUser.id) return;
        const req = db.requests.find(r => r.id === d.requestId);
        if(!req) return;
        const start = req.data?.dateStart || req.data?.date;
        const end = req.data?.dateEnd || start;
        if(!start) return;
        const startDate = parseStoredDate(start);
        const endDate = parseStoredDate(end) || startDate;
        if(!startDate) return;
        const role = d.userId === currentUser.id ? 'کشاورز' : 'ارائه‌دهنده';
        const counterparty = d.userId === currentUser.id ? (d.counterparty || 'ارائه‌دهنده') : (req.requesterName || 'کشاورز');
        rows.push({ dealId: d.id, requestId: req.id, service: d.service, start: startDate, end: endDate, role, counterparty, total: d.total || 0 });
    });
    rows.sort((a,b) => a.start - b.start);
    return rows;
}
function daysBetween(a, b){ const ms = 86400000; return Math.round((b - a) / ms) + 1; }
function renderScheduleContent(){
    const items = collectScheduledItems();
    const today = new Date(); today.setHours(0,0,0,0);
    const upcoming = items.filter(it => it.end >= today);
    if(!upcoming.length){
        return '<div class="schedule-empty"><div class="schedule-empty-icon"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg></div><h3 class="schedule-empty-title">کاری در پیش نیست</h3><p class="schedule-empty-desc">از این به بعد کاری در تقویم شما ثبت نشده است.</p></div>';
    }
    return upcoming.map(it => {
        const p = getJalaliParts(it.start);
        const endP = getJalaliParts(it.end);
        const days = daysBetween(it.start, it.end);
        const dayLabel = days > 1 ? (days + ' روز') : 'یک روزه';
        const rangeLabel = days > 1
            ? (toPersianDigits(p.day) + ' ' + JALALI_MONTH_NAMES[p.month-1] + ' تا ' + toPersianDigits(endP.day) + ' ' + JALALI_MONTH_NAMES[endP.month-1])
            : '';
        const meta = escapeHtml(requestDate({ data: { dateStart: localDateToIso(it.start), dateEnd: localDateToIso(it.end) } })) + ' · ' + escapeHtml(it.counterparty);
        const tomorrow = new Date(); tomorrow.setHours(0,0,0,0); tomorrow.setDate(tomorrow.getDate() + 1);
        const isTomorrow = it.start.getTime() === tomorrow.getTime() || (it.start <= tomorrow && it.end >= tomorrow);
        return '<div class="schedule-card">'
            + '<div class="schedule-card-date"><strong>'+toPersianDigits(p.day)+'</strong><span>'+JALALI_MONTH_NAMES[p.month-1]+'</span></div>'
            + '<div class="schedule-card-main">'
            +   '<strong>'+escapeHtml(serviceName(it.service))+'</strong>'
            +   '<small>'+meta+'</small>'
            +   (rangeLabel ? '<small style="margin-top:4px">'+escapeHtml(rangeLabel)+' ('+dayLabel+')</small>' : '')
            +   (isTomorrow ? '<span class="schedule-card-role" style="background:#FBEDD3;color:#B06F0F">⏰ یادآوری: فردا</span>' : '')
            +   '<span class="schedule-card-role">'+escapeHtml(it.role)+'</span>'
            + '</div>'
            + '</div>';
    }).join('');
}
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

function disposeOffersMap(){
    window._keloOffersMapToken = (window._keloOffersMapToken || 0) + 1;
    if(window._keloOffersMap){ try{ window._keloOffersMap.remove(); }catch(e){} window._keloOffersMap = null; }
    window._keloOffersMarkers = {};
}
function goBackFromOffersMap(){
    disposeOffersMap();
    window._keloOffersMarkers = {};
    const prev = window.__keloMobilePreviousTab || 'proposals';
    setMobileTab(prev === 'request-offers' ? 'proposals' : prev);
}
function openRequestLocationMap(requestId){
    if(!currentUser) return;
    const req = db.requests.find(r => r.id === requestId);
    if(!req){ showToast('درخواست پیدا نشد', 'error'); return; }
    disposeOffersMap();
    const mapToken = window._keloOffersMapToken || 0;
    const app = document.getElementById('app');
    if(app){ app.classList.remove('mobile-tab-home','mobile-tab-request','mobile-tab-proposals','mobile-tab-request-offers'); app.classList.add('mobile-tab-request-offers');
    const nav = document.getElementById('mobileBottomNav'); if(nav) nav.classList.add('hidden'); }
    window.__keloMobilePreviousTab = window.__keloMobileTab || 'proposals';
    window.__keloMobileTab = 'request-offers';
    const sb = document.getElementById('sidebar'); if(sb){ sb.innerHTML = ''; }
    const c = document.getElementById('appContent'); if(!c) return;
    c.className = 'content';
    c.innerHTML = '<div class="request-offers-view"><div id="keloOffersMap" class="request-offers-map"></div><button type="button" class="request-offers-back-btn" onclick="goBackFromOffersMap()" aria-label="بازگشت">'+KELO_BACK_CHEVRON_SVG+'</button></div>';
    updateMobileHeader('موقعیت درخواست');
    requestAnimationFrame(() => {
        if(mapToken !== (window._keloOffersMapToken || 0)) return;
        initRequestLocationMap(req);
    });
}
function initRequestLocationMap(req){
    const token = window._keloOffersMapToken || 0;
    const el = document.getElementById('keloOffersMap');
    if(!el || typeof L === 'undefined'){ if(el) el.innerHTML = '<div style="display:grid;place-items:center;height:100%;color:#c0392b;font-weight:700;padding:20px;text-align:center">خطا در بارگذاری نقشه.</div>'; return; }
    if(window._keloOffersMap){ try{ window._keloOffersMap.remove(); }catch(e){} }
    const reqLoc = req.data?.serviceLocation;
    const hasReqLoc = reqLoc && typeof reqLoc.lat === 'number' && typeof reqLoc.lng === 'number';
    const center = hasReqLoc ? [reqLoc.lat, reqLoc.lng] : [36.5659, 53.0586];
    const map = createKeloMap(el, { zoomControl:false, attributionControl:false }, center, 13);
    if(hasReqLoc){ const reqIcon = L.divIcon({ className: 'kelo-req-marker', html: '<div style="width:38px;height:38px;background:#78a83f;border:3px solid #fff;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 4px 12px rgba(0,0,0,.3);position:relative;"><div style="position:absolute;inset:7px;background:#fff;border-radius:50%;"></div></div>', iconSize: [38, 38], iconAnchor: [19, 38] }); L.marker(center, { icon: reqIcon }).addTo(map).bindPopup('<div class="map-card-popup"><strong>📍 موقعیت درخواست</strong><small>'+escapeHtml(serviceName(req.service))+'<br>'+escapeHtml(requestDate(req))+'</small></div>').openPopup(); }
    if(token !== (window._keloOffersMapToken || 0)){ try{ map.remove(); }catch(e){} return; }
    window._keloOffersMap = map;
    requestAnimationFrame(() => { try{ map.invalidateSize(true); }catch(e){} });
    setTimeout(() => { if(token !== (window._keloOffersMapToken || 0)) return; try{ map.invalidateSize(true); }catch(e){} }, 120);
    setTimeout(() => { if(token !== (window._keloOffersMapToken || 0)) return; try{ map.invalidateSize(true); }catch(e){} }, 380);
}
function openRequestOffersMap(requestId){
    if(!currentUser) return;
    const req = db.requests.find(r => r.id === requestId && r.userId === currentUser.id);
    if(!req){ showToast('درخواست پیدا نشد', 'error'); return; }
    disposeOffersMap();
    const mapToken = window._keloOffersMapToken || 0;
    const app = document.getElementById('app');
    if(app){ app.classList.remove('mobile-tab-home','mobile-tab-request','mobile-tab-proposals','mobile-tab-request-offers'); app.classList.add('mobile-tab-request-offers');
        const nav=document.getElementById('mobileBottomNav'); if(nav) nav.classList.add('hidden'); }
    window.__keloMobilePreviousTab = window.__keloMobileTab || 'request';
    window.__keloMobileTab = 'request-offers';
    const sb=document.getElementById('sidebar'); if(sb) sb.innerHTML='';
    const c=document.getElementById('appContent'); if(!c) return;
    c.className='content';

    const candidates = getEligibleProvidersForRequest(req);
    const currentRecipients = db.requestRecipients.filter(x=>x.requestId===req.id);
    const recipientByProvider = {};
    currentRecipients.forEach(x=>{ recipientByProvider[x.providerId]=x; });

    const providersHtml = candidates.length ? candidates.map(o=>{
        const rec=recipientByProvider[o.providerId];
        let action='';
        if(rec && rec.status==='pending'){
            action='<button class="btn offer-item-btn offer-item-btn-sent" disabled>ارسال شد</button>';
        }else if(rec && rec.status==='rejected'){
            action='<button class="btn offer-item-btn offer-item-btn-rejected" disabled>رد شده</button>';
        }else if(req.status==='accepted' || req.status==='agreed' || req.status==='in_progress' || req.status==='completed'){
            action='<button class="btn offer-item-btn offer-item-btn-closed" disabled>توافق شده</button>';
        }else{
            action='<button class="btn btn-brand offer-item-btn" onclick="event.stopPropagation();sendRequestToProvider(\''+o.providerId+'\',\''+req.id+'\')">ارسال کار</button>';
        }
        const service = o.service || req.service;
        const meta = [o.location || '—', (o.rating ? '⭐ ' + toPersianDigits(o.rating) : '')].filter(Boolean).join(' · ');
        const priceLine = o.unitPrice ? formatMoney(o.unitPrice) + (o.priceUnit ? ' · '+escapeHtml(o.priceUnit) : '') : 'توافقی';
        return '<div class="request-offers-list-item" data-offer-id="'+escapeHtml(o.providerId)+'" onclick="focusOfferOnMap(\''+escapeHtml(o.providerId)+'\')">'
            +'<div class="activity-row">'
            +   '<div class="mobile-activity-icon '+service+'">'+serviceCardIcon(service)+'</div>'
            +   '<div class="mobile-activity-main"><strong>'+escapeHtml(o.provider || 'ارائه‌دهنده')+'</strong><span class="activity-meta">'+escapeHtml(meta)+'</span></div>'
            +'</div>'
            +'<div class="offer-card-price">'+priceLine+'</div>'
            +'<div class="offer-actions-row single">'+action+'</div>'
            +'</div>';
    }).join('') : '<div class="mobile-empty-state">ارائه‌دهنده واجد شرایطی برای این درخواست پیدا نشد.</div>';

    c.innerHTML='<div class="request-offers-view"><div id="keloOffersMap" class="request-offers-map"></div><button type="button" class="request-offers-back-btn" onclick="goBackFromOffersMap()" aria-label="بازگشت">'+KELO_BACK_CHEVRON_SVG+'</button><div class="request-offers-sheet" id="requestOffersSheet"><button type="button" class="request-offers-handle"></button><div class="request-offers-sheet-head"><h3>'+escapeHtml(serviceName(req.service))+'</h3><small>'+escapeHtml(requestCityName(req))+' · '+toPersianDigits(candidates.length)+' ارائه‌دهنده واجد شرایط</small></div><div class="request-offers-sheet-body" id="requestOffersSheetBody">'+providersHtml+'</div></div></div>';
    updateMobileHeader('ارائه‌دهندگان خدمت');
    requestAnimationFrame(() => { if(mapToken !== (window._keloOffersMapToken || 0)) return; initOffersMap(req, candidates); });
}
let sheetTouchDrag = null;
function startSheetTouch(e){
    if(document.documentElement.getAttribute('data-viewport') !== 'mobile') return;
    const sheet = e.target.closest('.request-offers-sheet'); if(!sheet) return; const btn = e.target.closest('button, a, input, textarea, select'); if(btn && !btn.classList.contains('request-offers-handle')) return; if(sheetTouchDrag) return; const touch = e.touches && e.touches[0]; if(!touch) return; const body = sheet.querySelector('.request-offers-sheet-body'); const inBody = body && body.contains(e.target); sheetTouchDrag = { sheet, body, inBody, startY: touch.clientY, startHeight: sheet.getBoundingClientRect().height, parentHeight: sheet.parentElement.getBoundingClientRect().height, startScrollTop: body ? body.scrollTop : 0, dragging: false, decided: false }; }
function moveSheetTouch(e){ const d = sheetTouchDrag; if(!d) return; const touch = e.touches && e.touches[0]; if(!touch) return; const dy = touch.clientY - d.startY; if(!d.decided){ if(Math.abs(dy) < 6) return; d.decided = true; if(d.inBody && d.startScrollTop > 0){ sheetTouchDrag = null; return; } d.dragging = true; d.sheet.classList.add('dragging'); } if(d.dragging){ if(e.cancelable) e.preventDefault(); const newH = Math.max(96, Math.min(d.parentHeight * 0.78, d.startHeight - dy)); d.sheet.style.height = newH + 'px'; } }
function endSheetTouch(){ const d = sheetTouchDrag; sheetTouchDrag = null; if(!d || !d.dragging) return; d.sheet.classList.remove('dragging'); const currentH = d.sheet.getBoundingClientRect().height; const ratio = currentH / d.parentHeight; d.sheet.style.height = ''; if(currentH < 160){ d.sheet.classList.add('collapsed'); d.sheet.classList.remove('expanded'); } else if(ratio > 0.50){ d.sheet.classList.add('expanded'); d.sheet.classList.remove('collapsed'); } else { d.sheet.classList.remove('expanded','collapsed'); } setTimeout(function(){ if(window._keloOffersMap){ try{ window._keloOffersMap.invalidateSize(); }catch(e){} } }, 360); }
document.addEventListener('touchstart', startSheetTouch, {passive: true});
document.addEventListener('touchmove', moveSheetTouch, {passive: false});
document.addEventListener('touchend', endSheetTouch);
document.addEventListener('touchcancel', endSheetTouch);
function initOffersMap(req, offers){
    const token = window._keloOffersMapToken || 0;
    const el = document.getElementById('keloOffersMap');
    if(!el || typeof L === 'undefined') return;
    if(window._keloOffersMap){ try{ window._keloOffersMap.remove(); }catch(e){} }
    const reqLoc = req.data?.serviceLocation;
    const hasReqLoc = reqLoc && typeof reqLoc.lat === 'number' && typeof reqLoc.lng === 'number';
    const center = hasReqLoc ? [reqLoc.lat, reqLoc.lng] : [36.5659, 53.0586];
    const zoom = hasReqLoc ? 12 : 9;
    const map = createKeloMap(el, { zoomControl:false, attributionControl:false }, center, zoom);
    window._keloOffersMarkers = {};
    const reqIcon = L.divIcon({ className: 'kelo-req-marker', html: '<div style="width:34px;height:34px;background:#78a83f;border:3px solid #fff;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 4px 12px rgba(0,0,0,.3);position:relative;"><div style="position:absolute;inset:6px;background:#fff;border-radius:50%;"></div></div>', iconSize: [34, 34], iconAnchor: [17, 34] });
    L.marker(center, { icon: reqIcon }).addTo(map).bindPopup('<div class="map-card-popup"><strong>📍 محل درخواست</strong></div>');
    const points = [center];
    offers.forEach((o, idx) => {
        let pos = null;
        if(o.location){ const s = String(o.location).trim(); if(KELO_CITY_COORDS[s]){ pos = KELO_CITY_COORDS[s]; } else { const parts = s.split(/[:\s،,-]+/).map(x=>x.trim()).filter(Boolean); for(const p of parts){ if(KELO_CITY_COORDS[p]){ pos = KELO_CITY_COORDS[p]; break; } } } }
        if(!pos){ const ang = (idx / Math.max(offers.length, 1)) * Math.PI * 2; pos = [center[0] + Math.cos(ang) * 0.015, center[1] + Math.sin(ang) * 0.015]; }
        const offerIcon = L.divIcon({ className: 'kelo-offer-marker', html: '<div style="background:#5B9BB5;border:2.5px solid #fff;border-radius:50%;width:36px;height:36px;display:grid;place-items:center;font-weight:900;font-size:15px;color:#fff;box-shadow:0 4px 12px rgba(0,0,0,.3);">' + toPersianDigits(idx + 1) + '</div>', iconSize: [36, 36], iconAnchor: [18, 18] });
        const marker = L.marker(pos, { icon: offerIcon }).addTo(map);
        marker.bindPopup('<div class="map-card-popup"><strong>' + escapeHtml(o.provider || 'ارائه‌دهنده') + '</strong><small>' + escapeHtml(serviceName(o.service)) + '<br>' + (o.total ? formatMoney(o.total) : 'توافقی') + '</small></div>');
        const markerKey = String(o.providerId);
        marker.on('click', () => { const item = document.querySelector('.request-offers-list-item[data-offer-id="' + markerKey + '"]'); if(item){ item.scrollIntoView({behavior: 'smooth', block: 'center'}); document.querySelectorAll('.request-offers-list-item').forEach(x => x.classList.remove('active')); item.classList.add('active'); } });
        window._keloOffersMarkers[markerKey] = marker;
        points.push(pos);
    });
    if(mapToken !== (window._keloOffersMapToken || 0)){ try{ map.remove(); }catch(e){} return; }
    if(points.length > 1){ try { map.fitBounds(L.latLngBounds(points).pad(0.25)); } catch(e){} }
    window._keloOffersMap = map;
    requestAnimationFrame(() => { try{ map.invalidateSize(true); }catch(e){} });
    setTimeout(() => { if(mapToken !== (window._keloOffersMapToken || 0)) return; try{ map.invalidateSize(true); }catch(e){} }, 120);
    setTimeout(() => { if(mapToken !== (window._keloOffersMapToken || 0)) return; try{ map.invalidateSize(true); }catch(e){} }, 380);
}
function focusOfferOnMap(offerId){
    const marker = window._keloOffersMarkers && window._keloOffersMarkers[offerId];
    if(marker && window._keloOffersMap){ window._keloOffersMap.setView(marker.getLatLng(), Math.max(window._keloOffersMap.getZoom(), 14), { animate: true }); setTimeout(() => { marker.openPopup(); }, 400); }
    document.querySelectorAll('.request-offers-list-item').forEach(el => el.classList.remove('active'));
    const item = document.querySelector('.request-offers-list-item[data-offer-id="' + offerId + '"]');
    if(item) item.classList.add('active');
}
function openMobileNotifications(){
    const pending=db.requestRecipients.filter(o=>o.providerId===currentUser.id && o.status==='pending');
    const list=pending.length?pending.map(o=>'<div class="mobile-activity-card"><div class="activity-row"><div class="mobile-activity-main"><strong>'+escapeHtml(o.provider||'پیشنهاد جدید')+'</strong><span class="activity-meta">'+escapeHtml(serviceName(o.service))+' · '+escapeHtml(o.location||'')+'</span></div><button class="btn btn-primary" style="min-height:40px;padding:6px 12px;font-size:13px" onclick="acceptOffer(\''+o.id+'\')">دیدن</button></div></div>').join(''):'<div class="mobile-empty-state">اعلان جدیدی ندارید.</div>';
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
}
function setMobileSheet(open){ const c=document.getElementById('sidebar'); if(!c)return; c.dataset.mobileSheetOpen=open?'1':'0'; }
function mobileFieldPlaceholder(id,label,type,extra){
    const map={ priceUnit:'واحد قیمت', machineType:'مثلاً کمباین کلاس لکسیون ۶۳۰', capacity:'مثلاً ۴ تن در ساعت', price:'مثلاً 3000000', note:'توضیحات خود را وارد کنید', serviceLocation:'موقعیت زمین', activityArea:'محدوده فعالیت', dateStart:'تاریخ شروع', dateEnd:'تاریخ پایان', area:'مساحت' };
    return map[id] || (type==='textarea'?'توضیحات':label);
}
function renderAreaSliderField(id, label, config){
    const value = Number(wizard.data[id]) || config.default || 1;
    const unit = config.unit || 'واحد';
    return '<div class="sidebar-field slider-field"><label>' + label + ' <span style="color:red">*</span></label><div class="slider-value-row"><span class="slider-value-display">' + toPersianDigits(value) + '</span><span class="slider-unit">' + unit + '</span></div><input type="range" data-slider-id="' + id + '" min="' + config.min + '" max="' + config.max + '" step="' + config.step + '" value="' + value + '" oninput="updateAreaSlider(\'' + id + '\', this.value)"><div class="slider-bounds"><span>' + toPersianDigits(config.min) + ' ' + unit + '</span><span>' + toPersianDigits(config.max) + ' ' + unit + '</span></div></div>';
}
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
function renderMobileSelectField(id,label,options,required){
    const value=wizard.data[id]||'';
    const placeholder=mobileFieldPlaceholder(id,label,'select');
    return '<div class="sidebar-field"><label>'+escapeHtml(label)+(required?' <span style="color:red">*</span>':'')+'</label><button type="button" class="mobile-choice-trigger" onclick="openMobileSelect(\''+escapeHtml(id)+'\')"><span class="'+(value?'':'placeholder')+'">'+escapeHtml(value||placeholder)+'</span><span class="kelo-inline-chevron"><i class="kelo-chevron left"></i></span></button></div>';
}
function openMobileSelect(id){
    const field = mobileL2Fields().find(f=>f[0]===id); if(!field) return;
    const options = field[3]; const value = wizard.data[id]||'';
    const opt = options.map(o=>'<button type="button" class="mobile-chip '+(value===o?'active':'')+'" style="min-height:48px;padding:12px 20px;font-size:15px" onclick="chooseMobileSelect(\''+escapeHtml(id)+'\',\''+escapeHtml(o)+'\')">'+escapeHtml(o)+'</button>').join('');
    const html = '<button type="button" class="mobile-sheet-handle"></button><div class="mobile-sheet-header"><button type="button" class="mobile-sheet-back-btn" onclick="closeMobileSelectSheet()" aria-label="بازگشت">'+KELO_BACK_CHEVRON_SVG+'</button><h2>'+escapeHtml(field[1])+'</h2><span></span></div><div class="mobile-sheet-body"><div class="mobile-chip-group">'+opt+'</div></div>';
    let backdrop = document.getElementById('keloSelectSheet');
    if(!backdrop){ backdrop = document.createElement('div'); backdrop.id='keloSelectSheet'; backdrop.className='mobile-sheet-backdrop level3'; document.body.appendChild(backdrop); }
    backdrop.innerHTML = '<div class="mobile-sheet picker">'+html+'</div>';
}
function closeMobileSelectSheet(){ const el=document.getElementById('keloSelectSheet'); if(el) el.remove(); }
function chooseMobileSelect(id,value){ wizard.data[id]=value; clearFieldError(id); saveWizardDraftDebounced(); closeMobileSelectSheet(); if(wizard.formSheetOpen) renderMobileFormSheet(); }
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
function renderMobilePhotoUpload(id,label){
    const photos = Array.isArray(wizard.data[id]) ? wizard.data[id] : [];
    const boxes = photos.map(function(p, idx){ return '<div class="mobile-photo-box" style="background:#fff;border-style:solid"><img class="mobile-photo-preview" src="' + escapeHtml(p.preview||'') + '" alt=""><button type="button" class="mobile-photo-remove" onclick="removeMobilePhoto(\''+id+'\','+idx+')">×</button></div>'; }).join('');
    const addBox = '<button type="button" class="mobile-photo-box" onclick="openMobilePhotoPicker(\''+id+'\')"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg><span class="label">افزودن</span></button>';
    return '<div class="sidebar-field"><label>' + escapeHtml(label) + '</label><div class="mobile-photo-upload-grid">' + boxes + addBox + '</div><div class="mobile-photo-hint">تصویر تجهیزات یا شرایط را اضافه کنید. حداکثر ۸ عکس.</div><input type="file" accept="image/*" multiple class="mobile-photo-input" id="photoInput_'+id+'" onchange="handleMobilePhotoSelect(\''+id+'\', this)"></div>';
}
function openMobilePhotoPicker(id){ const input = document.getElementById('photoInput_'+id); if(input) input.click(); }
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
function removeMobilePhoto(id, index){ if(!Array.isArray(wizard.data[id])) return; wizard.data[id].splice(index, 1); saveWizardDraftDebounced(); renderMobileFormSheet(); }
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
function renderMapLocationField(id,label,req,help,mobile){
    const loc=wizard.data[id]; const has=loc && typeof loc.lat==='number' && typeof loc.lng==='number';
    if(mobile){
        const inner = has
            ? '<div class="mobile-inline-map-preview" id="inlineMap_'+escapeHtml(id)+'"></div>'
            : '<div class="mobile-inline-map-inner"><svg viewBox="0 0 24 24"><path d="M12 22s-8-7.5-8-13a8 8 0 1 1 16 0c0 5.5-8 13-8 13z"/><circle cx="12" cy="9" r="3" fill="#fff"/></svg><span class="mobile-inline-map-text">انتخاب موقعیت روی نقشه</span></div>';
        return '<div class="sidebar-field map-location-field-mobile"><label>'+escapeHtml(label)+(req?' <span style="color:red">*</span>':'')+'</label><button type="button" class="mobile-inline-map" onclick="activateMapPicker()" aria-label="باز کردن نقشه">'+inner+'</button><div class="mobile-inline-map-value">'+(has?'✓ موقعیت زمین انتخاب شد':'روی نقشه ضربه بزنید و موقعیت زمین را مشخص کنید')+'</div></div>';
    }
    return '<div class="sidebar-field"><label>'+label+(req?' <span style="color:red">*</span>':'')+'</label><div class="sidebar-map-action"><div><strong>'+(has?'✓ انتخاب شده':'📍 محل زمین')+'</strong></div><button type="button" class="btn btn-outline" onclick="activateMapPicker()">'+(has?'تغییر':'انتخاب')+'</button></div></div>';
}
function initializeInlineLocationMap(){
    const el=document.getElementById('inlineMap_serviceLocation');
    if(!el || typeof L==='undefined') return;
    if(window._keloInlineMap){ try{window._keloInlineMap.remove();}catch(e){} }
    const loc=wizard.data.serviceLocation;
    const center=loc&&typeof loc.lat==='number' ? [loc.lat,loc.lng] : [36.5659,53.0586];
    const zoom=loc&&typeof loc.lat==='number' ? 14 : 9;
    const map=createKeloMap(el,{zoomControl:false,attributionControl:false,dragging:false,scrollWheelZoom:false,doubleClickZoom:false,boxZoom:false,touchZoom:false},center,zoom);
    if(loc&&typeof loc.lat==='number') L.marker([loc.lat,loc.lng]).addTo(map);
    window._keloInlineMap=map;
    setTimeout(()=>map.invalidateSize(),50);
}
function openMobileMapPickerOverlay(){
    clearKeloPickerGpsVisuals();
    const existing = document.getElementById('keloMobileMapPickerOverlay');
    if(existing) existing.remove();
    const overlay = document.createElement('div');
    overlay.id = 'keloMobileMapPickerOverlay';
    overlay.className = 'mobile-location-picker-backdrop';
    const pinSvg = '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 22s-8-7.5-8-13a8 8 0 1 1 16 0c0 5.5-8 13-8 13z"/><circle cx="12" cy="9" r="3" fill="#fff"/></svg>';
    const gpsSvg = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="8"/></svg>';
    const isBrandMode = !!wizard._profileMapMode;
    const confirmBtnClass = isBrandMode ? 'btn is-brand' : 'btn';
    overlay.innerHTML = '<div class="mobile-location-picker-sheet"><div class="mobile-location-picker-head"><button type="button" id="keloMapPickerClose" aria-label="بازگشت" style="justify-self:end">'+KELO_BACK_CHEVRON_SVG+'</button><strong>انتخاب موقعیت زمین</strong><span></span></div><div class="mobile-location-picker-map-wrap"><div id="mobileLocationPickerMap"></div><div class="kelo-map-city-chip" id="keloMapCityChip"></div><div class="kelo-map-search-wrap"><div class="kelo-map-search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><input type="text" id="keloMapSearchInput" placeholder="جستجوی شهر یا آدرس..."></div></div><div class="kelo-map-center-pin">'+pinSvg+'</div><button type="button" class="kelo-map-gps-btn" id="keloMapGpsBtn" aria-label="موقعیت من">'+gpsSvg+'</button></div><div class="mobile-location-picker-footer"><button type="button" class="'+confirmBtnClass+'" id="keloMapPickerConfirmBtn">'+pinSvg+'<span>تأیید موقعیت</span></button></div></div>';
    document.body.appendChild(overlay);
    document.getElementById('keloMapPickerClose').addEventListener('click', closeMobileLocationPicker);
    document.getElementById('keloMapPickerConfirmBtn').addEventListener('click', confirmMobileLocationPicker);
    document.getElementById('keloMapGpsBtn').addEventListener('click', useMyLocationForPicker);
    const searchInput = document.getElementById('keloMapSearchInput');
    if(searchInput){
        let searchTimer = null;
        searchInput.addEventListener('input', function(){
            clearTimeout(searchTimer);
            const q = this.value.trim();
            if(q.length < 3) return;
            searchTimer = setTimeout(() => geocodeMapSearch(q), 600);
        });
    }
    document.body.style.overflow = 'hidden';
    setTimeout(function(){ initializeMobileLocationPicker(); }, 80);
}
let keloNominatimLastRequestAt = 0;
let keloNominatimQueueTimer = null;
let keloNominatimController = null;
function geocodeMapSearch(query){
    if(!window._keloMobilePickerMap) return;
    const normalized = String(query || '').trim();
    if(normalized.length < 3) return;
    const cacheKey = 'kelo_nominatim_' + normalized.toLowerCase();
    try{
        const cached = localStorage.getItem(cacheKey);
        if(cached){
            const data = JSON.parse(cached);
            if(data && data.length){
                const lat = parseFloat(data[0].lat), lng = parseFloat(data[0].lon);
                if(Number.isFinite(lat) && Number.isFinite(lng) && window._keloMobilePickerMap){
                    window._keloMobilePickerMap.setView([lat, lng], 15);
                    wizard._pendingMapPoint = { lat: lat, lng: lng };
                    updateMobilePickerFooter();
                    return;
                }
            }
        }
    }catch(e){}

    const wait = Math.max(0, 1100 - (Date.now() - keloNominatimLastRequestAt));
    clearTimeout(keloNominatimQueueTimer);
    keloNominatimQueueTimer = setTimeout(function(){
        if(!window._keloMobilePickerMap) return;
        keloNominatimLastRequestAt = Date.now();
        if(keloNominatimController){ try{ keloNominatimController.abort(); }catch(e){} }
        keloNominatimController = (typeof AbortController !== 'undefined') ? new AbortController() : null;
        const url='https://nominatim.openstreetmap.org/search?format=json&accept-language=fa&limit=1&q=' + encodeURIComponent(normalized);
        fetch(url, keloNominatimController ? {signal:keloNominatimController.signal} : undefined)
            .then(r => { if(!r.ok) throw new Error('Nominatim HTTP '+r.status); return r.json(); })
            .then(data => {
                if(data && data.length){
                    const lat = parseFloat(data[0].lat), lng = parseFloat(data[0].lon);
                    if(Number.isFinite(lat) && Number.isFinite(lng) && window._keloMobilePickerMap){
                        try{ localStorage.setItem(cacheKey, JSON.stringify(data)); }catch(e){}
                        window._keloMobilePickerMap.setView([lat, lng], 15);
                        wizard._pendingMapPoint = { lat: lat, lng: lng };
                        updateMobilePickerFooter();
                    }
                }
            })
            .catch(err => { if(err && err.name !== 'AbortError') console.warn('KELO geocode failed:', err); });
    }, wait);
}
function getKeloCurrentPosition(onSuccess, onError){
    if(!navigator.geolocation){
        if(onError) onError({code:0, message:'Geolocation is not supported'});
        return;
    }
    const fail = typeof onError === 'function' ? onError : function(){};
    const success = typeof onSuccess === 'function' ? onSuccess : function(){};
    let retried = false;
    const run = opts => navigator.geolocation.getCurrentPosition(success, function(err){
        if(!retried && (err && (err.code===2 || err.code===3))){
            retried = true;
            navigator.geolocation.getCurrentPosition(success, fail, {enableHighAccuracy:true, timeout:15000, maximumAge:0});
            return;
        }
        fail(err);
    }, opts);
    run({enableHighAccuracy:false, timeout:12000, maximumAge:0});
}
function clearKeloPickerGpsVisuals(){
    if(window._keloPickerGpsMarker){ try{ window._keloPickerGpsMarker.remove(); }catch(e){} window._keloPickerGpsMarker=null; }
    if(window._keloPickerGpsAccuracy){ try{ window._keloPickerGpsAccuracy.remove(); }catch(e){} window._keloPickerGpsAccuracy=null; }
}
function updateKeloPickerCityChip(lat,lng){
    const chip=document.getElementById('keloMapCityChip');
    if(!chip) return;
    const city=nearestCityFromCoords(Number(lat),Number(lng));
    const province=provinceFromCity(city);
    if(city && province){ chip.textContent=city+'، '+province; chip.style.display='inline-flex'; }
    else { chip.textContent=''; chip.style.display='none'; }
}
function useMyLocationForPicker(){
    if(!window._keloMobilePickerMap || !navigator.geolocation){
        showToast('مرورگر شما از موقعیت مکانی پشتیبانی نمی‌کند.','error');
        return;
    }
    const btn=document.getElementById('keloMapGpsBtn');
    const restoreButton=function(){ if(btn){ btn.disabled=false; btn.style.opacity=''; } };
    if(btn){ btn.disabled=true; btn.style.opacity='.55'; }
    getKeloCurrentPosition(function(pos){
        restoreButton();
        const lat=Number(pos.coords.latitude), lng=Number(pos.coords.longitude);
        const accuracy=Number(pos.coords.accuracy)||0;
        if(!Number.isFinite(lat)||!Number.isFinite(lng)||!window._keloMobilePickerMap) return;
        clearKeloPickerGpsVisuals();
        window._keloPickerGpsAccuracy=L.circle([lat,lng],{radius:accuracy||35,color:'#4A9DB8',weight:1,fillColor:'#4A9DB8',fillOpacity:.12}).addTo(window._keloMobilePickerMap);
        window._keloPickerGpsMarker=L.circleMarker([lat,lng],{radius:8,color:'#fff',weight:3,fillColor:'#4A9DB8',fillOpacity:1}).addTo(window._keloMobilePickerMap).bindPopup('<div class="map-card-popup"><strong>📍 موقعیت فعلی شما</strong></div>');
        window._keloMobilePickerMap.setView([lat,lng],16,{animate:true});
        wizard._pendingMapPoint={lat,lng};
        updateKeloPickerCityChip(lat,lng);
        updateMobilePickerFooter();
    },function(err){
        restoreButton();
        let msg='دسترسی به موقعیت ممکن نبود.';
        if(err && err.code===1) msg='دسترسی موقعیت مکانی رد شده است؛ مجوز Location را برای سایت فعال کنید.';
        else if(err && err.code===2) msg='موقعیت مکانی قابل تشخیص نیست. GPS یا Location را روشن کنید.';
        else if(err && err.code===3) msg='دریافت موقعیت بیش از حد طول کشید. دوباره امتحان کنید.';
        showToast(msg,'error');
    });
}
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
function closeMobileMapPickerOverlay(){
    if(keloNominatimQueueTimer){ clearTimeout(keloNominatimQueueTimer); keloNominatimQueueTimer=null; }
    if(keloNominatimController){ try{ keloNominatimController.abort(); }catch(e){} keloNominatimController=null; }
    const overlay = document.getElementById('keloMobileMapPickerOverlay');
    if(overlay) overlay.remove();
    if(window._keloMobilePickerMap){ try{ window._keloMobilePickerMap.remove(); }catch(e){} window._keloMobilePickerMap = null; }
    clearKeloPickerGpsVisuals();
    document.body.style.overflow = '';
}
function updateMobilePickerFooter(){
    const btn = document.getElementById('keloMapPickerConfirmBtn');
    if(!btn) return;
    btn.disabled = !wizard._pendingMapPoint;
}
function initializeMobileLocationPicker(){
    const el = document.getElementById('mobileLocationPickerMap');
    if(!el || typeof L === 'undefined') return;
    if(window._keloMobilePickerMap){ try{ window._keloMobilePickerMap.remove(); }catch(e){} window._keloMobilePickerMap = null; }
    const loc = wizard._pendingMapPoint || wizard.data.serviceLocation;
    const hasLoc = loc && typeof loc.lat === 'number' && typeof loc.lng === 'number';
    const center = hasLoc ? [loc.lat, loc.lng] : [36.5659, 53.0586];
    const zoom = hasLoc ? 15 : 10;
    const map = createKeloMap(el, { zoomControl:false, attributionControl:false }, center, zoom);
    if(hasLoc) wizard._pendingMapPoint = { lat: loc.lat, lng: loc.lng };
    else wizard._pendingMapPoint = { lat: center[0], lng: center[1] };
    map.on('move', function(){ const c = map.getCenter(); wizard._pendingMapPoint = { lat: c.lat, lng: c.lng }; updateKeloPickerCityChip(c.lat,c.lng); });
    map.on('moveend', updateMobilePickerFooter);
    map.whenReady(function(){
        const c = map.getCenter();
        wizard._pendingMapPoint = { lat: c.lat, lng: c.lng };
        updateKeloPickerCityChip(c.lat,c.lng);
        updateMobilePickerFooter();
    });
    window._keloMobilePickerMap = map;
    setTimeout(function(){ try{ map.invalidateSize(); }catch(e){} }, 100);
    setTimeout(function(){ try{ map.invalidateSize(); }catch(e){} }, 350);
    updateMobilePickerFooter();
}
function activateMapPicker(){
    wizard.mapPickMode = true;
    wizard._pendingMapPoint = wizard.data.serviceLocation ? cloneObject(wizard.data.serviceLocation) : null;
    openMobileMapPickerOverlay();
}
function closeMobileLocationPicker(){
    wizard.mapPickMode = false;
    wizard._profileMapMode = false;
    wizard._pendingMapPoint = null;
    closeMobileMapPickerOverlay();
    if(wizard.formSheetOpen){ renderMobileFormSheet(); } else { renderWizard(); }
}
function confirmMobileLocationPicker(){
    if(wizard._pendingMapPoint && typeof wizard._pendingMapPoint.lat === 'number'){
        if(wizard._profileMapMode){
            const mode = wizard._profileMapMode;
            const nearest = nearestCityFromCoords(wizard._pendingMapPoint.lat, wizard._pendingMapPoint.lng);
            const province = provinceFromCity(nearest);
            wizard._pendingProfileLocation = Object.assign({}, wizard._pendingMapPoint, { city: nearest, province: province });
            wizard._profileMapMode = false;
            wizard._pendingMapPoint = null;
            closeMobileMapPickerOverlay();
            if(mode === 'first'){
                showCompleteProfile();
            } else if(document.getElementById('mobileAccountSheet')){
                renderMobileAccountSection('edit');
            }
            return;
        } else {
            wizard.data.serviceLocation = Object.assign({}, wizard._pendingMapPoint, {source:'map'});
        }
    }
    wizard.mapPickMode = false;
    wizard._pendingMapPoint = null;
    closeMobileMapPickerOverlay();
    clearFieldError('serviceLocation');
    saveWizardDraft();
    if(wizard.formSheetOpen){ renderMobileFormSheet(); } else { renderWizard(); }
}
function useMapLocation(lat,lng){wizard.data.serviceLocation={lat:Number(lat),lng:Number(lng),source:'map'};wizard.mapPickMode=false;wizard._pendingMapPoint=null;renderWizard();}
function createKeloMap(el, options={}, center=null, zoom=null){
    if(!el || typeof L === 'undefined') return null;

    // Keep the existing map callers/options intact. Use the official OSM
    // raster tiles when the app is hosted normally, but provide a safe raster
    // fallback for local file:// testing and for environments that block the
    // OSM tile request before the page can render. Attribution stays visible.
    const opts = Object.assign({}, options || {}, { attributionControl: true });
    if(center){ opts.center = center; }
    if(zoom !== null && zoom !== undefined){ opts.zoom = zoom; }

    const map = L.map(el, opts);
    const osmUrl='https://tile.openstreetmap.org/{z}/{x}/{y}.png';
    const cartoUrl='https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
    const osmAttribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>';
    const cartoAttribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a> &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener noreferrer">CARTO</a>';

    let layer;
    let fallbackStarted=false;
    let errorWindowStart=0;
    let errorCount=0;

    const addCartoFallback=function(){
        if(fallbackStarted) return;
        fallbackStarted=true;
        try{ if(layer) map.removeLayer(layer); }catch(e){}
        layer=L.tileLayer(cartoUrl,{
            maxZoom:19,
            subdomains:'abcd',
            detectRetina:true,
            attribution:cartoAttribution
        }).addTo(map);
    };

    const isLocalFile = typeof window !== 'undefined' && window.location && window.location.protocol === 'file:';
    if(isLocalFile){
        addCartoFallback();
    }else{
        layer=L.tileLayer(osmUrl,{
            maxZoom:19,
            maxNativeZoom:19,
            detectRetina:true,
            attribution:osmAttribution,
            referrerPolicy:'strict-origin-when-cross-origin'
        }).addTo(map);
        layer.on('tileerror',function(){
            if(fallbackStarted) return;
            const now=Date.now();
            if(!errorWindowStart || now-errorWindowStart>2500){ errorWindowStart=now; errorCount=0; }
            errorCount++;
            if(errorCount>=3) addCartoFallback();
        });
    }
    return map;
}

function ensureKeloMapView(map, center, zoom){
    if(!map || !center) return;
    if(typeof map.setView === 'function') map.setView(center, zoom ?? map.getZoom?.() ?? 13);
}

let keloMap=null,keloUserMarker=null,keloAccuracy=null,keloPickMarker=null,keloLocationWatch=null;
const KELO_CITY_COORDS={'ساری':[36.5659,53.0586],'جویبار':[36.6412,52.9120],'بابل':[36.5513,52.6789],'آمل':[36.4696,52.3507],'قائم‌شهر':[36.4630,52.8610],'قائمشهر':[36.4630,52.8610],'بابلسر':[36.7025,52.6576],'بهشهر':[36.6926,53.5526],'نوشهر':[36.6489,51.4960],'چالوس':[36.6550,51.4200],'رامسر':[36.9198,50.6446],'رشت':[37.2808,49.5832],'لاهیجان':[37.2070,50.0039],'لنگرود':[37.1964,50.1531],'آستارا':[38.4291,48.8720],'بندر انزلی':[37.4714,49.4597],'انزلی':[37.4714,49.4597],'رودسر':[37.1370,50.2859],'رودبار':[36.8240,49.4222],'آستانه اشرفیه':[37.2595,49.9444],'فریدون‌کنار':[36.6850,52.5210],'فریدونکنار':[36.6850,52.5210]};
function coordForCity(city){return KELO_CITY_COORDS[city]||[36.5659,53.0586];}
function geoDistanceKm(a,b){ if(!a||!b)return Infinity; const toRad=x=>x*Math.PI/180, R=6371; const dLat=toRad(b[0]-a[0]), dLng=toRad(b[1]-a[1]); const s=Math.sin(dLat/2)**2+Math.cos(toRad(a[0]))*Math.cos(toRad(b[0]))*Math.sin(dLng/2)**2; return 2*R*Math.asin(Math.sqrt(s)); }
function requestMatchesActivityArea(request,area){ if(!Array.isArray(area)||!area.length)return false; const reqLoc=request?.data?.serviceLocation; let reqPoint=reqLoc?.lat?[reqLoc.lat,reqLoc.lng]:null; if(!reqPoint && request?.data?.city) reqPoint=coordForCity(request.data.city); if(!reqPoint) return true; return area.some(row=>{ const cities=row.all?(KELO_GEOGRAPHY[row.province]||[]):(row.cities||[]); if(!cities.length) return true; return cities.some(city=>geoDistanceKm(reqPoint,coordForCity(city))<=50); }); }
function initializeKeloMap(){
    const el=document.getElementById('keloMap'); if(!el) return;
    if(typeof L==='undefined'){ el.innerHTML = '<div style="display:grid;place-items:center;height:100%;color:#c0392b;font-weight:700;padding:20px;text-align:center">خطا در بارگذاری نقشه</div>'; return; }
    if(keloLocationWatch!==null && navigator.geolocation){ try{navigator.geolocation.clearWatch(keloLocationWatch);}catch(e){} }
    keloLocationWatch=null; keloUserMarker=null; keloAccuracy=null; keloPickMarker=null; window._keloUserCentered=false;
    if(keloMap){keloMap.remove();keloMap=null;}
    keloMap=createKeloMap(el,{zoomControl:true},[32.4279,53.6880],5);
    if(!keloMap) return;
    if(mapContext?.target?.lat)keloMap.setView([mapContext.target.lat,mapContext.target.lng],12);
    if(wizard.mapPickMode)keloMap.on('click',e=>useMapLocation(e.latlng.lat,e.latlng.lng));
    renderMapContextMarkers();
    if(!mapContext?.target?.lat && navigator.geolocation){
        navigator.geolocation.getCurrentPosition(function(pos){
            const lat=Number(pos.coords.latitude), lng=Number(pos.coords.longitude);
            if(!Number.isFinite(lat)||!Number.isFinite(lng)||!keloMap) return;
            if(keloUserMarker){try{keloUserMarker.remove();}catch(e){}}
            keloUserMarker=L.circleMarker([lat,lng],{radius:8,color:'#fff',weight:3,fillColor:'#4A9DB8',fillOpacity:1}).addTo(keloMap)
                .bindPopup('<div class="map-card-popup"><strong>📍 موقعیت شما</strong></div>');
            keloMap.setView([lat,lng],14,{animate:true});
            window._keloUserCentered=true;
        },function(err){ console.warn('Geolocation unavailable',err); },{enableHighAccuracy:true,timeout:8000,maximumAge:60000});
    }
    requestAnimationFrame(()=>{ try{keloMap.invalidateSize(true);}catch(e){} });
    setTimeout(()=>{ try{keloMap.invalidateSize(true);}catch(e){} },250);
}

function renderMapContextMarkers(){
    if(!keloMap)return;
    if(mapContext?.target?.lat)L.marker([mapContext.target.lat,mapContext.target.lng]).addTo(keloMap).bindPopup('<div class="map-card-popup"><strong>📍 محل خدمت</strong></div>').openPopup();
    if(mapContext?.type==='receive'){ db.machines.filter(m=>m.services&&m.services[mapContext.service]!==undefined).forEach((m)=>{const pos=coordForCity(m.location);L.marker(pos).addTo(keloMap).bindPopup('<div class="map-card-popup"><strong>🚜 '+escapeHtml(m.owner)+'</strong></div>');}); }
    else if(mapContext?.type==='provide'){ db.requests.filter(r=>r.status==='pending'&&r.service===mapContext.service&&r.userId!==currentUser.id&&requestMatchesActivityArea(r,mapContext.activityArea||[])).forEach(r=>{let pos=r.data?.serviceLocation?.lat?[r.data.serviceLocation.lat,r.data.serviceLocation.lng]:coordForCity(r.data?.city||'ساری');L.circleMarker(pos,{radius:8,color:'#fff',weight:3,fillColor:'#d7aa43',fillOpacity:1}).addTo(keloMap).bindPopup('<div class="map-card-popup"><strong>👨‍🌾 '+escapeHtml(serviceName(r.service))+'</strong></div>');}); }
}
const JALALI_MONTH_NAMES=['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
const JALALI_WEEK_NAMES=['شنبه','یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه'];
const jalaliPartsFormatter=new Intl.DateTimeFormat('en-US-u-ca-persian-nu-latn',{year:'numeric',month:'numeric',day:'numeric'});
const jalaliDateCache=new Map();
function getJalaliParts(date){ const parts=jalaliPartsFormatter.formatToParts(date).reduce((o,p)=>{ if(['year','month','day'].includes(p.type))o[p.type]=Number(p.value); return o; },{}); return {year:parts.year,month:parts.month,day:parts.day}; }
function localDateToIso(date){ const y=date.getFullYear(),m=String(date.getMonth()+1).padStart(2,'0'),d=String(date.getDate()).padStart(2,'0'); return y+'-'+m+'-'+d; }
function isoToLocalDate(iso){ if(!(typeof iso==='string' && /^\d{4}-\d{2}-\d{2}$/.test(iso)))return null; const p=iso.split('-').map(Number); return new Date(p[0],p[1]-1,p[2],12); }
function parseStoredDate(value){ if(typeof value!=='string')return null; const n=normalizeDigits(value).trim(); if(/^\d{4}-\d{2}-\d{2}$/.test(n))return isoToLocalDate(n); const m=n.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/); if(m){ const y=Number(m[1]),mo=Number(m[2]),d=Number(m[3]); if(y>=1300 && y<1600) return jalaliToDate(y,mo,d); } return null; }
function jalaliToDate(jy,jm,jd){ const key=jy+'/'+jm+'/'+jd; if(jalaliDateCache.has(key))return new Date(jalaliDateCache.get(key)); const approx=new Date(jy+621,0,1,12); for(let offset=-370;offset<=370;offset++){ const candidate=new Date(approx); candidate.setDate(approx.getDate()+offset); const p=getJalaliParts(candidate); if(p.year===jy && p.month===jm && p.day===jd){ jalaliDateCache.set(key,candidate.getTime()); return candidate; } } return null; }
function getJalaliMonthLength(year,month){ if(month<=6)return 31; if(month<=11)return 30; const start=jalaliToDate(year,12,1), next=jalaliToDate(year+1,1,1); return Math.round((next-start)/86400000); }
function shiftJalaliMonth(year,month,delta){ let m=month+delta,y=year; while(m<1){m+=12;y--;} while(m>12){m-=12;y++;} return {year:y,month:m}; }
function jalaliIsoFromParts(y,m,d){ const dt=jalaliToDate(y,m,d); return dt?localDateToIso(dt):''; }
function humanJalaliDate(value){ const date=parseStoredDate(value); if(!date)return String(value||''); const p=getJalaliParts(date); return toPersianDigits(p.day)+' '+JALALI_MONTH_NAMES[p.month-1]+' '+toPersianDigits(p.year); }
function jalaliSelectedValue(id,multi){ const value=wizard.data[id]; if(multi)return Array.isArray(value)?value:[]; return typeof value==='string'?value:''; }
function computeCalendarMinIso(id){
    const today = localDateToIso(new Date());
    if(id === 'dateEnd'){ const startVal = wizard.data['dateStart']; if(startVal && /^\d{4}-\d{2}-\d{2}$/.test(startVal)) return startVal; }
    return today;
}
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
function changeJalaliMonth(delta){
    const next=shiftJalaliMonth(wizard.calendarYear,wizard.calendarMonth,delta);
    wizard.calendarYear=next.year; wizard.calendarMonth=next.month;
    if(wizard.formSheetOpen){ renderCalendarModal(); } else { renderWizard(); }
}
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
function confirmJalaliPicker(event){ if(event){event.preventDefault();event.stopPropagation();} wizard.calendarOpen=false; wizard.calendarId=''; wizard.calendarRangeStart=null; if(wizard.formSheetOpen){ const m=document.getElementById('keloCalendarModal'); if(m) m.remove(); renderMobileFormSheet(); } else { renderWizard(); } }
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
function renderJalaliDateField(id,label,req,help,multi,mobile){
    const open=wizard.calendarOpen && wizard.calendarId===id;
    const value=wizard.data[id];
    const display=value?humanJalaliDate(value):'';
    return '<div class="sidebar-field jalali-date-field '+(open?'open':'')+'">'+(mobile?'':'<label>'+label+(req?' <span style="color:red">*</span>':'')+'</label>')+'<button type="button" class="jalali-date-trigger" onclick="toggleJalaliPicker(\''+escapeHtml(id)+'\','+(multi?'true':'false')+');return false;"><span class="'+(display?'date-value':'placeholder')+'">'+escapeHtml(display || 'انتخاب کنید')+'</span><span class="date-arrow"><i class="kelo-chevron down"></i></span></button>'+(open&&!mobile?renderJalaliCalendar(id,multi,help):'')+'</div>';
}
const KELO_GEOGRAPHY={"مازندران":["آمل","بابل","بابلسر","بهشهر","تنکابن","جویبار","چالوس","رامسر","ساری","سوادکوه","سوادکوه شمالی","سیمرغ","عباس‌آباد","فریدون‌کنار","قائم‌شهر","کلاردشت","گلوگاه","محمودآباد","میاندورود","نکا","نور","نوشهر"],"گیلان":["آستانه اشرفیه","آستارا","املش","بندر انزلی","رشت","رضوانشهر","رودبار","رودسر","سیاهکل","شفت","صومعه‌سرا","طوالش","فومن","لاهیجان","لنگرود","ماسال"]};
function getActivityAreaRows(){ return Array.isArray(wizard.data.activityArea) ? wizard.data.activityArea.map(x=>cloneObject(x)) : []; }
function activitySelectionCount(){ return getActivityAreaRows().reduce((sum,row)=>sum + (row.all ? 1 : (Array.isArray(row.cities)?row.cities.length:0)),0); }
function activityProvinceHasSelection(province){ return !!getActivityAreaRows().find(x=>x.province===province); }

function renderActivityAreaField(id, label, req, mobile){
    const selectedCount = activitySelectionCount();
    const triggerValue = selectedCount > 0
        ? '<span class="trigger-count">'+toPersianDigits(selectedCount)+' مورد</span>'
        : '<span class="trigger-placeholder">محدوده فعالیت</span>';
    return '<div class="sidebar-field"><label>'+escapeHtml(label)+(req?' <span style="color:red">*</span>':'')+'</label><button type="button" class="mobile-choice-trigger" onclick="openActivityAreaSheet()"><span style="display:flex;align-items:center;gap:6px;flex:1;min-width:0">'+triggerValue+'</span><span class="kelo-inline-chevron"><i class="kelo-chevron left"></i></span></button></div>';
}
function isActivitySheetOpen(){ return !!document.getElementById('keloActivityAreaSheet'); }
function refreshActivityAreaUI(){
    if(isActivitySheetOpen()){ renderActivityAreaSheet(); }
    else if(wizard.formSheetOpen){ renderMobileFormSheet(); }
    else { renderWizard(); }
}
function openActivityAreaSheet(){
    wizard.activityProvince = '';
    wizard.activitySearch = '';
    wizard.activityOpen = true;
    renderActivityAreaSheet();
}
function closeActivityAreaSheet(){
    wizard.activityOpen = false;
    wizard.activityProvince = '';
    wizard.activitySearch = '';
    const el = document.getElementById('keloActivityAreaSheet');
    if(el) el.remove();
    if(wizard.formSheetOpen) renderMobileFormSheet();
}
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
function renderActivityProvinceOptions(query){
    const q=String(query||'').trim().toLowerCase();
    return Object.entries(KELO_GEOGRAPHY).filter(([p])=>!q || p.toLowerCase().includes(q)).map(([province,cities])=>{ const has=activityProvinceHasSelection(province); return '<button type="button" class="activity-province-option" onclick="chooseActivityProvince(\''+escapeHtml(province)+'\')"><span>'+escapeHtml(province)+'</span><span class="province-count">'+(has?'✓ ':'')+toPersianDigits(cities.length)+' شهرستان</span></button>'; }).join('') || '<div class="activity-empty">استانی پیدا نشد.</div>';
}
function chooseActivityProvince(province){ wizard.activityProvince=province; wizard.activitySearch=''; wizard.activityOpen=true; refreshActivityAreaUI(); }
function backToActivityProvinces(event){ if(event){ event.preventDefault(); event.stopPropagation(); } wizard.activityProvince=''; wizard.activitySearch=''; wizard.activityOpen=true; refreshActivityAreaUI(); }
function filterActivityCities(value){ wizard.activitySearch=value||''; wizard.activityOpen=true; refreshActivityAreaUI(); setTimeout(()=>{const el=document.querySelector('.activity-search'); if(el){ el.focus(); el.setSelectionRange(el.value.length,el.value.length); }},0); }
function filterActivityProvinces(value){ wizard.activitySearch=value||''; wizard.activityOpen=true; refreshActivityAreaUI(); setTimeout(()=>{const el=document.querySelector('.activity-search'); if(el){ el.focus(); el.setSelectionRange(el.value.length,el.value.length); }},0); }
function toggleAllCities(province, checked){
    const current=getActivityAreaRows();
    const index=current.findIndex(x=>x.province===province);
    if(checked){ if(index>=0) current[index]={province,cities:[],all:true}; else current.push({province,cities:[],all:true}); }
    else if(index>=0){ current.splice(index,1); }
    wizard.data.activityArea=current; wizard.activityProvince=province; wizard.activityOpen=true; wizard.activitySearch='';
    saveWizardDraftDebounced(); refreshActivityAreaUI();
}
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
function removeActivityCity(province, city){ toggleActivityCity(province,city,false); }
function removeActivityProvince(province){ const current=getActivityAreaRows().filter(x=>x.province!==province); wizard.data.activityArea=current; wizard.activityProvince=province; wizard.activityOpen=true; saveWizardDraftDebounced(); refreshActivityAreaUI(); }
function toggleActivityDropdown(event){ event.preventDefault(); event.stopPropagation(); openActivityAreaSheet(); }
function closeActivityDropdown(event){ if(event){ event.preventDefault(); event.stopPropagation(); } closeActivityAreaSheet(); }
function confirmActivityArea(event){ if(event){ event.preventDefault(); event.stopPropagation(); } confirmActivityAreaSheet(); }

function renderWizard(){
    if(wizard.formSheetOpen){ renderMobileFormSheet(); }
}

function syncWizardFieldValue(element){ if(!element || !element.dataset || !element.dataset.wizardField || !wizard || !wizard.data)return; if(element.type==='file')return; wizard.data[element.dataset.wizardField]=element.value; saveWizardDraftDebounced(); }
document.addEventListener('input', function(e){ syncWizardFieldValue(e.target); });
document.addEventListener('change', function(e){ syncWizardFieldValue(e.target); });
function finalizeWizard(){
    if(!currentUser)return;
    let savedType = wizard.type, savedService = wizard.service, newId = null;
    const data = cloneObject(wizard.data);
    if(data.dateStart) data.date = data.dateStart;
    if(wizard.type==='receive'){
        const request={ id:"r"+Date.now()+Math.random().toString(36).slice(2,6), userId:currentUser.id, requesterName:currentUser.name, service:savedService, data:data, status:"pending", created:new Date().toISOString() };
        db.requests.push(request); saveDB(); newId = request.id;
        mapContext={type:'receive',service:savedService,target:wizard.data.serviceLocation||null,requestId:request.id};
    }else{
        const listing={ id:"l"+Date.now()+Math.random().toString(36).slice(2,6), userId:currentUser.id, providerName:currentUser.name, service:savedService, data:data, status:"active", created:new Date().toISOString() };
        db.listings.push(listing); saveDB(); newId = listing.id;
        mapContext={type:'provide',service:savedService,activityArea:wizard.data.activityArea||[],listingId:listing.id};
    }
    clearWizardDraft();
    mobileRequestSuccess = true;
    mobileSuccessData = { type: savedType, service: savedService, id: newId, ts: Date.now() };
    try{ sessionStorage.setItem('kelo_mobile_success', JSON.stringify(mobileSuccessData)); }catch(e){}
    setMobileTab('request');
    resetMobileWizardFlow();
}
function getRequestDateRange(request){
    const start=parseStoredDate(request?.data?.dateStart || request?.data?.date);
    const end=parseStoredDate(request?.data?.dateEnd || request?.data?.dateStart || request?.data?.date) || start;
    return {start,end};
}
function rangesOverlap(aStart,aEnd,bStart,bEnd){
    if(!aStart || !aEnd || !bStart || !bEnd) return false;
    return aStart.getTime() <= bEnd.getTime() && bStart.getTime() <= aEnd.getTime();
}
function listingAvailableForRequest(listing, start, end){
    if(!start || !end) return true;
    const ls=parseStoredDate(listing.data?.dateStart);
    const le=parseStoredDate(listing.data?.dateEnd || listing.data?.dateStart);
    if(ls && start < ls) return false;
    if(le && end > le) return false;
    return true;
}
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
function getEligibleProvidersForRequest(request){
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
function hasProviderBookingConflict(providerId, machineId, start, end){
    if(!start || !end) return false;
    return db.bookings.some(b=>{
        if(b.status!=='confirmed' && b.status!=='active') return false;
        if(b.providerId!==providerId) return false;
        if(machineId && b.machineId!==machineId) return false;
        const bs=parseStoredDate(b.start || b.date);
        const be=parseStoredDate(b.end || b.start || b.date);
        return rangesOverlap(start,end,bs,be);
    });
}
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
function formatActivityArea(area){ if(!Array.isArray(area)||!area.length)return '—'; return area.map(x=>x.all||!x.cities?.length?x.province:x.province+': '+x.cities.join('، ')).join(' | '); }
function calculateTotal(request,data,fallbackPrice){
    const area=Number(request.data && request.data.area)||Number(request.data && request.data.amount)||1;
    const price=Number(data&&data.price)||Number(fallbackPrice)||0;
    const unit=(data&&data.priceUnit)||"";
    if(unit.includes("هکتار")||unit.includes("تن")) return price*area;
    return price||0;
}
function generateOffersForRequest(request){ return getEligibleProvidersForRequest(request); }
function generateOffersForListing(listing){ return; }

function sendRequestToProvider(providerId, requestId){
    const request=db.requests.find(r=>r.id===requestId && r.userId===currentUser.id);
    if(!request){ showToast('درخواست پیدا نشد','error'); return; }
    if(request.status==='accepted' || request.status==='agreed' || request.status==='in_progress' || request.status==='completed'){
        showToast('این درخواست قبلاً توافق شده است','error'); return;
    }
    if(db.requestRecipients.some(x=>x.requestId===requestId && x.providerId===providerId && ['pending','accepted'].includes(x.status))){
        showToast('این درخواست قبلاً برای این ماشین‌دار ارسال شده است','error'); return;
    }

    const candidate=getEligibleProvidersForRequest(request).find(x=>x.providerId===providerId);
    if(!candidate){ showToast('این ماشین‌دار در حال حاضر برای این تاریخ در دسترس نیست','error'); return; }

    const recipient={
        id:'rr'+Date.now()+Math.random().toString(36).slice(2,7),
        requestId:request.id,
        providerId:candidate.providerId,
        provider:candidate.provider,
        machineId:candidate.machineId,
        listingId:candidate.listingId || null,
        service:request.service,
        unitPrice:candidate.unitPrice,
        priceUnit:candidate.priceUnit,
        total:calculateTotal(request,candidate.data,candidate.unitPrice),
        rating:candidate.rating,
        location:candidate.location,
        status:'pending',
        createdAt:new Date().toISOString()
    };
    db.requestRecipients.push(recipient);
    request.status='pending';
    saveDB();
    showToast('درخواست برای ماشین‌دار ارسال شد','success');
    openRequestOffersMap(request.id);
    updateMobileHeader('ارائه‌دهندگان خدمت');
}
function providerHasUnfinishedDeal(providerId){
    return db.deals.some(d=>d.providerId===providerId && d.status!=='completed' && d.status!=='cancelled');
}
function acceptOffer(id){
    const recipient=db.requestRecipients.find(x=>x.id===id && x.providerId===currentUser.id && x.status==='pending');
    if(!recipient) {
        if(db.requestRecipients.some(x=>x.id===id && x.status!=='pending')) showToast('این درخواست دیگر قابل پذیرش نیست','error');
        return;
    }
    const request=db.requests.find(r=>r.id===recipient.requestId);
    if(!request){ showToast('درخواست پیدا نشد','error'); return; }
    if(request.status==='accepted' || request.status==='agreed' || request.status==='in_progress' || request.status==='completed'){
        recipient.status='closed'; saveDB();
        showToast('این درخواست قبلاً با ارائه‌دهنده دیگری توافق شده است','error');
        renderMobileProposals(); return;
    }
    if(providerHasUnfinishedDeal(currentUser.id)){
        const previous=db.deals.find(d=>d.providerId===currentUser.id && d.status!=='completed' && d.status!=='cancelled');
        const prevReq=previous ? db.requests.find(r=>r.id===previous.requestId) : null;
        const prevName=prevReq ? serviceName(prevReq.service) : 'خدمت قبلی';
        const prevDate=prevReq ? requestDate(prevReq) : '—';
        showToast('برای پذیرش خدمت جدید ابتدا اتمام کار قبلی را ثبت کنید. خدمت قبلی: '+prevName+' | تاریخ: '+prevDate,'error');
        return;
    }

    const {start,end}=getRequestDateRange(request);
    const freshCandidate=getEligibleProvidersForRequest(request).find(x=>x.providerId===currentUser.id && String(x.machineId)===String(recipient.machineId));
    if(!freshCandidate || (start && hasProviderBookingConflict(currentUser.id, recipient.machineId, start, end))){
        recipient.status='closed';
        saveDB();
        showToast('این ماشین در این زمان دیگر در دسترس نیست','error');
        renderMobileProposals();
        return;
    }

    const stillOpen=db.requestRecipients.find(x=>x.requestId===request.id && x.status==='pending' && x.id===recipient.id);
    const anotherAccepted=db.requestRecipients.find(x=>x.requestId===request.id && x.status==='accepted');
    if(!stillOpen || anotherAccepted){
        showToast('این درخواست قبلاً با ارائه‌دهنده دیگری توافق شده است','error');
        renderMobileProposals(); return;
    }

    const booking={
        id:'b'+Date.now()+Math.random().toString(36).slice(2,7),
        requestId:request.id,
        providerId:currentUser.id,
        requesterId:request.userId,
        machineId:recipient.machineId,
        listingId:recipient.listingId || null,
        start:request.data?.dateStart || request.data?.date,
        end:request.data?.dateEnd || request.data?.dateStart || request.data?.date,
        status:'confirmed',
        createdAt:new Date().toISOString()
    };
    db.bookings.push(booking);

    recipient.status='accepted';
    recipient.respondedAt=new Date().toISOString();
    db.requestRecipients.filter(x=>x.requestId===request.id && x.id!==recipient.id && x.status==='pending').forEach(x=>{
        x.status='closed'; x.closedAt=new Date().toISOString();
    });
    request.status='accepted';

    const existingDeal=db.deals.find(d=>d.requestId===request.id && d.status!=='cancelled');
    if(existingDeal){
        booking.status='cancelled';
        recipient.status='closed';
        showToast('این درخواست قبلاً توافق شده است','error');
        saveDB(); renderMobileProposals(); return;
    }

    const deal={
        id:'d'+Date.now()+Math.random().toString(36).slice(2,7),
        requestId:request.id,
        bookingId:booking.id,
        userId:request.userId,
        providerId:currentUser.id,
        machineId:recipient.machineId,
        service:request.service,
        total:recipient.total,
        unitPrice:recipient.unitPrice,
        priceUnit:recipient.priceUnit,
        counterparty:currentUser.name,
        paymentStatus:'unpaid',
        status:'agreed',
        createdAt:new Date().toISOString()
    };
    db.deals.push(deal);
    saveDB();
    showToast('کار با شما توافق شد','success');
    goBackFromOffersMap();
    setMobileOrdersSubTab('deals');
    setMobileTab('proposals');
}
function payDeal(dealId){
    const d=db.deals.find(x=>x.id===dealId && x.userId===currentUser.id);
    if(!d || d.status==='completed' || d.status==='cancelled') return;
    if(d.paymentStatus==='paid'){ showToast('این توافق قبلاً پرداخت شده است','success'); return; }
    const amount=Number(d.total)||0;
    d.paymentStatus='paid';
    db.payments.push({id:'p'+Date.now(),dealId:d.id,userId:currentUser.id,amount,status:'paid',createdAt:new Date().toISOString()});
    if(d.status==='agreed') d.status='paid';
    saveDB();
    showToast('پرداخت ثبت شد','success');
    renderMobileProposals();
}
function routeToDeal(dealId){
    const d=db.deals.find(x=>x.id===dealId && x.providerId===currentUser.id);
    if(!d) return;
    const req=db.requests.find(r=>r.id===d.requestId);
    if(!req){ showToast('درخواست پیدا نشد','error'); return; }
    openRequestLocationMap(req.id);
}
function cancelDeal(dealId){
    const d=db.deals.find(x=>x.id===dealId && isDealForUser(x) && x.status!=='completed');
    if(!d) return;
    if(!confirm('این کار لغو شود؟')) return;
    d.status='cancelled';
    d.cancelledAt=new Date().toISOString();
    const req=db.requests.find(r=>r.id===d.requestId);
    if(req && req.status!=='completed') req.status='cancelled';
    const booking=db.bookings.find(b=>b.id===d.bookingId);
    if(booking) booking.status='cancelled';
    const recs=db.requestRecipients.filter(x=>x.requestId===d.requestId);
    recs.forEach(x=>{ if(x.status==='accepted') x.status='closed'; });
    saveDB();
    showToast('کار لغو شد','success');
    renderMobileProposals();
}
function completeDeal(dealId){
    const d=db.deals.find(x=>x.id===dealId && x.providerId===currentUser.id && x.status!=='completed' && x.status!=='cancelled');
    if(!d) return;
    if(!isDealPastEnd(d)){ showToast('اتمام کار در پایان زمان ثبت‌شده فعال می‌شود','error'); return; }
    d.status='completed';
    d.completedAt=new Date().toISOString();
    const req=db.requests.find(r=>r.id===d.requestId);
    if(req) req.status='completed';
    const booking=db.bookings.find(b=>b.id===d.bookingId);
    if(booking) booking.status='completed';
    const rec=db.requestRecipients.find(x=>x.requestId===d.requestId && x.status==='accepted');
    if(rec) rec.status='completed';
    saveDB();
    showToast('اتمام کار ثبت شد','success');
    renderMobileProposals();
}
function calculateTotalForDeal(deal){ return Number(deal?.total)||0; }

function roleLabel(r){ return ({farmer:'کشاورز',provider:'ارائه‌دهنده',admin:'مدیر'})[r]||r; }

function renderAdmin(){
    const app = document.getElementById('app');
    if(app){
        app.classList.remove('mobile-tab-home','mobile-tab-request','mobile-tab-proposals','mobile-tab-request-offers');
        app.classList.add('mobile-tab-home');
    }
    const sb = document.getElementById('sidebar'); if(sb) sb.innerHTML='';
    const nav = document.getElementById('mobileBottomNav'); if(nav) nav.classList.add('hidden');
    const c = document.getElementById('appContent'); if(!c) return;
    c.className = 'content';
    c.innerHTML = '<div class="mobile-home-page">'
        +'<div class="stats" style="grid-template-columns:repeat(2,1fr);margin-bottom:16px">'
        +'<div class="stat"><small>کاربران</small><strong>'+fmtNum(db.users.length)+'</strong></div>'
        +'<div class="stat"><small>خدمات</small><strong>'+fmtNum(db.listings.length)+'</strong></div>'
        +'<div class="stat"><small>نیازها</small><strong>'+fmtNum(db.requests.length)+'</strong></div>'
        +'<div class="stat"><small>توافق‌ها</small><strong>'+fmtNum(db.deals.length)+'</strong></div>'
        +'</div>'
        +'<button type="button" class="btn btn-outline btn-block" onclick="logout()">خروج از حساب مدیر</button>'
        +'</div>';
    const t = document.getElementById('mobileAppTitle'); if(t) t.textContent='داشبورد مدیر';
    updateMobileAccountIdentity();
}
function serviceName(service){ return SERVICE_DEFS[service]?.name || service || '—'; }
function formatMoney(value){ return fmtNum(Number(value)||0)+' تومان'; }
function requestDate(r){ const start = r?.data?.dateStart || r?.data?.date; const end = r?.data?.dateEnd; if(start && end) return humanJalaliDate(start)+' تا '+humanJalaliDate(end); if(start) return humanJalaliDate(start); return '—'; }
function requestAmount(r){ if(r?.data?.area) return toPersianDigits(r.data.area)+' هکتار'; return '—'; }
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

document.addEventListener('DOMContentLoaded',async function(){
    document.querySelectorAll('img').forEach(img=>{ const localSrc=img.getAttribute('src')||''; const parts=localSrc.split('/'); const filename=parts[parts.length-1].split('?')[0]; const externalUrl=driveImageMap[filename]; if(externalUrl){ img.dataset.fallbackExternal=externalUrl; img.src=localSrc; img.onerror=function(){ if(this.dataset.fallbackExternal && !this.dataset.triedExternal){ this.dataset.triedExternal='true'; this.src=this.dataset.fallbackExternal; }else this.style.background='#dfe7cc'; }; } });

    const finishLocalBootstrap = function(){
        try{
            const savedId = localStorage.getItem(SESSION_KEY);
            if(savedId){
                const u = db.users.find(x => x.id === savedId);
                if(u){
                    currentUser = u;
                    document.getElementById("landing").classList.add("hidden");
                    document.getElementById("app").classList.remove("hidden");
                    setAppActive(true);
                    if(!currentUser.profileCompleted){ showCompleteProfile(); }
                    else {
                        const savedTab = sessionStorage.getItem(TAB_KEY) || 'home';
                        window.__keloMobileTab = savedTab;
                        setMobileTab(savedTab);
                    }
                    return true;
                }
            }
        }catch(e){}
        const preStyle = document.getElementById('keloPreloadHideLanding');
        if(preStyle) preStyle.remove();
        return false;
    };

    try{
        const apiAvailable = window.KeloBackend ? await window.KeloBackend.bootstrap() : false;
        if(apiAvailable){
            activateRemoteUserCache();
            try{
                const session = await window.KeloBackend.getSession();
                if(session && session.authenticated && session.user){
                    enterAuthenticatedApp(session.user, {skipSessionSave:true});
                } else {
                    const preStyle=document.getElementById('keloPreloadHideLanding'); if(preStyle) preStyle.remove();
                }
            }catch(error){
                const preStyle=document.getElementById('keloPreloadHideLanding'); if(preStyle) preStyle.remove();
            }
        } else {
            finishLocalBootstrap();
        }
    }catch(error){
        finishLocalBootstrap();
    }
});

(function(){
    var iconSvg = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'><rect width='512' height='512' rx='96' fill='%23C5B23E'/><text x='256' y='340' text-anchor='middle' font-family='Tahoma,sans-serif' font-size='280' font-weight='900' fill='%23fff'>K</text></svg>";
    var manifest = {
        name: "کِلو | بازار خدمات کشاورزی",
        short_name: "کِلو",
        start_url: ".",
        scope: ".",
        display: "standalone",
        orientation: "portrait",
        background_color: "#fffdf6",
        theme_color: "#C5B23E",
        lang: "fa",
        dir: "rtl",
        icons: [{ src: "data:image/svg+xml;utf8," + iconSvg, sizes: "512x512", type: "image/svg+xml", purpose: "any maskable" }]
    };
    try{
        var blob = new Blob([JSON.stringify(manifest)], {type:"application/json"});
        var link = document.createElement("link");
        link.rel = "manifest";
        link.href = URL.createObjectURL(blob);
        document.head.appendChild(link);
    }catch(e){}
})();
