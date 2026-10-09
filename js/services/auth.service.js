/**
 * KELO — Auth Service (Phase 1)
 *
 * مالک قوانین اعتبارسنجی ورودی و orchestration ورود/خروج.
 * UI فقط این API را صدا می‌زند؛ Adapter را مستقیم صدا نمی‌زند.
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
    // Fallback only if facade not loaded yet — never resolve transport mode here.
    return global.KeloLocalAdapter || global.KeloApiAdapter || null;
  }

  function getMode() {
    if (global.KeloService && typeof global.KeloService.mode === 'function') {
      return global.KeloService.mode();
    }
    if (global.KeloState && typeof global.KeloState.getSession === 'function') {
      var s = global.KeloState.getSession();
      return (s && s.mode) || 'local';
    }
    return 'local';
  }

  function normalizePhone(value) {
    var p = String(value || '').replace(/[۰-۹]/g, function (d) { return String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)); })
      .replace(/[٠-٩]/g, function (d) { return String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)); })
      .replace(/\s+/g, '').trim();
    if (p.indexOf('+98') === 0) p = '0' + p.substring(3);
    else if (p.indexOf('98') === 0) p = '0' + p.substring(2);
    return p;
  }

  function normalizeNationalId(value) {
    return String(value || '').replace(/[۰-۹]/g, function (d) { return String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)); })
      .replace(/[٠-٩]/g, function (d) { return String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)); })
      .replace(/\D/g, '').trim();
  }

  function validateCredentials(phone, nationalId) {
    if (!/^09\d{9}$/.test(phone)) {
      return Result.fail(Errors.CODES.INVALID_PHONE, Errors.messageFor(Errors.CODES.INVALID_PHONE));
    }
    if (!/^\d{10}$/.test(nationalId)) {
      return Result.fail(Errors.CODES.INVALID_NATIONAL_ID, Errors.messageFor(Errors.CODES.INVALID_NATIONAL_ID));
    }
    return null;
  }

  /**
   * @param {{ phone: string, nationalId: string, authMode?: 'public'|'admin' }} credentials
   * @returns {Promise<{ok:boolean, data?: any, code?: string, message?: string}>}
   */
  async function login(credentials) {
    var mode = getMode();
    if (mode === 'server-error') {
      return Result.fail(
        Errors.CODES.SERVER_UNAVAILABLE,
        'ارتباط با سرور کِلو برقرار نشد. لطفاً دوباره تلاش کنید.'
      );
    }

    var phone = normalizePhone(credentials && credentials.phone);
    var nationalId = normalizeNationalId(credentials && credentials.nationalId);
    var authMode = (credentials && credentials.authMode) || 'public';

    var validationError = validateCredentials(phone, nationalId);
    if (validationError) return validationError;

    var adapter = getAdapter();
    if (!adapter || typeof adapter.login !== 'function') {
      return Result.fail(Errors.CODES.UNKNOWN, 'Adapter ورود در دسترس نیست.');
    }

    var result = await adapter.login({ phone: phone, nationalId: nationalId, authMode: authMode });
    if (result && result.ok && result.data && result.data.user) {
      if (State && typeof State.setCurrentUser === 'function') {
        State.setCurrentUser(result.data.user);
      }
      if (State && typeof State.setSessionMode === 'function') {
        State.setSessionMode(mode, true);
      }
    }
    return result;
  }

  async function logout() {
    var adapter = getAdapter();
    var result = Result.ok({ local: true });
    if (adapter && typeof adapter.logout === 'function') {
      try {
        result = await adapter.logout();
      } catch (e) {
        console.warn('KELO auth.logout adapter failed', e);
        result = Result.ok({ warned: true });
      }
    }
    if (State && typeof State.clearCurrentUser === 'function') {
      State.clearCurrentUser();
    }
    return result && result.ok ? result : Result.ok({});
  }

  /**
   * بازیابی session بعد از init بک‌اند.
   * @returns {Promise<{ok:boolean, data: {user: any|null, mode: string}}>}
   */
  async function restoreSession() {
    var mode = getMode();
    if (State && typeof State.setSessionMode === 'function') {
      State.setSessionMode(mode, true);
    }

    if (mode === 'server-error') {
      return Result.fail(
        Errors.CODES.SERVER_UNAVAILABLE,
        'سرویس داده کِلو در دسترس نیست.'
      );
    }

    var adapter = getAdapter();
    if (!adapter || typeof adapter.getCurrentUser !== 'function') {
      return Result.ok({ user: null, mode: mode });
    }

    var result = await adapter.getCurrentUser();
    if (!result || !result.ok) {
      return Result.ok({ user: null, mode: mode, error: result });
    }

    var user = result.data || null;
    if (user && State && typeof State.setCurrentUser === 'function') {
      State.setCurrentUser(user);
    } else if (!user && State && typeof State.clearCurrentUser === 'function') {
      State.clearCurrentUser();
    }

    return Result.ok({ user: user, mode: mode });
  }

  async function upsertUserMirror(user) {
    var adapter = getAdapter();
    if (!adapter || typeof adapter.upsertUserMirror !== 'function') {
      return Result.ok({ user: user });
    }
    return adapter.upsertUserMirror({ user: user });
  }

  function getCurrentUser() {
    if (State && typeof State.getCurrentUser === 'function') {
      return State.getCurrentUser();
    }
    return null;
  }

  var authService = {
    login: login,
    upsertUserMirror: upsertUserMirror,
    logout: logout,
    restoreSession: restoreSession,
    getCurrentUser: getCurrentUser,
    normalizePhone: normalizePhone,
    normalizeNationalId: normalizeNationalId
  };

  global.KeloAuthService = authService;

  // اتصال به KeloService
  if (global.KeloService) {
    global.KeloService.auth = authService;
  } else {
    document.addEventListener('DOMContentLoaded', function () {
      if (global.KeloService) global.KeloService.auth = authService;
    });
  }
})(typeof window !== 'undefined' ? window : globalThis);
