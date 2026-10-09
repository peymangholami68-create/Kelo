/**
 * KELO — Auth UI (Phase 12)
 * Session, login/logout handlers, enter app, admin login helpers.
 */
(function (global) {
  'use strict';

  function saveSession(){
      try{
          if(window.KeloService && window.KeloService.mode && window.KeloService.mode() === 'server'){
              localStorage.removeItem(SESSION_KEY);
              return;
          }
          if(currentUser) localStorage.setItem(SESSION_KEY, currentUser.id);
      }catch(e){}
  }

  global.saveSession = saveSession;

  function clearSession(){
      try{
          localStorage.removeItem(SESSION_KEY);
          sessionStorage.removeItem(TAB_KEY);
      }catch(e){}
  }

  global.clearSession = clearSession;

  function setAppActive(active){
      if(active){ document.documentElement.classList.add('kelo-app-active'); document.body.classList.add('kelo-app-active'); }
      else { document.documentElement.classList.remove('kelo-app-active'); document.body.classList.remove('kelo-app-active'); }
  }

  global.setAppActive = setAppActive;

  function upsertAuthenticatedUserMirror(user){
      if(!user || !user.id) return user;
      // Phase 3: no Query-layer mutation — Adapter via AuthService (or dataAccess getDB)
      try {
          if (window.KeloAuthService && typeof window.KeloAuthService.upsertUserMirror === 'function') {
              var res = window.KeloAuthService.upsertUserMirror(user);
              // sync path may return Promise — still merge into a local object for immediate UI
              if (res && typeof res.then === 'function') {
                  res.then(function (r) {
                      if (r && r.ok && r.data && r.data.user && window.KeloState && window.KeloState.setCurrentUser) {
                          window.KeloState.setCurrentUser(r.data.user);
                      }
                  }).catch(function () {});
              } else if (res && res.ok && res.data && res.data.user) {
                  return res.data.user;
              }
          }
      } catch (e) { console.warn('upsertUserMirror', e); }
      // Fallback read-only merge object (does not push to qdb)
      var merged = cloneObject(user);
      if (!Array.isArray(merged.systemRoles)) merged.systemRoles = [];
      if (!merged.profile) merged.profile = {};
      // Persist via saveDB path if local adapter already updated DB
      return merged;
  }

  global.upsertAuthenticatedUserMirror = upsertAuthenticatedUserMirror;

  function enterAuthenticatedUser(user, options){
      options = options || {};
      currentUser = upsertAuthenticatedUserMirror(user);
      if (window.KeloState && typeof window.KeloState.setCurrentUser === 'function') {
          window.KeloState.setCurrentUser(currentUser);
      }
      saveSession();
      closeLogin();
      const landing=document.getElementById("landing");
      const app=document.getElementById("app");
      if(landing) landing.classList.add("hidden");
      if(app) app.classList.remove("hidden");
      setAppActive(true);
      if(!currentUser.profileCompleted){
          showCompleteProfile();
      } else if(options.render !== false){
          renderApp();
      }
      if(window.KeloService && window.KeloService.mode && window.KeloService.mode() === 'server'){
          refreshServerSnapshot(true).catch(function(e){ console.warn('kelo snapshot:', e); });
      }
  }

  global.enterAuthenticatedUser = enterAuthenticatedUser;

  function normalizePhone(value){ let p=normalizeDigits(value).replace(/\s+/g,"").trim(); if(p.startsWith("+98"))p="0"+p.substring(3); else if(p.startsWith("98"))p="0"+p.substring(2); return p; }

  global.normalizePhone = normalizePhone;

  function normalizeNationalId(value){ return normalizeDigits(value).replace(/\D/g,"").trim(); }

  global.normalizeNationalId = normalizeNationalId;

  function isAdmin(user){ return !!user && ensureSystemRoles(user).includes("admin"); }

  global.isAdmin = isAdmin;

  async function adminLoginValues(phone, nationalId){
      // سازگاری با فراخوانی‌های قدیمی — مسیر اصلی login از KeloService.auth است
      authMode = 'admin';
      const authApi = window.KeloService && window.KeloService.auth;
      if (!authApi) { showAuthError('سرویس ورود در دسترس نیست.'); return; }
      const result = await authApi.login({ phone: phone, nationalId: nationalId, authMode: 'admin' });
      if (!result || !result.ok) {
          showAuthError((result && result.message) || 'اطلاعات ورود مدیر صحیح نیست.');
          return;
      }
      const user = result.data && result.data.user;
      if (!user) { showAuthError('اطلاعات ورود مدیر صحیح نیست.'); return; }
      enterAuthenticatedUser(user, { render: false });
      if (window.KeloService && window.KeloService.mode && window.KeloService.mode() === 'server') {
          try { await refreshServerSnapshot(false); } catch (err) { console.warn('kelo snapshot after admin login:', err); }
      }
      if (!currentUser.profileCompleted) showCompleteProfile();
      else renderApp();
  }

  global.adminLoginValues = adminLoginValues;

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
          +'<div class="stat"><small>کاربران</small><strong>'+fmtNum(qdb().users.length)+'</strong></div>'
          +'<div class="stat"><small>خدمات</small><strong>'+fmtNum(qdb().listings.length)+'</strong></div>'
          +'<div class="stat"><small>نیازها</small><strong>'+fmtNum(qdb().requests.length)+'</strong></div>'
          +'<div class="stat"><small>توافق‌ها</small><strong>'+fmtNum(qdb().deals.length)+'</strong></div>'
          +'</div>'
          +'<button type="button" class="btn btn-outline btn-block" onclick="logout()">خروج از حساب مدیر</button>'
          +'</div>';
      const t = document.getElementById('mobileAppTitle'); if(t) t.textContent='داشبورد مدیر';
      updateMobileAccountIdentity();
  }

  global.renderAdmin = renderAdmin;

  function openLogin(){ authMode="public"; const modal=document.getElementById("loginModal"); if(modal) modal.classList.remove("hidden"); clearAuthError(); }

  global.openLogin = openLogin;

  function closeLogin(){ const modal=document.getElementById("loginModal"); if(modal) modal.classList.add("hidden"); const phone=document.getElementById("loginPhone"), nid=document.getElementById("loginNationalId"); if(phone)phone.value=""; if(nid)nid.value=""; clearAuthError(); }

  global.closeLogin = closeLogin;

  function openAdminLogin(){ authMode="admin"; const modal=document.getElementById("loginModal"); if(modal) modal.classList.remove("hidden"); const title=modal ? modal.querySelector(".modal-head h2") : null; if(title) title.textContent="ورود مدیریت"; clearAuthError(); }

  global.openAdminLogin = openAdminLogin;

  function showAuthError(message){ const box=document.getElementById("authError"); if(!box){ showToast(message,'error'); return; } box.textContent=message; box.style.display="block"; }

  global.showAuthError = showAuthError;

  function clearAuthError(){ const box=document.getElementById("authError"); if(box){ box.textContent=""; box.style.display="none"; } }

  global.clearAuthError = clearAuthError;

  async function login(e){
      e.preventDefault(); clearAuthError();
      const phone = (window.KeloService && window.KeloService.auth)
          ? window.KeloService.auth.normalizePhone(document.getElementById("loginPhone").value)
          : normalizePhone(document.getElementById("loginPhone").value);
      const nationalId = (window.KeloService && window.KeloService.auth)
          ? window.KeloService.auth.normalizeNationalId(document.getElementById("loginNationalId").value)
          : normalizeNationalId(document.getElementById("loginNationalId").value);

      const authApi = window.KeloService && window.KeloService.auth;
      if (!authApi) {
          showAuthError('سرویس ورود در دسترس نیست.');
          return;
      }

      const result = await authApi.login({ phone: phone, nationalId: nationalId, authMode: authMode || 'public' });
      if (!result || !result.ok) {
          showAuthError((result && result.message) || 'ورود انجام نشد.');
          return;
      }

      const user = result.data && result.data.user;
      if (!user) {
          showAuthError('ورود انجام نشد.');
          return;
      }

      enterAuthenticatedUser(user, { created: !!(result.data && result.data.created), render: false });
      if (window.KeloService && window.KeloService.mode && window.KeloService.mode() === 'server') {
          try { await refreshServerSnapshot(false); } catch (err) { console.warn('kelo snapshot after login:', err); }
      }
      if (!currentUser.profileCompleted) showCompleteProfile();
      else renderApp();
  }

  global.login = login;

  async function logout(){
      try {
          if (window.KeloService && window.KeloService.auth) {
              await window.KeloService.auth.logout();
          }
      } catch (e) { console.warn('KELO logout failed', e); }
      closeMobileAccountSheet();
      currentUser = null;
      clearSession();
      if (window.KeloState && typeof window.KeloState.clearCurrentUser === 'function') {
          window.KeloState.clearCurrentUser();
      }
      const app = document.getElementById("app"), landing = document.getElementById("landing"), modal = document.getElementById("loginModal");
      if (app) app.classList.add("hidden");
      if (landing) landing.classList.remove("hidden");
      if (modal) modal.classList.add("hidden");
      setAppActive(false);
      const preStyle = document.getElementById('keloPreloadHideLanding');
      if (preStyle) preStyle.remove();
      window.location.hash = "";
      clearAuthError();
      window.scrollTo({ top: 0, behavior: "auto" });
  }

  global.logout = logout;


  /**
   * Phase 18 — module facade (idempotent).
   * Handlers remain on window for HTML onclick compatibility.
   */
  var _inited = false;
  global.KeloAuthUI = {
    name: 'Auth',
    init: function () {
      if (_inited) return global.KeloAuthUI;
      _inited = true;
      return global.KeloAuthUI;
    },
    isReady: function () { return _inited; }
  };
  // auto-register handlers already assigned to global above

})(typeof window !== 'undefined' ? window : globalThis);
