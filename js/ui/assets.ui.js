/**
 * KELO — Assets UI (lands / fleet) — Phase 2
 * UI only talks to KeloAssetsService / Domain, not raw db.
 */
(function (global) {
  'use strict';

  var _landMap = null;
  var _pendingLandLoc = null;

  function esc(s) {
    if (typeof global.escapeHtml === 'function') return global.escapeHtml(s);
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function serviceLabel(code) {
    try {
      if (global.SERVICE_DEFS && global.SERVICE_DEFS[code]) return global.SERVICE_DEFS[code].name;
    } catch (e) {}
    return code || 'خدمت';
  }

  function svc() {
    return (global.KeloService && global.KeloService.assets) || global.KeloAssetsService;
  }

  function domain() {
    return global.KeloAssetsDomain;
  }

  function sheetEl() {
    return document.getElementById('mobileAccountSheet');
  }

  function header(title, backFn) {
    var back = backFn || "openMobileAccountSection('profile')";
    // Same grid header as other profile sheets (title centered, chevron back)
    return '<div class="mobile-sheet-header asset-sheet-header">'
      + '<button type="button" class="mobile-sheet-back-btn" onclick="' + back + '">'
      + (global.KELO_BACK_CHEVRON_SVG || '←')
      + '</button><h2>' + esc(title) + '</h2><span></span></div>';
  }

  function unwrap(res) {
    if (!res) return null;
    if (res.then) return res;
    return Promise.resolve(res);
  }

  // —— Menu (like support) ——
  function renderAssetsMenu() {
    var sheet = sheetEl();
    if (!sheet) {
      if (typeof global.openMobileAccountSheet === 'function') global.openMobileAccountSheet();
      sheet = sheetEl();
    }
    if (!sheet) {
      if (typeof global.openMobileAccountSection === 'function') {
        global.openMobileAccountSection('menu');
      }
      return;
    }
    sheet.style.display = '';
    sheet.innerHTML = '';
    sheet.innerHTML = header('دارایی‌های من', "openMobileAccountSection('menu')")
      + '<div class="mobile-account-body">'
      + '<div class="profile-menu-list">'
      + '<button type="button" class="profile-menu-row" onclick="keloAssetsOpenLands()">'
      + '<span class="profile-menu-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 21h18"/><path d="M5 21V10l7-5 7 5v11"/><path d="M9 21v-6h6v6"/></svg></span>'
      + '<span>زمین‌ها / مزرعه‌ها</span><i class="kelo-chevron left"></i></button>'
      + '<button type="button" class="profile-menu-row" onclick="keloAssetsOpenFleet()">'
      + '<span class="profile-menu-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="7" cy="18" r="3"/><circle cx="18" cy="18" r="2.5"/><path d="M2 14h3a2 2 0 0 1 2 2v3"/><path d="M7 13V6a1 1 0 0 1 1-1h3l2 5"/><path d="M13 10h4l2 4"/></svg></span>'
      + '<span>ماشین‌آلات</span><i class="kelo-chevron left"></i></button>'
      + '</div></div>';
    if (typeof global.attachSheetDragOnce === 'function') global.attachSheetDragOnce(sheet);
  }

  function renderAssetsSection() {
    renderAssetsMenu();
  }

  // —— Lands list ——
  function openLands() {
    var s = svc();
    if (!s) return;
    unwrap(s.listLands()).then(function (res) {
      var lands = (res && res.ok && res.data && res.data.lands) ? res.data.lands : [];
      var sheet = sheetEl();
      if (!sheet) return;
      var body;
      if (!lands.length) {
        body = '<div class="asset-empty">'
          + '<div class="asset-empty-icon" aria-hidden="true">'
          + '<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 21h18"/><path d="M5 21V10l7-5 7 5v11"/><path d="M9 21v-6h6v6"/></svg>'
          + '</div>'
          + '<h3>مزرعه من</h3>'
          + '<p>زمین و مزرعه‌هایتان را یک‌بار ثبت کنید تا دفعه بعد فقط خدمت و تاریخ را بزنید.</p>'
          + '</div>';
      } else {
        body = lands.map(function (L) {
          var title = domain() ? domain().landDisplayName(L) : (L.name || 'زمین');
          var meta = [];
          if (L.area) meta.push(L.area + ' هکتار');
          if (L.city) meta.push(L.city);
          return '<div class="asset-row">'
            + '<div class="asset-row-main"><strong>' + esc(title) + '</strong>'
            + (meta.length ? '<span class="asset-meta">' + esc(meta.join(' · ')) + '</span>' : '')
            + '</div>'
            + '<button type="button" class="btn btn-outline asset-del" onclick="keloAssetsDeleteLand(\'' + esc(L.id) + '\')">حذف</button>'
            + '</div>';
        }).join('');
      }
      sheet.innerHTML = header('مزرعه من', 'keloAssetsOpenMenu()')
        + '<div class="mobile-account-body asset-body">' + body
        + '<button type="button" class="btn btn-brand btn-block asset-add-btn" onclick="keloAssetsStartAddLand()">+ افزودن زمین یا مزرعه</button>'
        + '</div>';
      if (typeof global.attachSheetDragOnce === 'function') global.attachSheetDragOnce(sheet);
    });
  }

  function openFleet() {
    var s = svc();
    if (!s) return;
    unwrap(s.listFleet()).then(function (res) {
      var fleet = (res && res.ok && res.data && res.data.fleet) ? res.data.fleet : [];
      var sheet = sheetEl();
      if (!sheet) return;
      var body;
      if (!fleet.length) {
        body = '<div class="asset-empty">'
          + '<div class="asset-empty-icon" aria-hidden="true">'
          + '<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="7" cy="18" r="3"/><circle cx="18" cy="18" r="2.5"/><path d="M2 14h3a2 2 0 0 1 2 2v3"/><path d="M7 13V6a1 1 0 0 1 1-1h3l2 5"/><path d="M13 10h4l2 4"/></svg>'
          + '</div>'
          + '<h3>ماشین‌آلات من</h3>'
          + '<p>ماشین‌هایتان را ذخیره کنید تا ثبت ارائه خدمت فقط با تاریخ و قیمت انجام شود.</p>'
          + '</div>';
      } else {
        body = fleet.map(function (M) {
          var title = domain() ? domain().machineDisplayName(M) : (M.machineType || M.name);
          return '<div class="asset-row">'
            + '<div class="asset-row-main"><strong>' + esc(title) + '</strong>'
            + '<span class="asset-meta">' + esc(serviceLabel(M.service)) + (M.capacity ? ' · ' + esc(M.capacity) : '') + '</span>'
            + '</div>'
            + '<button type="button" class="btn btn-outline asset-del" onclick="keloAssetsDeleteFleet(\'' + esc(M.id) + '\')">حذف</button>'
            + '</div>';
        }).join('');
      }
      sheet.innerHTML = header('ماشین‌آلات من', 'keloAssetsOpenMenu()')
        + '<div class="mobile-account-body asset-body">' + body
        + '<button type="button" class="btn btn-brand btn-block asset-add-btn" onclick="keloAssetsStartAddFleet()">+ افزودن ماشین</button>'
        + '</div>';
      if (typeof global.attachSheetDragOnce === 'function') global.attachSheetDragOnce(sheet);
    });
  }

  // —— Add land: map sheet then details ——
  function startAddLand() {
    _pendingLandLoc = null;
    try {
      if (!global.wizard) global.wizard = { data: {} };
      global.wizard._assetMapMode = true;
      global.wizard._profileMapMode = false;
      global.wizard.mapPickMode = true;
      global.wizard._pendingMapPoint = null;
      // Same overlay as «نیاز به خدمت»: search + GPS + center pin + confirm
      if (typeof global.openMobileMapPickerOverlay === 'function') {
        global.openMobileMapPickerOverlay();
        return;
      }
    } catch (e) {
      console.warn('asset map', e);
    }
    if (typeof global.showToast === 'function') global.showToast('نقشه در دسترس نیست', 'error');
  }

  function searchLandCity() {
    var input = document.getElementById('assetLandSearch');
    var q = (input && input.value || '').trim();
    if (!q || !_landMap) return;
    var coords = null;
    if (global.KELO_CITY_COORDS) {
      if (global.KELO_CITY_COORDS[q]) coords = global.KELO_CITY_COORDS[q];
      else {
        var keys = Object.keys(global.KELO_CITY_COORDS);
        for (var i = 0; i < keys.length; i++) {
          if (keys[i].indexOf(q) >= 0 || q.indexOf(keys[i]) >= 0) {
            coords = global.KELO_CITY_COORDS[keys[i]];
            break;
          }
        }
      }
    }
    if (!coords) {
      if (typeof global.showToast === 'function') global.showToast('شهر پیدا نشد؛ روی نقشه بزنید.', 'error');
      return;
    }
    _landMap.setView(coords, 13);
    _pendingLandLoc = { lat: coords[0], lng: coords[1], city: q };
    L.marker(coords).addTo(_landMap);
  }

  function closeLandMap() {
    var el = document.getElementById('keloAssetLandMapSheet');
    if (el) el.remove();
    if (_landMap) { try { _landMap.remove(); } catch (e) {} _landMap = null; }
    document.body.style.overflow = '';
  }

  function afterMapPick(loc) {
    _pendingLandLoc = loc || _pendingLandLoc || null;
    // Re-open account sheet if map overlay hid it
    var sheet = sheetEl();
    var bd = document.getElementById('mobileAccountBackdrop');
    if (bd) {
      bd.classList.add('open');
      bd.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    }
    openLandDetailsForm(_pendingLandLoc);
  }
  global.keloAssetsAfterMapPick = afterMapPick;

  function confirmLandMap() {
    if (!_pendingLandLoc || typeof _pendingLandLoc.lat !== 'number') {
      if (typeof global.showToast === 'function') global.showToast('ابتدا موقعیت را روی نقشه مشخص کنید.', 'error');
      return;
    }
    closeLandMap();
    openLandDetailsForm(_pendingLandLoc);
  }

  function openLandDetailsForm(loc) {
    loc = loc || _pendingLandLoc || null;
    var sheet = sheetEl();
    if (!sheet) {
      if (typeof global.openMobileAccountSheet === 'function') global.openMobileAccountSheet();
      sheet = sheetEl();
    }
    if (!sheet) return;
    var locLabel = (loc && (loc.label || loc.city)) ? (loc.label || loc.city) : 'انتخاب شده';
    sheet.innerHTML = header('مشخصات زمین', 'keloAssetsOpenLands()')
      + '<div class="mobile-account-body asset-form-body">'
      + '<p class="asset-map-hint">موقعیت: ' + esc(String(locLabel)) + '</p>'
      + '<div class="mobile-field asset-field"><label class="mobile-field-label">نام زمین یا مزرعه <span style="color:red">*</span></label>'
      + '<input type="text" id="assetLandName" class="input mobile-field-input" placeholder="مثلاً مزرعه ساری" value="مزرعه من"/></div>'
      + '<div class="mobile-field asset-field"><label class="mobile-field-label">مساحت (هکتار) <span style="color:red">*</span></label>'
      + '<input type="number" id="assetLandArea" class="input mobile-field-input" min="0.1" step="0.1" placeholder="مثلاً 2" value="2"/></div>'
      + '<button type="button" class="btn btn-brand btn-block" onclick="keloAssetsSaveLand()">ذخیره زمین</button>'
      + '</div>';
    try { sheet.dataset.landLoc = JSON.stringify(loc || {}); } catch (e) {}
    if (typeof global.attachSheetDragOnce === 'function') global.attachSheetDragOnce(sheet);
  }

  function saveLand() {
    var sheet = sheetEl();
    var loc = _pendingLandLoc;
    try {
      if (sheet && sheet.dataset.landLoc) loc = JSON.parse(sheet.dataset.landLoc);
    } catch (e) {}
    var nameEl = document.getElementById('assetLandName');
    var areaEl = document.getElementById('assetLandArea');
    var name = nameEl ? nameEl.value.trim() : '';
    var area = areaEl ? Number(areaEl.value) : 0;
    var s = svc();
    if (!s) return;
    unwrap(s.createLand({ name: name, area: area, location: loc, city: (loc && loc.city) || '' })).then(function (res) {
      if (!res || !res.ok) {
        if (typeof global.showToast === 'function') global.showToast((res && res.message) || 'ذخیره نشد', 'error');
        return;
      }
      if (typeof global.showToast === 'function') global.showToast('زمین ذخیره شد', 'success');
      openLands();
    });
  }

  function deleteLand(id) {
    if (!confirm('این زمین حذف شود؟')) return;
    var s = svc();
    unwrap(s.deleteLand(id)).then(function () { openLands(); });
  }

  // —— Add machine form ——
  function startAddFleet() {
    var sheet = sheetEl();
    if (!sheet) return;
    var opts = '';
    try {
      Object.keys(global.SERVICE_DEFS || {}).forEach(function (k) {
        opts += '<option value="' + esc(k) + '">' + esc(global.SERVICE_DEFS[k].name) + '</option>';
      });
    } catch (e) {}
    if (!opts) {
      opts = '<option value="tractor">شخم و دیسک</option>'
        + '<option value="planting">کاشت</option>'
        + '<option value="spray">سمپاشی</option>'
        + '<option value="harvest">برداشت</option>';
    }
    sheet.innerHTML = header('افزودن ماشین', 'keloAssetsOpenFleet()')
      + '<div class="mobile-account-body asset-form-body">'
      + '<div class="mobile-field asset-field"><label class="mobile-field-label">نوع خدمت <span style="color:red">*</span></label>'
      + '<select id="assetMachineService" class="input mobile-field-input" style="pointer-events:auto;z-index:2;position:relative" onchange="keloAssetsOnServiceChange()">' + opts + '</select></div>'
      + '<div class="mobile-field asset-field"><label class="mobile-field-label">نوع ماشین‌آلات <span style="color:red">*</span></label>'
      + '<button type="button" class="mobile-choice-trigger" id="assetMachineTypeBtn" onclick="keloAssetsOpenMachineTypePicker()"><span class="placeholder" id="assetMachineTypeLabel">انتخاب کنید</span><span class="kelo-inline-chevron"><i class="kelo-chevron down"></i></span></button>'
      + '<input type="hidden" id="assetMachineType" value=""/></div>'
      + '<div class="mobile-field asset-field"><label class="mobile-field-label">ظرفیت / مشخصه</label>'
      + '<input type="text" id="assetMachineCap" class="input mobile-field-input" placeholder="مثلاً ۴ تن در ساعت"/></div>'
      + '<button type="button" class="btn btn-brand btn-block" onclick="keloAssetsSaveFleet()">ذخیره ماشین</button>'
      + '</div>';
    if (typeof global.attachSheetDragOnce === 'function') global.attachSheetDragOnce(sheet);
  }

  function saveFleet() {
    var service = (document.getElementById('assetMachineService') || {}).value;
    var machineType = (document.getElementById('assetMachineType') || {}).value;
    var capacity = (document.getElementById('assetMachineCap') || {}).value;
    var s = svc();
    unwrap(s.createMachine({ service: service, machineType: machineType, capacity: capacity })).then(function (res) {
      if (!res || !res.ok) {
        if (typeof global.showToast === 'function') global.showToast((res && res.message) || 'ذخیره نشد', 'error');
        return;
      }
      if (typeof global.showToast === 'function') global.showToast('ماشین ذخیره شد', 'success');
      openFleet();
    });
  }

  function deleteFleet(id) {
    if (!confirm('این ماشین حذف شود؟')) return;
    var s = svc();
    unwrap(s.deleteMachine(id)).then(function () { openFleet(); });
  }

  // —— Quick picks on request tab ——
  function quickPicksHtml(userId) {
    // sync read via qdb after query mirror fix
    var lands = [];
    var fleet = [];
    try {
      var q = (global.KeloQueryService && global.KeloQueryService.qdb) ? global.KeloQueryService.qdb() : (global.db || {});
      lands = (q.lands || []).filter(function (x) { return String(x.userId) === String(userId) && !x.deleted; });
      fleet = (q.fleet || []).filter(function (x) { return String(x.userId) === String(userId) && !x.deleted; });
    } catch (e) {}
    if (!lands.length && !fleet.length) return '';
    var html = '<div class="asset-quick-block"><h3 class="asset-quick-title">ثبت سریع از دارایی‌های من</h3>';
    if (lands.length) {
      html += '<p class="asset-quick-label">زمین‌ها — نیاز به خدمت</p><div class="asset-quick-list">';
      lands.forEach(function (L) {
        var t = domain() ? domain().landDisplayName(L) : L.name;
        html += '<button type="button" class="asset-quick-chip" onclick="keloStartFromLand(\'' + esc(L.id) + '\')">' + esc(t) + '</button>';
      });
      html += '</div>';
    }
    if (fleet.length) {
      html += '<p class="asset-quick-label">ماشین‌آلات — ارائه خدمت</p><div class="asset-quick-list">';
      fleet.forEach(function (F) {
        var t = domain() ? domain().machineDisplayName(F) : F.machineType;
        html += '<button type="button" class="asset-quick-chip machine" onclick="keloStartFromFleet(\'' + esc(F.id) + '\')">' + esc(t) + '</button>';
      });
      html += '</div>';
    }
    html += '</div>';
    return html;
  }

  function startFromLand(landId) {
    var q = (global.KeloQueryService && global.KeloQueryService.qdb) ? global.KeloQueryService.qdb() : global.db;
    var L = (q.lands || []).find(function (x) { return String(x.id) === String(landId); });
    if (!L) return;
    if (typeof global.openMobileFormSheet === 'function') global.openMobileFormSheet('receive');
    if (!global.wizard) return;
    if (L.area != null) global.wizard.data.area = L.area;
    if (L.location) global.wizard.data.serviceLocation = L.location;
    global.wizard.data.landId = L.id;
    if (typeof global.renderMobileFormSheet === 'function') global.renderMobileFormSheet();
  }

  function startFromFleet(fleetId) {
    var q = (global.KeloQueryService && global.KeloQueryService.qdb) ? global.KeloQueryService.qdb() : global.db;
    var F = (q.fleet || []).find(function (x) { return String(x.id) === String(fleetId); });
    if (!F) return;
    if (typeof global.openMobileFormSheet === 'function') global.openMobileFormSheet('provide');
    if (!global.wizard) return;
    if (F.service) global.wizard.service = F.service;
    global.wizard.data.machineType = F.machineType || F.name || '';
    if (F.capacity) global.wizard.data.capacity = F.capacity;
    if (F.activityArea) global.wizard.data.activityArea = F.activityArea;
    if (F.priceUnit) global.wizard.data.priceUnit = F.priceUnit;
    global.wizard.data.machineId = F.id;
    if (typeof global.renderMobileFormSheet === 'function') global.renderMobileFormSheet();
  }

  // Compat for old KeloAssets global used by request base
  global.KeloAssets = {
    quickPicksHtml: quickPicksHtml,
    renderAssetsSection: renderAssetsSection,
    captureFromRequest: function () {
      if (global.KeloAssetsService) {
        return global.KeloAssetsService.captureFromRequest.apply(null, arguments);
      }
    }
  };

  global.renderAssetsSection = renderAssetsSection;
  global.keloAssetsOpenMenu = renderAssetsMenu;
  global.keloAssetsOpenLands = openLands;
  global.keloAssetsOpenFleet = openFleet;
  global.keloAssetsStartAddLand = startAddLand;
  global.keloAssetsCloseLandMap = closeLandMap;
  function useMyLocation() {
    if (!navigator.geolocation) {
      if (typeof global.showToast === 'function') global.showToast('موقعیت مکانی در دسترس نیست', 'error');
      return;
    }
    navigator.geolocation.getCurrentPosition(function (pos) {
      var lat = pos.coords.latitude, lng = pos.coords.longitude;
      _pendingLandLoc = { lat: lat, lng: lng };
      if (_landMap) {
        _landMap.setView([lat, lng], 15);
        // fire synthetic click handling by setting marker via map click path
        if (typeof L !== 'undefined') {
          L.marker([lat, lng]).addTo(_landMap);
        }
      }
      if (typeof global.showToast === 'function') global.showToast('موقعیت فعلی روی نقشه قرار گرفت', 'success');
    }, function () {
      if (typeof global.showToast === 'function') global.showToast('اجازه دسترسی به موقعیت داده نشد', 'error');
    }, { enableHighAccuracy: true, timeout: 8000 });
  }
  global.keloAssetsUseMyLocation = useMyLocation;
  global.keloAssetsSearchLandCity = searchLandCity;
  global.keloAssetsConfirmLandMap = confirmLandMap;
  global.keloAssetsSaveLand = saveLand;
  global.keloAssetsDeleteLand = deleteLand;
  global.keloAssetsStartAddFleet = startAddFleet;
  global.keloAssetsSaveFleet = saveFleet;
  global.keloAssetsDeleteFleet = deleteFleet;
  function renderQuickPicks(mount, wizardType) {
    if (!mount) return;
    var s = svc();
    if (!s) { mount.innerHTML = ''; return; }
    var isNeed = wizardType === 'receive' || wizardType === 'need';
    var p = isNeed ? s.listLands() : s.listFleet();
    unwrap(p).then(function (res) {
      var list = [];
      if (res && res.ok && res.data) list = res.data.lands || res.data.fleet || [];
      else if (res && res.data) list = res.data.lands || res.data.fleet || [];
      if (!list || !list.length) { mount.innerHTML = ''; return; }
      var html = '<div class="asset-quick-block"><div class="asset-quick-title">از دارایی‌های من</div><div class="asset-quick-list">';
      list.forEach(function (item) {
        if (isNeed) {
          html += '<button type="button" class="asset-quick-chip" onclick="keloStartFromLand(\'' + esc(String(item.id)) + '\')">'
            + esc(item.name || 'زمین') + (item.area ? ' · ' + esc(String(item.area)) + ' هکتار' : '') + '</button>';
        } else {
          html += '<button type="button" class="asset-quick-chip" onclick="keloStartFromFleet(\'' + esc(String(item.id)) + '\')">'
            + esc(item.machineType || item.name || 'ماشین') + '</button>';
        }
      });
      html += '</div></div>';
      mount.innerHTML = html;
    }).catch(function () { mount.innerHTML = ''; });
  }
  global.keloAssetsRenderQuickPicks = renderQuickPicks;
  global.keloStartFromLand = startFromLand;
  global.keloStartFromFleet = startFromFleet;
})(typeof window !== 'undefined' ? window : globalThis);
