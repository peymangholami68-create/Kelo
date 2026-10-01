/**
 * KELO — Auth UI handlers (Phase 10)
 * Event handlers + orchestration. Rendering still primarily in app.js.
 */
(function (global) {
  'use strict';

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

})(typeof window !== 'undefined' ? window : globalThis);
