/**
 * KELO — Assets domain (lands / fleet)
 */
(function (global) {
  'use strict';

  function almostSameLocation(a, b) {
    if (!a || !b || typeof a.lat !== 'number' || typeof b.lat !== 'number') return false;
    return Math.abs(a.lat - b.lat) < 0.0008 && Math.abs(a.lng - b.lng) < 0.0008;
  }

  function isSameLand(a, b) {
    if (!a || !b) return false;
    if (a.location && b.location && almostSameLocation(a.location, b.location)) {
      if (a.area != null && b.area != null && Number(a.area) === Number(b.area)) return true;
      return true;
    }
    if (a.name && b.name && String(a.name).trim() === String(b.name).trim() &&
        a.area != null && b.area != null && Number(a.area) === Number(b.area)) return true;
    return false;
  }

  function isSameMachine(a, b) {
    if (!a || !b) return false;
    if (String(a.service || '') !== String(b.service || '')) return false;
    return String(a.machineType || a.name || '').trim() === String(b.machineType || b.name || '').trim();
  }

  function validateLand(input) {
    var d = input || {};
    if (!d.location || typeof d.location.lat !== 'number' || typeof d.location.lng !== 'number') {
      return { ok: false, message: 'موقعیت زمین روی نقشه الزامی است.' };
    }
    var area = d.area != null ? Number(d.area) : NaN;
    if (!(area > 0)) return { ok: false, message: 'مساحت زمین باید بیشتر از صفر باشد.' };
    if (!d.name || !String(d.name).trim()) return { ok: false, message: 'نام زمین یا مزرعه را وارد کنید.' };
    return { ok: true };
  }

  function validateMachine(input) {
    var d = input || {};
    if (!d.service) return { ok: false, message: 'نوع خدمت را انتخاب کنید.' };
    if (!d.machineType || !String(d.machineType).trim()) {
      return { ok: false, message: 'نوع ماشین‌آلات را وارد کنید.' };
    }
    return { ok: true };
  }

  function landDisplayName(land) {
    if (!land) return 'زمین';
    if (land.name && String(land.name).trim()) return String(land.name).trim();
    if (land.area) return land.area + ' هکتار';
    return 'زمین من';
  }

  function machineDisplayName(m) {
    if (!m) return 'ماشین';
    if (m.machineType && String(m.machineType).trim()) return String(m.machineType).trim();
    if (m.name) return String(m.name);
    return 'ماشین من';
  }

  function landFromRequestData(userId, service, data) {
    data = data || {};
    var area = data.area != null ? Number(data.area) : null;
    var loc = data.serviceLocation || null;
    var name = (area ? (area + ' هکتار') : 'زمین من');
    if (data.city) name = name;
    return {
      userId: userId,
      name: name,
      area: area,
      location: loc,
      city: (loc && loc.city) || data.city || '',
      crop: data.crop || null,
      sourceService: service || null
    };
  }

  function machineFromRequestData(userId, service, data) {
    data = data || {};
    return {
      userId: userId,
      name: data.machineType || 'ماشین من',
      service: service,
      machineType: data.machineType || '',
      capacity: data.capacity || '',
      activityArea: data.activityArea || [],
      priceUnit: data.priceUnit || ''
    };
  }

  global.KeloAssetsDomain = {
    isSameLand: isSameLand,
    isSameMachine: isSameMachine,
    validateLand: validateLand,
    validateMachine: validateMachine,
    landDisplayName: landDisplayName,
    machineDisplayName: machineDisplayName,
    landFromRequestData: landFromRequestData,
    machineFromRequestData: machineFromRequestData,
    almostSameLocation: almostSameLocation
  };
})(typeof window !== 'undefined' ? window : globalThis);
