/**
 * KELO — Profile UI handlers (Phase 10)
 * Event handlers + orchestration. Rendering still primarily in app.js.
 */
(function (global) {
  'use strict';

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
      e.preventDefault();
      if (!currentUser) return;
      const nameEl = document.getElementById('editName');
      const phoneEl = document.getElementById('editPhone');
      const nidEl = document.getElementById('editNationalId');
      const name = (nameEl ? nameEl.value : '').trim();
      const phoneRaw = (phoneEl ? phoneEl.value : '').trim();
      const nidRaw = (nidEl ? nidEl.value : '').trim();

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

})(typeof window !== 'undefined' ? window : globalThis);
