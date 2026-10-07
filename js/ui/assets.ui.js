/**
 * KELO — User assets (lands + fleet). Profile CRUD + auto-save from first request.
 */
(function (global) {
  'use strict';

  function qdb() {
    if (global.KeloQueryService && typeof global.KeloQueryService.qdb === 'function') {
      return global.KeloQueryService.qdb();
    }
    return global.db || { lands: [], fleet: [], users: [] };
  }

  function ensureArrays() {
    var db = global.db;
    if (!db) return;
    if (!Array.isArray(db.lands)) db.lands = [];
    if (!Array.isArray(db.fleet)) db.fleet = [];
  }

  function uid(prefix) {
    return (prefix || 'a') + '_' + Date.now().toString(36) + '_' + Math.floor(Math.random() * 1e4);
  }

  function escapeHtml(s) {
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

  function listLands(userId) {
    ensureArrays();
    return (qdb().lands || []).filter(function (x) {
      return String(x.userId) === String(userId) && !x.deleted;
    });
  }

  function listFleet(userId) {
    ensureArrays();
    return (qdb().fleet || []).filter(function (x) {
      return String(x.userId) === String(userId) && !x.deleted;
    });
  }

  function persist() {
    ensureArrays();
    if (typeof global.saveDB === 'function') global.saveDB();
  }

  function upsertLand(land) {
    ensureArrays();
    var db = global.db;
    var i = db.lands.findIndex(function (x) { return String(x.id) === String(land.id); });
    if (i >= 0) db.lands[i] = land;
    else db.lands.push(land);
    persist();
    return land;
  }

  function upsertFleet(item) {
    ensureArrays();
    var db = global.db;
    var i = db.fleet.findIndex(function (x) { return String(x.id) === String(item.id); });
    if (i >= 0) db.fleet[i] = item;
    else db.fleet.push(item);
    persist();
    return item;
  }

  function removeLand(id, userId) {
    ensureArrays();
    var row = (global.db.lands || []).find(function (x) { return String(x.id) === String(id); });
    if (row && String(row.userId) === String(userId)) {
      row.deleted = true;
      persist();
    }
  }

  function removeFleet(id, userId) {
    ensureArrays();
    var row = (global.db.fleet || []).find(function (x) { return String(x.id) === String(id); });
    if (row && String(row.userId) === String(userId)) {
      row.deleted = true;
      persist();
    }
  }

  /** After successful need/provide create — save asset if not duplicate-ish */
  function captureFromRequest(userId, kind, service, data) {
    if (!userId || !data) return null;
    ensureArrays();
    data = data || {};
    if (kind === 'need' || kind === 'receive') {
      var lands = listLands(userId);
      var loc = data.serviceLocation || null;
      var area = data.area || data.amount || null;
      // skip if similar land exists (same area + roughly same location)
      var exists = lands.some(function (L) {
        if (area && L.area && Number(L.area) === Number(area) && loc && L.location && L.location.lat && loc.lat) {
          return Math.abs(L.location.lat - loc.lat) < 0.001 && Math.abs(L.location.lng - loc.lng) < 0.001;
        }
        return false;
      });
      if (exists) return null;
      var land = {
        id: uid('land'),
        userId: userId,
        name: (area ? (area + ' هکتار') : 'زمین من'),
        area: area,
        location: loc,
        city: (loc && loc.city) || data.city || '',
        crop: data.crop || null,
        createdAt: new Date().toISOString()
      };
      return upsertLand(land);
    }
    if (kind === 'provide') {
      var fleet = listFleet(userId);
      var mt = data.machineType || '';
      var existsM = fleet.some(function (f) {
        return f.service === service && String(f.machineType || '') === String(mt);
      });
      if (existsM) return null;
      var item = {
        id: uid('fleet'),
        userId: userId,
        name: mt || serviceLabel(service),
        service: service,
        machineType: mt,
        capacity: data.capacity || '',
        activityArea: data.activityArea || [],
        priceUnit: data.priceUnit || '',
        createdAt: new Date().toISOString()
      };
      return upsertFleet(item);
    }
    return null;
  }

  function landTitle(L) {
    var parts = [];
    if (L.name) parts.push(L.name);
    if (L.area) parts.push(L.area + ' هکتار');
    if (L.city) parts.push(L.city);
    return parts.join(' · ') || 'زمین';
  }

  function fleetTitle(F) {
    var parts = [];
    if (F.machineType) parts.push(F.machineType);
    else if (F.name) parts.push(F.name);
    if (F.service) parts.push(serviceLabel(F.service));
    return parts.join(' · ') || 'ماشین';
  }

  // —— Profile UI ——
  function renderAssetsSection() {
    var sheet = document.getElementById('mobileAccountSheet');
    if (!sheet || !global.currentUser) return;
    var uid_ = global.currentUser.id;
    var lands = listLands(uid_);
    var fleet = listFleet(uid_);
    var landHtml = lands.length
      ? lands.map(function (L) {
          return '<div class="asset-row">'
            + '<div class="asset-row-main"><strong>' + escapeHtml(landTitle(L)) + '</strong>'
            + (L.city ? '<span class="asset-meta">' + escapeHtml(L.city) + '</span>' : '')
            + '</div>'
            + '<button type="button" class="btn btn-outline asset-del" onclick="keloDeleteLand(\'' + L.id + '\')">حذف</button>'
            + '</div>';
        }).join('')
      : '<p class="text-muted">هنوز زمینی ذخیره نشده. از «افزودن زمین» یا با اولین درخواست نیاز ذخیره می‌شود.</p>';
    var fleetHtml = fleet.length
      ? fleet.map(function (F) {
          return '<div class="asset-row">'
            + '<div class="asset-row-main"><strong>' + escapeHtml(fleetTitle(F)) + '</strong>'
            + '<span class="asset-meta">' + escapeHtml(serviceLabel(F.service)) + '</span></div>'
            + '<button type="button" class="btn btn-outline asset-del" onclick="keloDeleteFleet(\'' + F.id + '\')">حذف</button>'
            + '</div>';
        }).join('')
      : '<p class="text-muted">هنوز ماشینی ذخیره نشده. از «افزودن ماشین» یا با اولین ارائه خدمت ذخیره می‌شود.</p>';

    var header = (typeof global.mobileAccountInnerHeader === 'function')
      ? global.mobileAccountInnerHeader('دارایی‌های من')
      : '<div class="mobile-account-header"><h2>دارایی‌های من</h2></div>';

    sheet.innerHTML = header
      + '<div class="mobile-account-body asset-body">'
      + '<h3 class="mobile-account-section-label">زمین‌ها</h3>'
      + landHtml
      + '<button type="button" class="btn btn-brand btn-block" style="margin:12px 0 20px" onclick="keloOpenAddLand()">+ افزودن زمین</button>'
      + '<h3 class="mobile-account-section-label">ماشین‌آلات</h3>'
      + fleetHtml
      + '<button type="button" class="btn btn-brand btn-block" style="margin:12px 0" onclick="keloOpenAddFleet()">+ افزودن ماشین</button>'
      + '</div>';
    if (typeof global.attachSheetDragOnce === 'function') global.attachSheetDragOnce(sheet);
  }

  function openAddLand() {
    var name = prompt('نام زمین (مثلاً مزرعه ساری):', 'زمین من');
    if (name === null) return;
    var areaStr = prompt('مساحت (هکتار):', '2');
    if (areaStr === null) return;
    var area = parseFloat(areaStr) || 0;
    upsertLand({
      id: uid('land'),
      userId: global.currentUser.id,
      name: name || 'زمین من',
      area: area,
      location: (global.currentUser && global.currentUser.profileLocation) || null,
      city: (global.currentUser && global.currentUser.profile && global.currentUser.profile.city) || '',
      createdAt: new Date().toISOString()
    });
    if (typeof global.showToast === 'function') global.showToast('زمین ذخیره شد', 'success');
    renderAssetsSection();
  }

  function openAddFleet() {
    var mt = prompt('نوع ماشین (مثلاً سمپاش توربینی):', '');
    if (mt === null) return;
    var svc = prompt('کد خدمت (tractor / planting / spray / harvest):', 'spray');
    if (svc === null) return;
    svc = String(svc || 'spray').trim();
    if (!global.SERVICE_DEFS || !global.SERVICE_DEFS[svc]) svc = 'spray';
    upsertFleet({
      id: uid('fleet'),
      userId: global.currentUser.id,
      name: mt || serviceLabel(svc),
      service: svc,
      machineType: mt || '',
      capacity: '',
      activityArea: [],
      createdAt: new Date().toISOString()
    });
    if (typeof global.showToast === 'function') global.showToast('ماشین ذخیره شد', 'success');
    renderAssetsSection();
  }

  function deleteLand(id) {
    if (!confirm('این زمین حذف شود؟')) return;
    removeLand(id, global.currentUser.id);
    renderAssetsSection();
  }

  function deleteFleet(id) {
    if (!confirm('این ماشین حذف شود؟')) return;
    removeFleet(id, global.currentUser.id);
    renderAssetsSection();
  }

  /** Prefill wizard from land and open receive form */
  function startFromLand(landId) {
    var L = listLands(global.currentUser.id).find(function (x) { return String(x.id) === String(landId); });
    if (!L) return;
    if (typeof global.openMobileFormSheet === 'function') global.openMobileFormSheet('receive');
    if (!global.wizard) return;
    if (L.area != null) global.wizard.data.area = L.area;
    if (L.location) global.wizard.data.serviceLocation = L.location;
    global.wizard._assetLandId = landId;
    if (typeof global.renderMobileFormSheet === 'function') global.renderMobileFormSheet();
  }

  function startFromFleet(fleetId) {
    var F = listFleet(global.currentUser.id).find(function (x) { return String(x.id) === String(fleetId); });
    if (!F) return;
    if (typeof global.openMobileFormSheet === 'function') global.openMobileFormSheet('provide');
    if (!global.wizard) return;
    if (F.service) global.wizard.service = F.service;
    global.wizard.data.machineType = F.machineType || F.name || '';
    if (F.capacity) global.wizard.data.capacity = F.capacity;
    if (F.activityArea) global.wizard.data.activityArea = F.activityArea;
    if (F.priceUnit) global.wizard.data.priceUnit = F.priceUnit;
    global.wizard._assetFleetId = fleetId;
    if (typeof global.renderMobileFormSheet === 'function') global.renderMobileFormSheet();
  }

  /** Quick picks HTML for request base page */
  function quickPicksHtml(userId) {
    var lands = listLands(userId);
    var fleet = listFleet(userId);
    if (!lands.length && !fleet.length) return '';
    var html = '<div class="asset-quick-block"><h3 class="asset-quick-title">ثبت سریع از دارایی‌های من</h3>';
    if (lands.length) {
      html += '<p class="asset-quick-label">زمین‌ها — نیاز به خدمت</p><div class="asset-quick-list">';
      lands.forEach(function (L) {
        html += '<button type="button" class="asset-quick-chip" onclick="keloStartFromLand(\'' + L.id + '\')">' + escapeHtml(landTitle(L)) + '</button>';
      });
      html += '</div>';
    }
    if (fleet.length) {
      html += '<p class="asset-quick-label">ماشین‌آلات — ارائه خدمت</p><div class="asset-quick-list">';
      fleet.forEach(function (F) {
        html += '<button type="button" class="asset-quick-chip machine" onclick="keloStartFromFleet(\'' + F.id + '\')">' + escapeHtml(fleetTitle(F)) + '</button>';
      });
      html += '</div>';
    }
    html += '</div>';
    return html;
  }

  global.KeloAssets = {
    listLands: listLands,
    listFleet: listFleet,
    captureFromRequest: captureFromRequest,
    renderAssetsSection: renderAssetsSection,
    quickPicksHtml: quickPicksHtml,
    ensureArrays: ensureArrays
  };
  global.keloOpenAddLand = openAddLand;
  global.keloOpenAddFleet = openAddFleet;
  global.keloDeleteLand = deleteLand;
  global.keloDeleteFleet = deleteFleet;
  global.keloStartFromLand = startFromLand;
  global.keloStartFromFleet = startFromFleet;
  global.renderAssetsSection = renderAssetsSection;
})(typeof window !== 'undefined' ? window : global);
