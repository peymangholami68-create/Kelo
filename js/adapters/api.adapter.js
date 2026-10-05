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
            var serverMsg = err.body && err.body.error;
            var serverCode = err.body && err.body.code;
            if (serverCode === 'NATIONAL_ID_MISMATCH' || (serverMsg && serverMsg.indexOf('کد ملی دیگری') !== -1)) {
              return Result.fail(
                Errors.CODES.NATIONAL_ID_MISMATCH,
                serverMsg || Errors.messageFor(Errors.CODES.NATIONAL_ID_MISMATCH)
              );
            }
            var msg = serverMsg || (authMode === 'admin'
              ? 'اطلاعات ورود مدیر صحیح نیست.'
              : 'شماره همراه یا کد ملی صحیح نیست.');
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
    createRequest: function (payload) {
      var b = backend();
      if (!b || typeof b.createRequest !== 'function') {
        return Promise.resolve(Result.fail(Errors.CODES.SERVER_UNAVAILABLE, Errors.messageFor(Errors.CODES.SERVER_UNAVAILABLE)));
      }
      var p = payload || {};
      return b.createRequest(p.service, p.data, p.requestKind || 'need')
        .then(function (result) {
          return Result.ok({
            id: result && result.id,
            snapshot: result,
            kind: 'request'
          }, 'درخواست ثبت شد');
        })
        .catch(function (err) {
          return Result.fromError(err, Errors.CODES.UNKNOWN, 'ذخیره اطلاعات روی سرور انجام نشد.');
        });
    },

    updateRequest: function (payload) {
      var b = backend();
      if (!b || typeof b.updateRequest !== 'function') {
        return Promise.resolve(Result.fail(Errors.CODES.SERVER_UNAVAILABLE, Errors.messageFor(Errors.CODES.SERVER_UNAVAILABLE)));
      }
      var p = payload || {};
      return b.updateRequest(p.id, p.service, p.data)
        .then(function (result) {
          return Result.ok({
            id: (result && result.id) || p.id,
            snapshot: result,
            kind: 'request'
          }, 'درخواست به‌روزرسانی شد');
        })
        .catch(function (err) {
          return Result.fromError(err, Errors.CODES.REQUEST_INVALID_STATE, 'ذخیره اطلاعات روی سرور انجام نشد.');
        });
    },

    deleteRequest: function (payload) {
      var b = backend();
      if (!b || typeof b.deleteRequest !== 'function') {
        return Promise.resolve(Result.fail(Errors.CODES.SERVER_UNAVAILABLE, Errors.messageFor(Errors.CODES.SERVER_UNAVAILABLE)));
      }
      var p = payload || {};
      return b.deleteRequest(p.id)
        .then(function (result) {
          return Result.ok({ id: p.id, snapshot: result }, 'درخواست حذف شد');
        })
        .catch(function (err) {
          return Result.fromError(err, Errors.CODES.UNKNOWN, 'حذف درخواست انجام نشد.');
        });
    },

    getRequest: function (payload) {
      // Server mode: request list lives in local mirror after bootstrap/snapshot.
      // For now UI still hydrates edit from mirrored db via Local path when needed.
      return Promise.resolve(Result.fail(Errors.CODES.NOT_IMPLEMENTED, 'ApiAdapter.getRequest از mirror محلی استفاده می‌شود.'));
    },

    createListing: function (payload) {
      var b = backend();
      if (!b || typeof b.createListing !== 'function') {
        return Promise.resolve(Result.fail(Errors.CODES.SERVER_UNAVAILABLE, Errors.messageFor(Errors.CODES.SERVER_UNAVAILABLE)));
      }
      var p = payload || {};
      return b.createListing(p.service, p.data)
        .then(function (result) {
          return Result.ok({
            id: result && result.id,
            snapshot: result,
            kind: 'listing'
          }, 'آگهی ثبت شد');
        })
        .catch(function (err) {
          return Result.fromError(err, Errors.CODES.UNKNOWN, 'ذخیره اطلاعات روی سرور انجام نشد.');
        });
    },
    sendProposal: function (payload) {
      var b = backend();
      if (!b || typeof b.sendRecipient !== 'function') {
        return Promise.resolve(Result.fail(Errors.CODES.SERVER_UNAVAILABLE, Errors.messageFor(Errors.CODES.SERVER_UNAVAILABLE)));
      }
      var p = payload || {};
      return b.sendRecipient(p.requestId, {
        providerId: p.providerId,
        machineId: p.machineId != null ? p.machineId : null,
        listingId: p.listingId || null,
        unitPrice: p.unitPrice,
        priceUnit: p.priceUnit,
        location: p.location
      }).then(function (result) {
        return Result.ok({ snapshot: result }, 'پیشنهاد ارسال شد');
      }).catch(function (err) {
        return Result.fromError(err, Errors.CODES.PROPOSAL_NOT_ALLOWED, 'ارسال درخواست انجام نشد.');
      });
    },

    acceptProposal: function (payload) {
      var b = backend();
      if (!b || typeof b.acceptRecipient !== 'function') {
        return Promise.resolve(Result.fail(Errors.CODES.SERVER_UNAVAILABLE, Errors.messageFor(Errors.CODES.SERVER_UNAVAILABLE)));
      }
      var p = payload || {};
      return b.acceptRecipient(p.id).then(function (result) {
        return Result.ok({ snapshot: result }, 'کار با شما توافق شد');
      }).catch(function (err) {
        return Result.fromError(err, Errors.CODES.PROPOSAL_ALREADY_HANDLED, 'پذیرش درخواست انجام نشد.');
      });
    },

    rejectProposal: function (payload) {
      var b = backend();
      if (!b || typeof b.rejectRecipient !== 'function') {
        return Promise.resolve(Result.fail(Errors.CODES.SERVER_UNAVAILABLE, Errors.messageFor(Errors.CODES.SERVER_UNAVAILABLE)));
      }
      var p = payload || {};
      return b.rejectRecipient(p.id).then(function (result) {
        return Result.ok({ snapshot: result }, 'درخواست رد شد');
      }).catch(function (err) {
        return Result.fromError(err, Errors.CODES.PROPOSAL_ALREADY_HANDLED, 'رد درخواست انجام نشد.');
      });
    },

    cancelProposal: function (payload) {
      var b = backend();
      if (!b || typeof b.cancelRecipient !== 'function') {
        return Promise.resolve(Result.fail(Errors.CODES.SERVER_UNAVAILABLE, Errors.messageFor(Errors.CODES.SERVER_UNAVAILABLE)));
      }
      var p = payload || {};
      return b.cancelRecipient(p.id).then(function (result) {
        return Result.ok({ snapshot: result }, 'ارسال لغو شد');
      }).catch(function (err) {
        return Result.fromError(err, Errors.CODES.PROPOSAL_ALREADY_HANDLED, 'لغو ارسال انجام نشد.');
      });
    },
    cancelDeal: function (payload) {
      var b = backend();
      if (!b || typeof b.cancelDeal !== 'function') {
        return Promise.resolve(Result.fail(Errors.CODES.SERVER_UNAVAILABLE, Errors.messageFor(Errors.CODES.SERVER_UNAVAILABLE)));
      }
      var p = payload || {};
      return b.cancelDeal(p.id).then(function (result) {
        return Result.ok({ snapshot: result }, 'کار لغو شد');
      }).catch(function (err) {
        return Result.fromError(err, Errors.CODES.DEAL_INVALID_STATE, 'لغو کار انجام نشد.');
      });
    },

    completeDeal: function (payload) {
      var b = backend();
      if (!b || typeof b.completeDeal !== 'function') {
        return Promise.resolve(Result.fail(Errors.CODES.SERVER_UNAVAILABLE, Errors.messageFor(Errors.CODES.SERVER_UNAVAILABLE)));
      }
      var p = payload || {};
      return b.completeDeal(p.id).then(function (result) {
        return Result.ok({ snapshot: result }, 'اتمام کار ثبت شد');
      }).catch(function (err) {
        return Result.fromError(err, Errors.CODES.DEAL_INVALID_STATE, 'ثبت اتمام کار انجام نشد.');
      });
    },
    payDeal: function (payload) {
      var b = backend();
      var p = payload || {};
      var method = p.method || 'generic';
      // Online gateway not wired yet — same product behavior as before.
      if (method === 'online') {
        return Promise.resolve(Result.fail(
          Errors.CODES.NOT_IMPLEMENTED,
          'پرداخت آنلاین به‌زودی متصل می‌شود.'
        ));
      }
      if (!b || typeof b.payDeal !== 'function') {
        return Promise.resolve(Result.fail(Errors.CODES.SERVER_UNAVAILABLE, Errors.messageFor(Errors.CODES.SERVER_UNAVAILABLE)));
      }
      return b.payDeal(p.id).then(function (result) {
        var msg = method === 'cash' ? 'پرداخت نقدی ثبت شد' : 'پرداخت ثبت شد';
        return Result.ok({ snapshot: result }, msg);
      }).catch(function (err) {
        return Result.fromError(err, Errors.CODES.PAYMENT_FAILED, 'ثبت پرداخت انجام نشد.');
      });
    },

    createReview: function (payload) {
      var b = backend();
      if (!b || typeof b.createReview !== 'function') {
        return Promise.resolve(Result.fail(Errors.CODES.SERVER_UNAVAILABLE, Errors.messageFor(Errors.CODES.SERVER_UNAVAILABLE)));
      }
      var p = payload || {};
      return b.createReview({
        dealId: p.dealId,
        ratings: p.ratings || {},
        note: p.note || ''
      }).then(function (result) {
        return Result.ok({ snapshot: result }, 'گزارش شما ثبت شد');
      }).catch(function (err) {
        return Result.fromError(err, Errors.CODES.UNKNOWN, 'ثبت گزارش انجام نشد.');
      });
    },

    reportProblem: function (payload) {
      var b = backend();
      if (!b || typeof b.reportProblem !== 'function') {
        return Promise.resolve(Result.fail(
          Errors.CODES.SERVER_UNAVAILABLE,
          Errors.messageFor(Errors.CODES.SERVER_UNAVAILABLE)
        ));
      }
      var p = payload || {};
      return b.reportProblem({
        dealId: p.dealId,
        reason: p.reason || '',
        note: p.note || ''
      }).then(function (result) {
        return Result.ok({ snapshot: result }, 'گزارش مشکل ثبت شد');
      }).catch(function (err) {
        return Result.fromError(err, Errors.CODES.UNKNOWN, 'ثبت گزارش مشکل انجام نشد.');
      });
    },

    markNotificationsRead: function (payload) {
      var b = backend();
      if (!b || typeof b.markNotificationsRead !== 'function') {
        return Promise.resolve(Result.fail(Errors.CODES.SERVER_UNAVAILABLE, Errors.messageFor(Errors.CODES.SERVER_UNAVAILABLE)));
      }
      var ids = (payload && payload.ids) || [];
      return b.markNotificationsRead(ids).then(function (result) {
        return Result.ok({ snapshot: result, ids: ids });
      }).catch(function (err) {
        return Result.fromError(err, Errors.CODES.UNKNOWN, 'خواندن اعلان انجام نشد.');
      });
    },

    updateDealLocation: function (payload) {
      var b = backend();
      if (!b || typeof b.updateDealLocation !== 'function') {
        return Promise.resolve(Result.fail(Errors.CODES.SERVER_UNAVAILABLE, Errors.messageFor(Errors.CODES.SERVER_UNAVAILABLE)));
      }
      var p = payload || {};
      return b.updateDealLocation(p.dealId, {
        lat: p.lat, lng: p.lng, accuracy: p.accuracy
      }).then(function (result) {
        return Result.ok({ snapshot: result });
      }).catch(function (err) {
        return Result.fromError(err, Errors.CODES.UNKNOWN, 'ارسال موقعیت انجام نشد.');
      });
    },

    getDealLocation: function (payload) {
      var b = backend();
      if (!b || typeof b.getDealLocation !== 'function') {
        return Promise.resolve(Result.fail(Errors.CODES.SERVER_UNAVAILABLE, Errors.messageFor(Errors.CODES.SERVER_UNAVAILABLE)));
      }
      var p = payload || {};
      return b.getDealLocation(p.dealId).then(function (loc) {
        return Result.ok({ location: loc });
      }).catch(function (err) {
        return Result.fromError(err, Errors.CODES.UNKNOWN, 'دریافت موقعیت انجام نشد.');
      });
    },

    getProviders: function (payload) {
      var b = backend();
      if (!b || typeof b.getProviders !== 'function') {
        return Promise.resolve(Result.fail(Errors.CODES.SERVER_UNAVAILABLE, Errors.messageFor(Errors.CODES.SERVER_UNAVAILABLE)));
      }
      var p = payload || {};
      return b.getProviders(p.requestId).then(function (result) {
        var providers = (result && Array.isArray(result.providers)) ? result.providers : [];
        return Result.ok({ providers: providers, snapshot: result });
      }).catch(function (err) {
        return Result.fromError(err, Errors.CODES.UNKNOWN, 'دریافت پیشنهادهای قابل ارسال انجام نشد.');
      });
    },
  };

  global.KeloApiAdapter = ApiAdapter;
})(typeof window !== 'undefined' ? window : globalThis);
