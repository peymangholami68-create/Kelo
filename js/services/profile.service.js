/**
 * KELO — Profile Service (Phase 2)
 *
 * UI فقط این API را صدا می‌زند.
 */
(function (global) {
  'use strict';

  var Result = global.KeloResult;
  var Errors = global.KeloErrors;
  var State = global.KeloState;

  function getAdapter() {
    if (global.KeloService && typeof global.KeloService.adapter === 'function') {
      return global.KeloService.adapter();
    }
    var backend = global.KeloBackend;
    if (backend && typeof backend.isServerMode === 'function' && backend.isServerMode()) {
      return global.KeloApiAdapter;
    }
    return global.KeloLocalAdapter;
  }

  function currentUserId() {
    if (State && typeof State.getCurrentUser === 'function') {
      var u = State.getCurrentUser();
      if (u && u.id) return u.id;
    }
    return null;
  }

  /**
   * @param {{
   *   name: string,
   *   phone?: string,
   *   nationalId?: string,
   *   profile?: object,
   *   profileLocation?: object|null,
   *   profileCompleted?: boolean,
   *   requireCity?: boolean,
   *   allowIdentityChange?: boolean
   * }} input
   */
  async function save(input) {
    var data = input || {};
    var name = String(data.name || '').trim();
    if (!name || name.length < 2) {
      return Result.fail(Errors.CODES.VALIDATION, 'نام کامل را وارد کنید.');
    }

    if (data.requireCity) {
      var city = data.profile && data.profile.city;
      if (!city) {
        return Result.fail(Errors.CODES.VALIDATION, 'شهر را انتخاب کنید.');
      }
    }

    var phone = data.phone !== undefined ? String(data.phone || '').trim() : undefined;
    var nationalId = data.nationalId !== undefined ? String(data.nationalId || '').trim() : undefined;

    if (data.allowIdentityChange) {
      if (phone !== undefined) {
        // normalize light check — adapter also normalizes
        var phoneDigits = phone.replace(/[۰-۹]/g, function (d) { return String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)); })
          .replace(/[٠-٩]/g, function (d) { return String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)); })
          .replace(/\s+/g, '');
        if (phoneDigits.indexOf('+98') === 0) phoneDigits = '0' + phoneDigits.substring(3);
        else if (phoneDigits.indexOf('98') === 0) phoneDigits = '0' + phoneDigits.substring(2);
        if (!/^09\d{9}$/.test(phoneDigits)) {
          return Result.fail(Errors.CODES.INVALID_PHONE, Errors.messageFor(Errors.CODES.INVALID_PHONE));
        }
        phone = phoneDigits;
      }
      if (nationalId !== undefined) {
        var nid = nationalId.replace(/[۰-۹]/g, function (d) { return String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)); })
          .replace(/[٠-٩]/g, function (d) { return String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)); })
          .replace(/\D/g, '');
        if (!/^\d{10}$/.test(nid)) {
          return Result.fail(Errors.CODES.INVALID_NATIONAL_ID, Errors.messageFor(Errors.CODES.INVALID_NATIONAL_ID));
        }
        nationalId = nid;
      }
    }

    var userId = data.userId || currentUserId();
    if (!userId) {
      return Result.fail(Errors.CODES.UNAUTHORIZED, Errors.messageFor(Errors.CODES.UNAUTHORIZED));
    }

    var payload = {
      userId: userId,
      name: name,
      profile: data.profile || {},
      profileLocation: data.profileLocation !== undefined ? data.profileLocation : null,
      profileCompleted: data.profileCompleted !== undefined ? !!data.profileCompleted : true
    };
    if (phone !== undefined) payload.phone = phone;
    if (nationalId !== undefined) payload.nationalId = nationalId;

    var adapter = getAdapter();
    if (!adapter || typeof adapter.saveProfile !== 'function') {
      return Result.fail(Errors.CODES.UNKNOWN, 'Adapter پروفایل در دسترس نیست.');
    }

    var result = await adapter.saveProfile(payload);
    if (result && result.ok && result.data && result.data.user) {
      if (State && typeof State.setCurrentUser === 'function') {
        State.setCurrentUser(result.data.user);
      }
    }
    return result;
  }

  var profileService = {
    save: save
  };

  global.KeloProfileService = profileService;
  if (global.KeloService) {
    global.KeloService.profile = profileService;
  }
})(typeof window !== 'undefined' ? window : globalThis);
