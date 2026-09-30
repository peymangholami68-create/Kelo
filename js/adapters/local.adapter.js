/**
 * KELO — Local Adapter (Phase 1: Auth implemented)
 *
 * فقط Local DB / localStorage.
 * بدون UI.
 */
(function (global) {
  'use strict';

  var Result = global.KeloResult;
  var Errors = global.KeloErrors;
  var SESSION_KEY = 'kelo_session_user_id';

  /** @type {null | { getDB: Function, saveDB: Function, normalizePhone: Function, normalizeNationalId: Function, isAdmin: Function }} */
  var dataAccess = null;

  function notImplemented(method) {
    return Promise.resolve(
      Result.fail(
        Errors.CODES.NOT_IMPLEMENTED,
        'LocalAdapter.' + method + ' هنوز پیاده‌سازی نشده است.'
      )
    );
  }

  function requireDataAccess() {
    if (!dataAccess || typeof dataAccess.getDB !== 'function') {
      return Result.fail(Errors.CODES.UNKNOWN, 'LocalAdapter به دیتابیس محلی متصل نشده است.');
    }
    return null;
  }

  function normalizePhone(value) {
    if (dataAccess && dataAccess.normalizePhone) return dataAccess.normalizePhone(value);
    var p = String(value || '').replace(/[۰-۹]/g, function (d) { return String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)); })
      .replace(/[٠-٩]/g, function (d) { return String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)); })
      .replace(/\s+/g, '').trim();
    if (p.indexOf('+98') === 0) p = '0' + p.substring(3);
    else if (p.indexOf('98') === 0) p = '0' + p.substring(2);
    return p;
  }

  function normalizeNationalId(value) {
    if (dataAccess && dataAccess.normalizeNationalId) return dataAccess.normalizeNationalId(value);
    return String(value || '').replace(/[۰-۹]/g, function (d) { return String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)); })
      .replace(/[٠-٩]/g, function (d) { return String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)); })
      .replace(/\D/g, '').trim();
  }

  function saveLocalSession(userId) {
    try {
      if (userId) localStorage.setItem(SESSION_KEY, String(userId));
      else localStorage.removeItem(SESSION_KEY);
    } catch (e) { /* ignore */ }
  }

  function clearLocalSession() {
    try { localStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ }
  }

  function readLocalSessionId() {
    try { return localStorage.getItem(SESSION_KEY); } catch (e) { return null; }
  }

  var LocalAdapter = {
    name: 'local',

    bindDataAccess: function (api) {
      dataAccess = api || null;
    },

    login: function (credentials) {
      var bridgeErr = requireDataAccess();
      if (bridgeErr) return Promise.resolve(bridgeErr);

      var phone = normalizePhone(credentials && credentials.phone);
      var nationalId = normalizeNationalId(credentials && credentials.nationalId);
      var authMode = (credentials && credentials.authMode) || 'public';
      var db = dataAccess.getDB();

      if (authMode === 'admin') {
        var admin = (db.users || []).find(function (u) {
          return dataAccess.isAdmin(u) && normalizePhone(u.phone) === phone;
        });
        if (!admin || normalizeNationalId(admin.nationalId) !== nationalId) {
          return Promise.resolve(Result.fail(
            Errors.CODES.LOGIN_FAILED,
            'اطلاعات ورود مدیر صحیح نیست.'
          ));
        }
        saveLocalSession(admin.id);
        return Promise.resolve(Result.ok({ user: admin, created: false }, 'ورود موفق'));
      }

      var existing = (db.users || []).find(function (u) {
        return normalizePhone(u.phone) === phone;
      });
      if (existing) {
        if (normalizeNationalId(existing.nationalId) !== nationalId) {
          return Promise.resolve(Result.fail(
            Errors.CODES.NATIONAL_ID_MISMATCH,
            Errors.messageFor(Errors.CODES.NATIONAL_ID_MISMATCH)
          ));
        }
        saveLocalSession(existing.id);
        return Promise.resolve(Result.ok({ user: existing, created: false }, 'ورود موفق'));
      }

      var duplicate = (db.users || []).find(function (u) {
        return normalizeNationalId(u.nationalId) === nationalId;
      });
      if (duplicate) {
        return Promise.resolve(Result.fail(
          Errors.CODES.CONFLICT,
          'این کد ملی قبلاً ثبت شده است.'
        ));
      }

      var newUser = {
        id: 'u_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
        name: '',
        phone: phone,
        nationalId: nationalId,
        profileCompleted: false,
        profile: {}
      };
      db.users.push(newUser);
      if (typeof dataAccess.saveDB === 'function') dataAccess.saveDB();
      saveLocalSession(newUser.id);
      return Promise.resolve(Result.ok({ user: newUser, created: true }, 'ثبت‌نام موفق'));
    },

    logout: function () {
      clearLocalSession();
      return Promise.resolve(Result.ok({ local: true }, 'خروج انجام شد'));
    },

    getCurrentUser: function () {
      var bridgeErr = requireDataAccess();
      if (bridgeErr) return Promise.resolve(bridgeErr);
      var id = readLocalSessionId();
      if (!id) return Promise.resolve(Result.ok(null));
      var db = dataAccess.getDB();
      var user = (db.users || []).find(function (u) { return String(u.id) === String(id); });
      if (!user) {
        clearLocalSession();
        return Promise.resolve(Result.ok(null));
      }
      return Promise.resolve(Result.ok(user));
    },

    /**
     * @param {{ userId: string, name: string, phone?: string, nationalId?: string, profile?: object, profileLocation?: object|null, profileCompleted?: boolean }} data
     */
    saveProfile: function (data) {
      var bridgeErr = requireDataAccess();
      if (bridgeErr) return Promise.resolve(bridgeErr);
      if (!data || !data.userId) {
        return Promise.resolve(Result.fail(Errors.CODES.UNAUTHORIZED, Errors.messageFor(Errors.CODES.UNAUTHORIZED)));
      }
      var db = dataAccess.getDB();
      var user = (db.users || []).find(function (u) { return String(u.id) === String(data.userId); });
      if (!user) {
        return Promise.resolve(Result.fail(Errors.CODES.NOT_FOUND, 'کاربر پیدا نشد.'));
      }

      var phone = data.phone !== undefined ? normalizePhone(data.phone) : user.phone;
      var nationalId = data.nationalId !== undefined ? normalizeNationalId(data.nationalId) : user.nationalId;

      if (data.phone !== undefined) {
        var dupPhone = (db.users || []).find(function (u) {
          return String(u.id) !== String(user.id) && normalizePhone(u.phone) === phone;
        });
        if (dupPhone) {
          return Promise.resolve(Result.fail(Errors.CODES.CONFLICT, 'این شماره همراه قبلاً ثبت شده است.'));
        }
      }
      if (data.nationalId !== undefined) {
        var dupNid = (db.users || []).find(function (u) {
          return String(u.id) !== String(user.id) && normalizeNationalId(u.nationalId) === nationalId;
        });
        if (dupNid) {
          return Promise.resolve(Result.fail(Errors.CODES.CONFLICT, 'این کد ملی قبلاً ثبت شده است.'));
        }
      }

      if (data.name !== undefined) user.name = String(data.name || '').trim();
      if (data.phone !== undefined) user.phone = phone;
      if (data.nationalId !== undefined) user.nationalId = nationalId;
      if (data.profile !== undefined) user.profile = data.profile || {};
      if (data.profileLocation !== undefined) {
        if (data.profileLocation) user.profileLocation = data.profileLocation;
        else delete user.profileLocation;
      }
      if (data.profileCompleted !== undefined) user.profileCompleted = !!data.profileCompleted;

      if (typeof dataAccess.saveDB === 'function') dataAccess.saveDB();
      return Promise.resolve(Result.ok({ user: user }, 'اطلاعات ذخیره شد'));
    },
    saveFirstProfile: function (data) {
      return this.saveProfile(data);
    },
    createRequest: function () { return notImplemented('createRequest'); },
    updateRequest: function () { return notImplemented('updateRequest'); },
    deleteRequest: function () { return notImplemented('deleteRequest'); },
    getRequest: function () { return notImplemented('getRequest'); },
    sendProposal: function () { return notImplemented('sendProposal'); },
    acceptProposal: function () { return notImplemented('acceptProposal'); },
    rejectProposal: function () { return notImplemented('rejectProposal'); },
    cancelProposal: function () { return notImplemented('cancelProposal'); },
    cancelDeal: function () { return notImplemented('cancelDeal'); },
    completeDeal: function () { return notImplemented('completeDeal'); },
    payDeal: function () { return notImplemented('payDeal'); }
  };

  global.KeloLocalAdapter = LocalAdapter;
})(typeof window !== 'undefined' ? window : globalThis);
