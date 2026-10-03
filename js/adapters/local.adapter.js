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
    createRequest: function (payload) {
      var bridgeErr = requireDataAccess();
      if (bridgeErr) return Promise.resolve(bridgeErr);
      var db = dataAccess.getDB();
      var p = payload || {};
      var request = {
        id: 'r' + Date.now() + Math.random().toString(36).slice(2, 6),
        userId: p.userId,
        requesterName: p.requesterName || '',
        requestKind: p.requestKind === 'provide' ? 'provide' : 'need',
        service: p.service,
        data: p.data || {},
        status: 'pending',
        created: new Date().toISOString()
      };
      db.requests = db.requests || [];
      db.requests.push(request);
      if (typeof dataAccess.saveDB === 'function') dataAccess.saveDB();
      return Promise.resolve(Result.ok({ id: request.id, request: request, kind: 'request' }, 'درخواست ثبت شد'));
    },

    updateRequest: function (payload) {
      var bridgeErr = requireDataAccess();
      if (bridgeErr) return Promise.resolve(bridgeErr);
      var db = dataAccess.getDB();
      var p = payload || {};
      var request = (db.requests || []).find(function (r) {
        return String(r.id) === String(p.id) && String(r.userId) === String(p.userId);
      });
      if (!request) {
        return Promise.resolve(Result.fail(Errors.CODES.REQUEST_NOT_FOUND, Errors.messageFor(Errors.CODES.REQUEST_NOT_FOUND)));
      }
      var locked = ['accepted', 'agreed', 'in_progress', 'completed', 'cancelled', 'expired'];
      if (locked.indexOf(request.status) >= 0) {
        return Promise.resolve(Result.fail(Errors.CODES.REQUEST_INVALID_STATE, 'این درخواست دیگر قابل ویرایش نیست'));
      }
      request.service = p.service !== undefined ? p.service : request.service;
      request.data = p.data !== undefined ? p.data : request.data;
      if (p.requesterName) request.requesterName = p.requesterName;
      request.updated = new Date().toISOString();
      // بعد از ویرایش پیشنهادهای قبلی پاک شوند
      db.requestRecipients = (db.requestRecipients || []).filter(function (x) {
        return String(x.requestId) !== String(request.id);
      });
      if (typeof dataAccess.saveDB === 'function') dataAccess.saveDB();
      return Promise.resolve(Result.ok({ id: request.id, request: request, kind: 'request' }, 'درخواست به‌روزرسانی شد'));
    },

    deleteRequest: function (payload) {
      var bridgeErr = requireDataAccess();
      if (bridgeErr) return Promise.resolve(bridgeErr);
      var db = dataAccess.getDB();
      var p = payload || {};
      var request = (db.requests || []).find(function (r) {
        return String(r.id) === String(p.id) && String(r.userId) === String(p.userId);
      });
      if (!request) {
        return Promise.resolve(Result.fail(Errors.CODES.REQUEST_NOT_FOUND, Errors.messageFor(Errors.CODES.REQUEST_NOT_FOUND)));
      }
      var locked = ['accepted', 'agreed', 'in_progress', 'completed'];
      if (locked.indexOf(request.status) >= 0) {
        return Promise.resolve(Result.fail(Errors.CODES.REQUEST_INVALID_STATE, 'درخواست توافق‌شده قابل حذف نیست'));
      }
      request.status = 'cancelled';
      (db.requestRecipients || []).forEach(function (x) {
        if (String(x.requestId) === String(p.id) && (x.status === 'pending' || x.status === 'accepted')) {
          x.status = 'closed';
          x.closedAt = new Date().toISOString();
        }
      });
      if (typeof dataAccess.saveDB === 'function') dataAccess.saveDB();
      return Promise.resolve(Result.ok({ id: request.id, request: request }, 'درخواست حذف شد'));
    },

    getRequest: function (payload) {
      var bridgeErr = requireDataAccess();
      if (bridgeErr) return Promise.resolve(bridgeErr);
      var db = dataAccess.getDB();
      var p = payload || {};
      var request = (db.requests || []).find(function (r) {
        if (String(r.id) !== String(p.id)) return false;
        if (p.userId != null && String(r.userId) !== String(p.userId)) return false;
        return true;
      });
      if (!request) {
        return Promise.resolve(Result.fail(Errors.CODES.REQUEST_NOT_FOUND, Errors.messageFor(Errors.CODES.REQUEST_NOT_FOUND)));
      }
      return Promise.resolve(Result.ok({ request: request }));
    },

    createListing: function (payload) {
      var bridgeErr = requireDataAccess();
      if (bridgeErr) return Promise.resolve(bridgeErr);
      var db = dataAccess.getDB();
      var p = payload || {};
      var listing = {
        id: 'l' + Date.now() + Math.random().toString(36).slice(2, 6),
        userId: p.userId,
        providerName: p.providerName || '',
        service: p.service,
        data: p.data || {},
        status: 'active',
        created: new Date().toISOString()
      };
      db.listings = db.listings || [];
      db.listings.push(listing);
      if (typeof dataAccess.saveDB === 'function') dataAccess.saveDB();
      return Promise.resolve(Result.ok({ id: listing.id, listing: listing, kind: 'listing' }, 'آگهی ثبت شد'));
    },
    getMarketplaceSnapshot: function () {
      var bridgeErr = requireDataAccess();
      if (bridgeErr) return Promise.resolve(bridgeErr);
      var db = dataAccess.getDB();
      return Promise.resolve(Result.ok({
        requests: db.requests || [],
        listings: db.listings || [],
        machines: db.machines || [],
        users: db.users || [],
        bookings: db.bookings || [],
        requestRecipients: db.requestRecipients || [],
        deals: db.deals || [],
        reviews: db.reviews || []
      }));
    },

    /**
     * Persistence-only: apply a Domain planSend result.
     */
    applySendPlan: function (payload) {
      var bridgeErr = requireDataAccess();
      if (bridgeErr) return Promise.resolve(bridgeErr);
      var db = dataAccess.getDB();
      var plan = (payload && payload.plan) || payload;
      if (!plan || !plan.ok || !plan.recipient) {
        return Promise.resolve(Result.fail(Errors.CODES.VALIDATION, (plan && plan.message) || 'plan نامعتبر است'));
      }
      db.requestRecipients = db.requestRecipients || [];
      var rec = plan.recipient;
      var existing = db.requestRecipients.find(function (x) {
        return String(x.requestId) === String(rec.requestId)
          && String(x.proposerId || '') === String(rec.proposerId || '')
          && String(x.recipientId || x.providerId || '') === String(rec.recipientId || rec.providerId || '')
          && ['closed', 'rejected', 'cancelled'].indexOf(x.status) >= 0;
      });
      if (existing) {
        existing.status = 'pending';
        existing.closedAt = null;
        existing.respondedAt = null;
        existing.unitPrice = rec.unitPrice;
        existing.priceUnit = rec.priceUnit;
        existing.total = rec.total;
        existing.machineId = rec.machineId;
        existing.listingId = rec.listingId;
        existing.location = rec.location;
        rec = existing;
      } else {
        db.requestRecipients.push(rec);
      }
      var eff = (db.requests || []).find(function (r) { return String(r.id) === String(plan.effectiveRequestId); });
      if (eff && eff.status !== 'completed') eff.status = 'pending';
      var anchor = (db.requests || []).find(function (r) { return String(r.id) === String(plan.requestId); });
      if (anchor && String(anchor.id) !== String(plan.effectiveRequestId) && anchor.status !== 'completed') {
        anchor.status = 'pending';
      }
      if (typeof dataAccess.saveDB === 'function') dataAccess.saveDB();
      return Promise.resolve(Result.ok({
        recipient: plan.recipient,
        request: anchor || null
      }, plan.successMessage || 'پیشنهاد ارسال شد'));
    },

    /** Compatibility: expects payload.plan from service orchestration */
    sendProposal: function (payload) {
      var bridgeErr = requireDataAccess();
      if (bridgeErr) return Promise.resolve(bridgeErr);
      if (payload && payload.plan) return this.applySendPlan(payload);
      return Promise.resolve(Result.fail(Errors.CODES.VALIDATION, 'ارسال باید از Service با plan انجام شود'));
    },

    /**
     * Persistence-only: apply a Domain planAccept result.
     */
    applyAcceptPlan: function (payload) {
      var bridgeErr = requireDataAccess();
      if (bridgeErr) return Promise.resolve(bridgeErr);
      var db = dataAccess.getDB();
      var plan = (payload && payload.plan) || payload;
      var recipientId = payload && payload.recipientId;
      if (!plan || !plan.ok) {
        if (plan && plan.closeRecipient && recipientId) {
          var recClose = (db.requestRecipients || []).find(function (x) { return String(x.id) === String(recipientId); });
          if (recClose) {
            recClose.status = 'closed';
            if (typeof dataAccess.saveDB === 'function') dataAccess.saveDB();
          }
        }
        return Promise.resolve(Result.fail(
          (plan && plan.code) || Errors.CODES.PROPOSAL_ALREADY_HANDLED,
          (plan && plan.message) || 'پذیرش مجاز نیست'
        ));
      }
      var recipient = (db.requestRecipients || []).find(function (x) {
        return String(x.id) === String(plan.recipientId || recipientId);
      });
      if (!recipient) {
        return Promise.resolve(Result.fail(Errors.CODES.PROPOSAL_NOT_FOUND, 'پیشنهاد پیدا نشد'));
      }
      var request = (db.requests || []).find(function (r) {
        return String(r.id) === String(plan.requestId);
      });
      db.bookings = db.bookings || [];
      db.bookings.push(plan.booking);
      recipient.status = 'accepted';
      recipient.respondedAt = new Date().toISOString();
      (db.requestRecipients || []).forEach(function (x) {
        if (String(x.requestId) === String(plan.requestId) && String(x.id) !== String(recipient.id) && x.status === 'pending') {
          x.status = 'closed';
          x.closedAt = new Date().toISOString();
        }
      });
      if (request) request.status = 'accepted';
      db.deals = db.deals || [];
      var cancelledDeal = db.deals.find(function (d) {
        return String(d.requestId) === String(plan.requestId) && d.status === 'cancelled';
      });
      if (cancelledDeal && plan.deal) {
        Object.keys(plan.deal).forEach(function (k) {
          if (k === 'id') return;
          cancelledDeal[k] = plan.deal[k];
        });
        cancelledDeal.status = 'agreed';
        cancelledDeal.cancelledAt = null;
        cancelledDeal.paymentStatus = plan.deal.paymentStatus || 'pending';
        plan.deal = cancelledDeal;
      } else {
        db.deals.push(plan.deal);
      }
      if (typeof dataAccess.saveDB === 'function') dataAccess.saveDB();
      return Promise.resolve(Result.ok({
        deal: plan.deal,
        booking: plan.booking,
        recipient: recipient
      }, plan.successMessage || 'کار با شما توافق شد'));
    },

    acceptProposal: function (payload) {
      var bridgeErr = requireDataAccess();
      if (bridgeErr) return Promise.resolve(bridgeErr);
      return this.applyAcceptPlan(payload);
    },

    rejectProposal: function (payload) {
      var bridgeErr = requireDataAccess();
      if (bridgeErr) return Promise.resolve(bridgeErr);
      var db = dataAccess.getDB();
      var p = payload || {};
      var D = (global.KeloDomain && global.KeloDomain.proposal) || {};
      var rec = (db.requestRecipients || []).find(function (x) { return String(x.id) === String(p.id); });
      var gate = D.canReject ? D.canReject(rec, p.userId) : { ok: !!rec && rec.status === 'pending' };
      if (!gate.ok) {
        return Promise.resolve(Result.fail(Errors.CODES.PROPOSAL_ALREADY_HANDLED, gate.reason || 'این پیشنهاد دیگر قابل رد نیست'));
      }
      rec.status = 'rejected';
      rec.respondedAt = new Date().toISOString();
      if (typeof dataAccess.saveDB === 'function') dataAccess.saveDB();
      return Promise.resolve(Result.ok({ recipient: rec }, 'درخواست رد شد'));
    },

    cancelProposal: function (payload) {
      var bridgeErr = requireDataAccess();
      if (bridgeErr) return Promise.resolve(bridgeErr);
      var db = dataAccess.getDB();
      var p = payload || {};
      var D = (global.KeloDomain && global.KeloDomain.proposal) || {};
      var rec = (db.requestRecipients || []).find(function (x) { return String(x.id) === String(p.id); });
      var gate = D.canCancel ? D.canCancel(rec, p.userId) : { ok: !!rec && rec.status === 'pending' };
      if (!gate.ok) {
        return Promise.resolve(Result.fail(Errors.CODES.PROPOSAL_ALREADY_HANDLED, gate.reason || 'این پیشنهاد قابل لغو نیست'));
      }
      rec.status = 'closed';
      rec.closedAt = new Date().toISOString();
      rec.respondedAt = new Date().toISOString();
      if (typeof dataAccess.saveDB === 'function') dataAccess.saveDB();
      return Promise.resolve(Result.ok({ recipient: rec }, 'ارسال لغو شد'));
    },

    cancelDeal: function (payload) {
      var bridgeErr = requireDataAccess();
      if (bridgeErr) return Promise.resolve(bridgeErr);
      var db = dataAccess.getDB();
      var p = payload || {};
      var userId = String(p.userId || '');
      var deal = (db.deals || []).find(function (x) {
        return String(x.id) === String(p.id) &&
          (String(x.userId) === userId || String(x.providerId) === userId) &&
          x.status !== 'completed' && x.status !== 'cancelled' &&
          x.paymentStatus !== 'paid';
      });
      if (!deal) {
        return Promise.resolve(Result.fail(Errors.CODES.DEAL_NOT_FOUND, 'معامله برای لغو پیدا نشد یا قابل لغو نیست.'));
      }
      deal.status = 'cancelled';
      deal.cancelledAt = new Date().toISOString();
      var booking = (db.bookings || []).find(function (b) { return String(b.id) === String(deal.bookingId); });
      if (booking) booking.status = 'cancelled';
      (db.requestRecipients || []).forEach(function (x) {
        if (String(x.requestId) !== String(deal.requestId)) return;
        if (x.status === 'accepted') {
          x.status = 'closed';
          x.closedAt = new Date().toISOString();
        } else if (x.status === 'closed' && !x.respondedAt) {
          x.status = 'pending';
          x.closedAt = null;
        }
      });
      if (typeof dataAccess.saveDB === 'function') dataAccess.saveDB();
      return Promise.resolve(Result.ok({ deal: deal }, 'کار لغو شد'));
    },

    completeDeal: function (payload) {
      var bridgeErr = requireDataAccess();
      if (bridgeErr) return Promise.resolve(bridgeErr);
      var db = dataAccess.getDB();
      var p = payload || {};
      var userId = String(p.userId || '');
      var deal = (db.deals || []).find(function (x) {
        return String(x.id) === String(p.id) &&
          String(x.providerId) === userId &&
          x.status !== 'completed' && x.status !== 'cancelled';
      });
      if (!deal) {
        return Promise.resolve(Result.fail(Errors.CODES.DEAL_NOT_FOUND, 'معامله برای اتمام پیدا نشد یا مجاز نیستید.'));
      }
      deal.status = 'completed';
      deal.completedAt = new Date().toISOString();
      var req = (db.requests || []).find(function (r) { return String(r.id) === String(deal.requestId); });
      if (req) req.status = 'completed';
      var booking = (db.bookings || []).find(function (b) { return String(b.id) === String(deal.bookingId); });
      if (booking) booking.status = 'completed';
      var rec = (db.requestRecipients || []).find(function (x) {
        return String(x.requestId) === String(deal.requestId) && x.status === 'accepted';
      });
      if (rec) rec.status = 'completed';
      if (typeof dataAccess.saveDB === 'function') dataAccess.saveDB();
      return Promise.resolve(Result.ok({ deal: deal }, 'اتمام کار ثبت شد'));
    },
    /**
     * @param {{ id: string, userId: string, method?: 'cash'|'online'|'generic' }} payload
     */
    payDeal: function (payload) {
      var bridgeErr = requireDataAccess();
      if (bridgeErr) return Promise.resolve(bridgeErr);
      var db = dataAccess.getDB();
      var p = payload || {};
      var userId = String(p.userId || '');
      var method = p.method || 'generic';
      var deal = (db.deals || []).find(function (x) {
        return String(x.id) === String(p.id) && String(x.userId) === userId;
      });
      if (!deal) {
        return Promise.resolve(Result.fail(Errors.CODES.DEAL_NOT_FOUND, 'معامله برای پرداخت پیدا نشد.'));
      }
      if (deal.status === 'cancelled') {
        return Promise.resolve(Result.fail(Errors.CODES.DEAL_INVALID_STATE, 'این معامله لغو شده است.'));
      }
      if (deal.paymentStatus === 'paid') {
        return Promise.resolve(Result.ok({ deal: deal, alreadyPaid: true }, 'این توافق قبلاً پرداخت شده است'));
      }
      deal.paymentStatus = 'paid';
      if (method === 'cash') deal.paymentMethod = 'cash';
      else if (method === 'online') deal.paymentMethod = 'online';
      if (deal.status === 'agreed') deal.status = 'paid';
      var amount = Number(deal.total) || 0;
      db.payments = db.payments || [];
      db.payments.push({
        id: 'p' + Date.now(),
        dealId: deal.id,
        userId: userId,
        amount: amount,
        method: method,
        status: 'paid',
        createdAt: new Date().toISOString()
      });
      if (typeof dataAccess.saveDB === 'function') dataAccess.saveDB();
      var msg = method === 'cash' ? 'پرداخت نقدی ثبت شد' : 'پرداخت ثبت شد';
      return Promise.resolve(Result.ok({ deal: deal }, msg));
    },

    createReview: function (payload) {
      var bridgeErr = requireDataAccess();
      if (bridgeErr) return Promise.resolve(bridgeErr);
      var db = dataAccess.getDB();
      var p = payload || {};
      var userId = String(p.userId || '');
      var deal = (db.deals || []).find(function (x) { return String(x.id) === String(p.dealId); });
      if (!deal) {
        return Promise.resolve(Result.fail(Errors.CODES.DEAL_NOT_FOUND, 'توافق پیدا نشد'));
      }
      var isFarmer = String(deal.userId) === userId;
      var isProvider = String(deal.providerId) === userId;
      if (!isFarmer && !isProvider) {
        return Promise.resolve(Result.fail(Errors.CODES.FORBIDDEN, 'فقط طرفین توافق می‌توانند گزارش ثبت کنند'));
      }
      if (deal.status !== 'completed') {
        return Promise.resolve(Result.fail(Errors.CODES.DEAL_INVALID_STATE, 'فقط پس از تکمیل کار می‌توانید نظر ثبت کنید'));
      }
      db.reviews = db.reviews || [];
      var already = db.reviews.some(function (r) {
        return String(r.dealId) === String(p.dealId) && String(r.userId) === userId;
      });
      if (already) {
        return Promise.resolve(Result.fail(Errors.CODES.CONFLICT, 'قبلاً برای این توافق گزارش ثبت کرده‌اید'));
      }
      var targetId = isFarmer ? deal.providerId : deal.userId;
      var review = {
        id: 'rv' + Date.now(),
        dealId: p.dealId,
        userId: userId,
        targetId: targetId,
        ratings: p.ratings || {},
        note: p.note || '',
        createdAt: new Date().toISOString()
      };
      db.reviews.push(review);
      if (typeof dataAccess.saveDB === 'function') dataAccess.saveDB();
      try { localStorage.setItem('kelo_reviews', JSON.stringify(db.reviews)); } catch (e) {}
      return Promise.resolve(Result.ok({ review: review }, 'گزارش شما ثبت شد'));
    },

    reportProblem: function (payload) {
      var bridgeErr = requireDataAccess();
      if (bridgeErr) return Promise.resolve(bridgeErr);
      var db = dataAccess.getDB();
      var p = payload || {};
      var userId = String(p.userId || '');
      var deal = (db.deals || []).find(function (x) { return String(x.id) === String(p.dealId); });
      if (!deal) {
        return Promise.resolve(Result.fail(Errors.CODES.DEAL_NOT_FOUND, 'توافق پیدا نشد'));
      }
      db.dealProblems = db.dealProblems || [];
      var item = {
        id: 'dp' + Date.now(),
        dealId: p.dealId,
        userId: userId,
        role: String(deal.userId) === userId ? 'farmer' : 'provider',
        reason: p.reason || '',
        note: p.note || '',
        createdAt: new Date().toISOString()
      };
      db.dealProblems.push(item);
      if (typeof dataAccess.saveDB === 'function') dataAccess.saveDB();
      return Promise.resolve(Result.ok({ problem: item }, 'گزارش مشکل ثبت شد'));
    },

    getProviders: function (payload) {
      var bridgeErr = requireDataAccess();
      if (bridgeErr) return Promise.resolve(bridgeErr);
      var db = dataAccess.getDB();
      var h = (dataAccess.helpers) || {};
      var p = payload || {};
      var req = (db.requests || []).find(function (r) { return String(r.id) === String(p.requestId); });
      if (!req) {
        return Promise.resolve(Result.fail(Errors.CODES.REQUEST_NOT_FOUND, 'درخواست پیدا نشد'));
      }
      var E = (global.KeloDomain && global.KeloDomain.eligibility) || {};
      var candidates = [];
      if (E.getEligibleProviders) {
        candidates = E.getEligibleProviders({
          request: req,
          listings: db.listings || [],
          machines: db.machines || [],
          users: db.users || [],
          bookings: db.bookings || [],
          parseDate: h.parseStoredDate || (global.KeloDomain && global.KeloDomain.pricing && global.KeloDomain.pricing.parseIsoishDate),
          geo: {
            nearestCityFromCoords: h.nearestCityFromCoords || null,
            provinceFromCity: h.provinceFromCity || null,
            formatActivityArea: h.formatActivityArea || null
          }
        }) || [];
      } else if (typeof h.getEligibleProvidersForRequest === 'function') {
        candidates = h.getEligibleProvidersForRequest(req) || [];
      }
      return Promise.resolve(Result.ok({ providers: candidates, request: req }));
    },
  };

  global.KeloLocalAdapter = LocalAdapter;
})(typeof window !== 'undefined' ? window : globalThis);
