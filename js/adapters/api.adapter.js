/**
 * KELO — API Adapter (Phase 1: Auth implemented)
 *
 * فقط REST از طریق KeloBackend موجود.
 * بدون Business Logic. بدون UI.
 */
(function (global) {
  'use strict';

  var Result = global.KeloResult;
  var Errors = global.KeloErrors;

  function notImplemented(method) {
    return Promise.resolve(
      Result.fail(
        Errors.CODES.NOT_IMPLEMENTED,
        'ApiAdapter.' + method + ' هنوز پیاده‌سازی نشده است.'
      )
    );
  }

  function backend() {
    return global.KeloBackend;
  }

  var ApiAdapter = {
    name: 'api',

    login: function (credentials) {
      var b = backend();
      if (!b || typeof b.login !== 'function') {
        return Promise.resolve(Result.fail(
          Errors.CODES.SERVER_UNAVAILABLE,
          Errors.messageFor(Errors.CODES.SERVER_UNAVAILABLE)
        ));
      }
      var phone = credentials && credentials.phone;
      var nationalId = credentials && credentials.nationalId;
      var authMode = (credentials && credentials.authMode) || 'public';

      return b.login(phone, nationalId, authMode)
        .then(function (result) {
          if (result && result.user) {
            return Result.ok({
              user: result.user,
              created: !!result.created
            }, 'ورود موفق');
          }
          return Result.fail(Errors.CODES.LOGIN_FAILED, Errors.messageFor(Errors.CODES.LOGIN_FAILED));
        })
        .catch(function (err) {
          if (err && err.status === 429) {
            var tooMany = (err.body && err.body.error) ||
              'تعداد تلاش‌های ورود بیش از حد مجاز است. لطفاً چند دقیقه دیگر دوباره امتحان کنید.';
            return Result.fail(Errors.CODES.CONFLICT, tooMany);
          }
          if (err && err.status === 401) {
            var msg = authMode === 'admin'
              ? 'اطلاعات ورود مدیر صحیح نیست.'
              : 'شماره همراه یا کد ملی صحیح نیست.';
            return Result.fail(Errors.CODES.LOGIN_FAILED, msg);
          }
          return Result.fromError(err, Errors.CODES.NETWORK, 'خطا در ارتباط با سرور.');
        });
    },

    logout: function () {
      var b = backend();
      if (!b || typeof b.logout !== 'function') {
        return Promise.resolve(Result.ok({ local: true }));
      }
      return b.logout()
        .then(function () { return Result.ok({ server: true }, 'خروج انجام شد'); })
        .catch(function (err) {
          console.warn('KELO ApiAdapter.logout failed', err);
          return Result.ok({ server: true, warned: true }, 'خروج انجام شد');
        });
    },

    getCurrentUser: function () {
      var b = backend();
      if (!b || typeof b.me !== 'function') {
        return Promise.resolve(Result.ok(null));
      }
      return b.me()
        .then(function (user) { return Result.ok(user || null); })
        .catch(function (err) {
          if (err && err.status === 401) return Result.ok(null);
          return Result.fromError(err, Errors.CODES.NETWORK, Errors.messageFor(Errors.CODES.NETWORK));
        });
    },

    /**
     * @param {{ name: string, phone?: string, nationalId?: string, profile?: object, profileLocation?: object|null, profileCompleted?: boolean }} data
     */
    saveProfile: function (data) {
      var b = backend();
      if (!b || typeof b.updateProfile !== 'function') {
        return Promise.resolve(Result.fail(
          Errors.CODES.SERVER_UNAVAILABLE,
          Errors.messageFor(Errors.CODES.SERVER_UNAVAILABLE)
        ));
      }
      var payload = {
        name: data && data.name,
        phone: data && data.phone,
        nationalId: data && data.nationalId,
        profileCompleted: data && data.profileCompleted !== undefined ? !!data.profileCompleted : true,
        profile: (data && data.profile) || {},
        profileLocation: data && data.profileLocation !== undefined ? data.profileLocation : null
      };
      return b.updateProfile(payload)
        .then(function (updated) {
          var user = (updated && updated.user) ? updated.user : updated;
          if (!user) {
            return Result.fail(Errors.CODES.PROFILE_SAVE_FAILED, Errors.messageFor(Errors.CODES.PROFILE_SAVE_FAILED));
          }
          return Result.ok({ user: user }, 'اطلاعات ذخیره شد');
        })
        .catch(function (err) {
          if (err && err.status === 409) {
            return Result.fail(
              Errors.CODES.CONFLICT,
              (err.body && err.body.error) || 'این شماره همراه یا کد ملی قبلاً ثبت شده است.'
            );
          }
          return Result.fromError(err, Errors.CODES.PROFILE_SAVE_FAILED, Errors.messageFor(Errors.CODES.PROFILE_SAVE_FAILED));
        });
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

  global.KeloApiAdapter = ApiAdapter;
})(typeof window !== 'undefined' ? window : globalThis);
