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


  function averageFromRatingsObj(ratings) {
    if (!ratings || typeof ratings !== 'object') return null;
    var vals = Object.keys(ratings).map(function (k) { return Number(ratings[k]); }).filter(function (n) { return n > 0; });
    if (!vals.length) return null;
    var sum = vals.reduce(function (a, b) { return a + b; }, 0);
    return Math.round((sum / vals.length) * 10) / 10;
  }

  function buildTargetRatingMap(db) {
    var map = {};
    (db.reviews || []).forEach(function (rev) {
      var tid = String(rev.targetId || rev.target_id || rev.revieweeId || rev.reviewee_id || '');
      if (!tid) return;
      var avg = averageFromRatingsObj(rev.ratings);
      if (avg == null && rev.rating != null) avg = Number(rev.rating);
      if (avg == null || !(avg > 0)) return;
      if (!map[tid]) map[tid] = { sum: 0, count: 0 };
      map[tid].sum += avg;
      map[tid].count += 1;
    });
    var out = {};
    Object.keys(map).forEach(function (k) {
      out[k] = {
        rating: Math.round((map[k].sum / map[k].count) * 10) / 10,
        reviewCount: map[k].count
      };
    });
    return out;
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
     * Merge authenticated user into local users store (via dataAccess, not Query).
     */
    upsertUserMirror: function (payload) {
      var bridgeErr = requireDataAccess();
      if (bridgeErr) return Promise.resolve(bridgeErr);
      var user = (payload && payload.user) ? payload.user : payload;
      if (!user || !user.id) {
        return Promise.resolve(Result.fail(Errors.CODES.VALIDATION, 'کاربر نامعتبر است.'));
      }
      var db = dataAccess.getDB();
      db.users = db.users || [];
      var local = db.users.find(function (u) { return String(u.id) === String(user.id); });
      if (!local) {
        local = { id: user.id };
        db.users.push(local);
      }
      Object.keys(user).forEach(function (k) {
        local[k] = user[k];
      });
      if (!Array.isArray(local.systemRoles)) local.systemRoles = [];
      if (!local.profile) local.profile = {};
      if (typeof dataAccess.saveDB === 'function') dataAccess.saveDB();
      return Promise.resolve(Result.ok({ user: local }));
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
    /** Persist only — unpaid + field validation belong in RequestService / Domain */
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

    getDeal: function (payload) {
      var bridgeErr = requireDataAccess();
      if (bridgeErr) return Promise.resolve(bridgeErr);
      var db = dataAccess.getDB();
      var deal = (db.deals || []).find(function (d) {
        return String(d.id) === String(payload && payload.id);
      });
      if (!deal) return Promise.resolve(Result.fail(Errors.CODES.DEAL_NOT_FOUND, 'معامله پیدا نشد'));
      return Promise.resolve(Result.ok({ deal: deal }));
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

    /** Persistence-only reject (Domain gate in ProposalService). */
    rejectProposal: function (payload) {
      var bridgeErr = requireDataAccess();
      if (bridgeErr) return Promise.resolve(bridgeErr);
      var db = dataAccess.getDB();
      var p = payload || {};
      var rec = (db.requestRecipients || []).find(function (x) { return String(x.id) === String(p.id); });
      if (!rec) {
        return Promise.resolve(Result.fail(Errors.CODES.PROPOSAL_NOT_FOUND, 'پیشنهاد پیدا نشد'));
      }
      rec.status = 'rejected';
      rec.respondedAt = new Date().toISOString();
      if (typeof dataAccess.saveDB === 'function') dataAccess.saveDB();
      return Promise.resolve(Result.ok({ recipient: rec }, 'درخواست رد شد'));
    },

    /** Persistence-only cancel (Domain gate in ProposalService). */
    cancelProposal: function (payload) {
      var bridgeErr = requireDataAccess();
      if (bridgeErr) return Promise.resolve(bridgeErr);
      var db = dataAccess.getDB();
      var p = payload || {};
      var rec = (db.requestRecipients || []).find(function (x) { return String(x.id) === String(p.id); });
      if (!rec) {
        return Promise.resolve(Result.fail(Errors.CODES.PROPOSAL_NOT_FOUND, 'پیشنهاد پیدا نشد'));
      }
      rec.status = 'closed';
      rec.closedAt = new Date().toISOString();
      rec.respondedAt = new Date().toISOString();
      if (typeof dataAccess.saveDB === 'function') dataAccess.saveDB();
      return Promise.resolve(Result.ok({ recipient: rec }, 'ارسال لغو شد'));
    },

    /** Persist cancel — Domain rules enforced in DealService */
    cancelDeal: function (payload) {
      var bridgeErr = requireDataAccess();
      if (bridgeErr) return Promise.resolve(bridgeErr);
      var db = dataAccess.getDB();
      var p = payload || {};
      var deal = (db.deals || []).find(function (d) { return String(d.id) === String(p.id); });
      if (!deal) {
        return Promise.resolve(Result.fail(Errors.CODES.DEAL_NOT_FOUND, 'معامله برای لغو پیدا نشد یا قابل لغو نیست.'));
      }
      deal.status = 'cancelled';
      deal.cancelledAt = new Date().toISOString();
      var req = (db.requests || []).find(function (r) { return String(r.id) === String(deal.requestId); });
      if (req) req.status = 'pending';
      (db.requestRecipients || []).forEach(function (x) {
        if (String(x.requestId) === String(deal.requestId) && x.status === 'accepted') {
          x.status = 'closed';
          x.closedAt = new Date().toISOString();
        }
      });
      if (typeof dataAccess.saveDB === 'function') dataAccess.saveDB();
      return Promise.resolve(Result.ok({ deal: deal }, 'معامله لغو شد'));
    },

    /** Persist complete — Domain rules enforced in DealService */
    completeDeal: function (payload) {
      var bridgeErr = requireDataAccess();
      if (bridgeErr) return Promise.resolve(bridgeErr);
      var db = dataAccess.getDB();
      var p = payload || {};
      var deal = (db.deals || []).find(function (x) { return String(x.id) === String(p.id); });
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
    /** Persist payment — Domain rules enforced in PaymentService */
    payDeal: function (payload) {
      var bridgeErr = requireDataAccess();
      if (bridgeErr) return Promise.resolve(bridgeErr);
      var db = dataAccess.getDB();
      var p = payload || {};
      var deal = (db.deals || []).find(function (d) { return String(d.id) === String(p.id); });
      if (!deal) {
        return Promise.resolve(Result.fail(Errors.CODES.DEAL_NOT_FOUND, 'معامله برای پرداخت پیدا نشد.'));
      }
      if (deal.paymentStatus === 'paid') {
        return Promise.resolve(Result.ok({ deal: deal }, 'قبلاً پرداخت شده است'));
      }
      deal.paymentStatus = 'paid';
      deal.paidAt = new Date().toISOString();
      db.payments = db.payments || [];
      db.payments.push({
        id: 'pay' + Date.now(),
        dealId: deal.id,
        amount: deal.total || 0,
        userId: p.userId,
        createdAt: deal.paidAt
      });
      if (typeof dataAccess.saveDB === 'function') dataAccess.saveDB();
      return Promise.resolve(Result.ok({ deal: deal }, 'پرداخت ثبت شد'));
    },

    /** Persist review — Domain ownership in DealService */
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
      db.reviews = db.reviews || [];
      var already = db.reviews.some(function (r) {
        return String(r.dealId) === String(p.dealId) && String(r.userId) === userId;
      });
      if (already) {
        return Promise.resolve(Result.fail(Errors.CODES.CONFLICT, 'قبلاً برای این توافق گزارش ثبت کرده‌اید'));
      }
      var isFarmer = String(deal.userId) === userId;
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

    /** Data-only: request lookup. Eligibility runs in NotificationService. */
    getProviders: function (payload) {
      var bridgeErr = requireDataAccess();
      if (bridgeErr) return Promise.resolve(bridgeErr);
      var db = dataAccess.getDB();
      var p = payload || {};
      var req = (db.requests || []).find(function (r) { return String(r.id) === String(p.requestId); });
      if (!req) {
        return Promise.resolve(Result.fail(Errors.CODES.REQUEST_NOT_FOUND, 'درخواست پیدا نشد'));
      }
      return Promise.resolve(Result.ok({
        providers: [],
        request: req,
        listings: db.listings || [],
        machines: db.machines || [],
        users: db.users || [],
        bookings: db.bookings || []
      }));
    },

    markNotificationsRead: function (payload) {
      var bridgeErr = requireDataAccess();
      if (bridgeErr) return Promise.resolve(bridgeErr);
      var db = dataAccess.getDB();
      var ids = (payload && payload.ids) || [];
      var idSet = {};
      (ids || []).forEach(function (id) { idSet[String(id)] = true; });
      var now = new Date().toISOString();
      (db.notifications || []).forEach(function (n) {
        if (idSet[String(n.id)]) n.readAt = now;
      });
      if (typeof dataAccess.saveDB === 'function') dataAccess.saveDB();
      return Promise.resolve(Result.ok({ ids: ids }));
    },

    updateDealLocation: function (payload) {
      var bridgeErr = requireDataAccess();
      if (bridgeErr) return Promise.resolve(bridgeErr);
      var db = dataAccess.getDB();
      var p = payload || {};
      db.dealLocations = db.dealLocations || {};
      if (!p.dealId) {
        return Promise.resolve(Result.fail(Errors.CODES.VALIDATION, 'dealId لازم است'));
      }
      db.dealLocations[String(p.dealId)] = {
        lat: p.lat,
        lng: p.lng,
        accuracy: p.accuracy,
        updatedAt: new Date().toISOString(),
        userId: p.userId || null
      };
      if (typeof dataAccess.saveDB === 'function') dataAccess.saveDB();
      return Promise.resolve(Result.ok({ location: db.dealLocations[String(p.dealId)] }));
    },

    getDealLocation: function (payload) {
      var bridgeErr = requireDataAccess();
      if (bridgeErr) return Promise.resolve(bridgeErr);
      var db = dataAccess.getDB();
      var p = payload || {};
      db.dealLocations = db.dealLocations || {};
      var loc = db.dealLocations[String(p.dealId)] || null;
      return Promise.resolve(Result.ok({ location: loc }));
    },



    hasUnpaidCompletedDeal: function (payload) {
      var bridgeErr = requireDataAccess();
      if (bridgeErr) return Promise.resolve(bridgeErr);
      var db = dataAccess.getDB();
      var uid = payload && payload.userId;
      var Domain = (global.KeloDomain && global.KeloDomain.deal) || global.KeloDealDomain;
      var blocked = Domain && Domain.farmerHasUnpaidCompleted
        ? Domain.farmerHasUnpaidCompleted(db.deals || [], uid)
        : false;
      return Promise.resolve(Result.ok({ blocked: !!blocked }));
    },
    getTopProviders: function (payload) {
      var bridgeErr = requireDataAccess();
      if (bridgeErr) return Promise.resolve(bridgeErr);
      var db = dataAccess.getDB();
      var p = payload || {};
      var minReviews = Math.max(1, Number(p.minReviews) || 1);
      var limit = Math.max(1, Number(p.limit) || 12);
      var service = p.service || null;
      var me = p.userId || null;
      var ratingMap = buildTargetRatingMap(db);

      function locStr(v) {
        if (v == null || v === '') return '';
        if (typeof v === 'string') return v;
        if (typeof v === 'object') {
          if (v.label) return String(v.label);
          if (v.city) return String(v.city) + (v.province ? '، ' + v.province : '');
          if (v.name) return String(v.name);
          if (Array.isArray(v)) return v.filter(Boolean).map(locStr).filter(Boolean).join('، ');
        }
        return '';
      }

      var out = [];
      function pushProvider(row) {
        if (!row || !row.providerId) return;
        if (me && String(row.providerId) === String(me)) return;
        if (service && row.service && row.service !== service) return;
        var info = ratingMap[String(row.providerId)]
          || ratingMap[String(row.providerId || '').toLowerCase()]
          || { rating: null, reviewCount: 0 };
        if (!(info.reviewCount >= minReviews)) return;
        // dedupe by provider+service
        var key = String(row.providerId) + ':' + String(row.service || '');
        if (out.some(function (x) { return String(x.providerId) + ':' + String(x.service || '') === key; })) return;
        out.push({
          providerId: row.providerId,
          provider: row.provider || '',
          listingId: row.listingId || null,
          requestId: row.requestId || null,
          service: row.service || '',
          machineType: row.machineType || '',
          unitPrice: Number(row.unitPrice || 0),
          priceUnit: row.priceUnit || '',
          location: locStr(row.location),
          activityArea: row.activityArea || null,
          dateStart: row.dateStart || null,
          dateEnd: row.dateEnd || null,
          requestData: row.requestData || null,
          rating: info.rating,
          reviewCount: info.reviewCount
        });
      }

      // 1) active listings
      (db.listings || []).forEach(function (l) {
        if (!l) return;
        if (l.status && l.status !== 'active') return;
        var pid = l.providerId || l.userId;
        var u = (db.users || []).find(function (x) { return String(x.id) === String(pid); });
        pushProvider({
          providerId: pid,
          provider: l.providerName || l.provider || (u && u.name) || '',
          listingId: l.id,
          service: l.service,
          machineType: (l.data && l.data.machineType) || l.machineType || '',
          unitPrice: Number(l.price || (l.data && l.data.price) || 0),
          priceUnit: l.priceUnit || (l.data && l.data.priceUnit) || '',
          location: l.location || l.locationLabel || (l.data && l.data.location) || ''
        });
      });

      // 2) active provide-requests (same card source as «درخواست‌های من»)
      (db.requests || []).forEach(function (req) {
        if (!req) return;
        var kind = req.requestKind || req.request_kind || '';
        if (kind !== 'provide') return;
        var st = String(req.status || 'pending');
        if (st === 'cancelled' || st === 'completed' || st === 'expired' || st === 'deleted') return;
        var pid = req.userId || req.requesterId || req.requester_id;
        var u = (db.users || []).find(function (x) { return String(x.id) === String(pid); });
        var data = req.data || {};
        pushProvider({
          providerId: pid,
          provider: (u && u.name) || '',
          requestId: req.id,
          service: req.service,
          machineType: data.machineType || '',
          unitPrice: Number(data.price || 0),
          priceUnit: data.priceUnit || '',
          location: data.serviceLocationLabel || data.location || '',
          activityArea: data.activityArea || null,
          dateStart: data.dateStart || req.dateStart || null,
          dateEnd: data.dateEnd || req.dateEnd || null,
          requestData: data
        });
      });

      // 3) providers who completed/accepted deals (still machine-side only)
      (db.deals || []).forEach(function (d) {
        if (!d || d.status === 'cancelled') return;
        var pid = d.providerId;
        if (!pid) return;
        var u = (db.users || []).find(function (x) { return String(x.id) === String(pid); });
        pushProvider({
          providerId: pid,
          provider: (u && u.name) || d.providerName || '',
          requestId: d.requestId || null,
          service: d.service || '',
          machineType: d.providerMachineType || '',
          unitPrice: Number(d.unitPrice || d.total || 0),
          priceUnit: d.priceUnit || '',
          location: d.location || '',
          dateStart: d.dateStart || null,
          dateEnd: d.dateEnd || null
        });
      });

      // NOTE: do NOT add pure review-targets — farmers also get reviews
      out.sort(function (a, b) {
        return (b.rating || 0) - (a.rating || 0) || (b.reviewCount || 0) - (a.reviewCount || 0);
      });
      return Promise.resolve(Result.ok({ providers: out.slice(0, limit), minReviews: minReviews }));
    },

    listLands: function (payload) {
      var bridgeErr = requireDataAccess();
      if (bridgeErr) return Promise.resolve(bridgeErr);
      var db = dataAccess.getDB();
      if (!Array.isArray(db.lands)) db.lands = [];
      var uid = payload && payload.userId;
      var lands = db.lands.filter(function (x) {
        return String(x.userId) === String(uid) && !x.deleted;
      });
      return Promise.resolve(Result.ok({ lands: lands }));
    },
    listFleet: function (payload) {
      var bridgeErr = requireDataAccess();
      if (bridgeErr) return Promise.resolve(bridgeErr);
      var db = dataAccess.getDB();
      if (!Array.isArray(db.fleet)) db.fleet = [];
      var uid = payload && payload.userId;
      var fleet = db.fleet.filter(function (x) {
        return String(x.userId) === String(uid) && !x.deleted;
      });
      return Promise.resolve(Result.ok({ fleet: fleet }));
    },
    createLand: function (payload) {
      var bridgeErr = requireDataAccess();
      if (bridgeErr) return Promise.resolve(bridgeErr);
      var db = dataAccess.getDB();
      if (!Array.isArray(db.lands)) db.lands = [];
      var p = payload || {};
      var uid = p.userId;
      var name = String(p.name || '').trim();
      var nameKey = name.replace(/\s+/g, ' ').toLowerCase();
      var dup = (db.lands || []).some(function (x) {
        return x && !x.deleted && String(x.userId) === String(uid)
          && String(x.name || '').trim().replace(/\s+/g, ' ').toLowerCase() === nameKey
          && (!p.id || String(x.id) !== String(p.id));
      });
      if (dup) {
        return Promise.resolve(Result.fail(
          (Errors.CODES && Errors.CODES.VALIDATION) || 'VALIDATION',
          'زمینی با این نام از قبل دارید. نام دیگری انتخاب کنید.'
        ));
      }
      var land = {
        id: p.id || ('land_' + Date.now().toString(36) + '_' + Math.floor(Math.random() * 1e4)),
        userId: uid,
        name: name || 'مزرعه من',
        area: p.area != null ? Number(p.area) : null,
        location: p.location || null,
        city: p.city || (p.location && p.location.city) || '',
        crop: p.crop || null,
        createdAt: new Date().toISOString()
      };
      db.lands.push(land);
      if (typeof dataAccess.saveDB === 'function') dataAccess.saveDB();
      return Promise.resolve(Result.ok({ land: land }, 'زمین ذخیره شد'));
    },
    updateLand: function (payload) {
      var bridgeErr = requireDataAccess();
      if (bridgeErr) return Promise.resolve(bridgeErr);
      var db = dataAccess.getDB();
      var p = payload || {};
      var row = (db.lands || []).find(function (x) {
        return String(x.id) === String(p.id) && String(x.userId) === String(p.userId) && !x.deleted;
      });
      if (!row) return Promise.resolve(Result.fail(Errors.CODES.NOT_FOUND || Errors.CODES.UNKNOWN, 'زمین پیدا نشد.'));
      var name = String(p.name != null ? p.name : row.name || '').trim();
      var nameKey = name.replace(/\s+/g, ' ').toLowerCase();
      var dup = (db.lands || []).some(function (x) {
        return x && !x.deleted && String(x.userId) === String(p.userId)
          && String(x.id) !== String(p.id)
          && String(x.name || '').trim().replace(/\s+/g, ' ').toLowerCase() === nameKey;
      });
      if (dup) {
        return Promise.resolve(Result.fail(
          (Errors.CODES && Errors.CODES.VALIDATION) || 'VALIDATION',
          'زمینی با این نام از قبل دارید. نام دیگری انتخاب کنید.'
        ));
      }
      if (p.name != null) row.name = name;
      if (p.area != null) row.area = Number(p.area);
      if (p.location) row.location = p.location;
      if (p.city != null) row.city = p.city;
      else if (p.location && p.location.city) row.city = p.location.city;
      if (p.crop != null) row.crop = p.crop;
      row.updatedAt = new Date().toISOString();
      if (typeof dataAccess.saveDB === 'function') dataAccess.saveDB();
      return Promise.resolve(Result.ok({ land: row }, 'زمین به‌روزرسانی شد'));
    },
    deleteLand: function (payload) {
      var bridgeErr = requireDataAccess();
      if (bridgeErr) return Promise.resolve(bridgeErr);
      var db = dataAccess.getDB();
      var row = (db.lands || []).find(function (x) {
        return String(x.id) === String(payload.id) && String(x.userId) === String(payload.userId);
      });
      if (!row) return Promise.resolve(Result.fail(Errors.CODES.NOT_FOUND || Errors.CODES.UNKNOWN, 'زمین پیدا نشد.'));
      row.deleted = true;
      if (typeof dataAccess.saveDB === 'function') dataAccess.saveDB();
      return Promise.resolve(Result.ok({}, 'زمین حذف شد'));
    },
    createMachine: function (payload) {
      var bridgeErr = requireDataAccess();
      if (bridgeErr) return Promise.resolve(bridgeErr);
      var db = dataAccess.getDB();
      if (!Array.isArray(db.fleet)) db.fleet = [];
      var p = payload || {};
      var mtype = String(p.machineType || p.name || '').trim();
      var nameKey = mtype.replace(/\s+/g, ' ').toLowerCase();
      var uid = p.userId;
      var dup = (db.fleet || []).some(function (x) {
        return x && !x.deleted && String(x.userId) === String(uid)
          && String(x.machineType || x.name || '').trim().replace(/\s+/g, ' ').toLowerCase() === nameKey
          && (!p.id || String(x.id) !== String(p.id));
      });
      if (dup) {
        return Promise.resolve(Result.fail(
          (Errors.CODES && Errors.CODES.VALIDATION) || 'VALIDATION',
          'ماشینی با این نام از قبل دارید. نام دیگری انتخاب کنید.'
        ));
      }
      var item = {
        id: p.id || ('fleet_' + Date.now().toString(36) + '_' + Math.floor(Math.random() * 1e4)),
        userId: uid,
        name: mtype || 'ماشین من',
        service: p.service,
        machineType: mtype,
        capacity: p.capacity || '',
        photo: p.photo || null,
        activityArea: p.activityArea || [],
        priceUnit: p.priceUnit || '',
        createdAt: new Date().toISOString()
      };
      db.fleet.push(item);
      if (typeof dataAccess.saveDB === 'function') dataAccess.saveDB();
      return Promise.resolve(Result.ok({ machine: item }, 'ماشین ذخیره شد'));
    },
    updateMachine: function (payload) {
      var bridgeErr = requireDataAccess();
      if (bridgeErr) return Promise.resolve(bridgeErr);
      var db = dataAccess.getDB();
      var p = payload || {};
      var row = (db.fleet || []).find(function (x) {
        return String(x.id) === String(p.id) && String(x.userId) === String(p.userId) && !x.deleted;
      });
      if (!row) return Promise.resolve(Result.fail(Errors.CODES.NOT_FOUND || Errors.CODES.UNKNOWN, 'ماشین پیدا نشد.'));
      var mtype = String(p.machineType != null ? p.machineType : (row.machineType || row.name || '')).trim();
      var nameKey = mtype.replace(/\s+/g, ' ').toLowerCase();
      var dup = (db.fleet || []).some(function (x) {
        return x && !x.deleted && String(x.userId) === String(p.userId)
          && String(x.id) !== String(p.id)
          && String(x.machineType || x.name || '').trim().replace(/\s+/g, ' ').toLowerCase() === nameKey;
      });
      if (dup) {
        return Promise.resolve(Result.fail(
          (Errors.CODES && Errors.CODES.VALIDATION) || 'VALIDATION',
          'ماشینی با این نام از قبل دارید. نام دیگری انتخاب کنید.'
        ));
      }
      if (p.machineType != null || p.name != null) {
        row.machineType = mtype;
        row.name = mtype || row.name;
      }
      if (p.service != null) row.service = p.service;
      if (p.capacity != null) row.capacity = p.capacity;
      if (p.photo !== undefined) row.photo = p.photo;
      row.updatedAt = new Date().toISOString();
      if (typeof dataAccess.saveDB === 'function') dataAccess.saveDB();
      return Promise.resolve(Result.ok({ machine: row }, 'ماشین به‌روزرسانی شد'));
    },

    deleteMachine: function (payload) {
      var bridgeErr = requireDataAccess();
      if (bridgeErr) return Promise.resolve(bridgeErr);
      var db = dataAccess.getDB();
      var row = (db.fleet || []).find(function (x) {
        return String(x.id) === String(payload.id) && String(x.userId) === String(payload.userId);
      });
      if (!row) return Promise.resolve(Result.fail(Errors.CODES.NOT_FOUND || Errors.CODES.UNKNOWN, 'ماشین پیدا نشد.'));
      row.deleted = true;
      if (typeof dataAccess.saveDB === 'function') dataAccess.saveDB();
      return Promise.resolve(Result.ok({}, 'ماشین حذف شد'));
    },
  };

  global.KeloLocalAdapter = LocalAdapter;
})(typeof window !== 'undefined' ? window : globalThis);
