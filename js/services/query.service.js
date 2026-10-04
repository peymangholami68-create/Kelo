/**
 * KELO — Query / Read layer (Phase 19C)
 *
 * UI should read marketplace data through here (or qdb()), not raw global db
 * for business lists. Writes still go through domain services / adapters.
 */
(function (global) {
  'use strict';

  var Result = global.KeloResult;
  var Errors = global.KeloErrors;
  var State = global.KeloState;

  /** @type {null | { getDB: Function }} */
  var dataAccess = null;

  function bindDataAccess(api) {
    dataAccess = api || null;
  }

  function getDB() {
    if (dataAccess && typeof dataAccess.getDB === 'function') {
      return dataAccess.getDB();
    }
    if (global.db) return global.db;
    return null;
  }

  function getAdapter() {
    if (global.KeloService && typeof global.KeloService.adapter === 'function') {
      return global.KeloService.adapter();
    }
    return global.KeloLocalAdapter || null;
  }

  function emptyMirror() {
    return {
      requests: [],
      listings: [],
      machines: [],
      users: [],
      bookings: [],
      requestRecipients: [],
      deals: [],
      reviews: [],
      payments: [],
      notifications: []
    };
  }

  /** Same array refs as live DB when bound — safe for rare local mirror writes. */
  function mirror() {
    var db = getDB();
    if (!db) return emptyMirror();
    return {
      requests: db.requests || [],
      listings: db.listings || [],
      machines: db.machines || [],
      users: db.users || [],
      bookings: db.bookings || [],
      requestRecipients: db.requestRecipients || [],
      deals: db.deals || [],
      reviews: db.reviews || [],
      payments: db.payments || [],
      notifications: db.notifications || []
    };
  }

  function qdb() {
    return mirror();
  }

  async function snapshot() {
    var adapter = getAdapter();
    if (adapter && typeof adapter.getMarketplaceSnapshot === 'function') {
      return adapter.getMarketplaceSnapshot();
    }
    var db = getDB();
    if (!db) {
      return Result
        ? Result.fail(Errors.CODES.UNKNOWN, 'داده در دسترس نیست')
        : { ok: false, message: 'داده در دسترس نیست' };
    }
    return Result
      ? Result.ok(mirror())
      : { ok: true, data: mirror() };
  }

  function currentUserId() {
    var u = State && State.getCurrentUser ? State.getCurrentUser() : global.currentUser;
    return u && u.id != null ? u.id : null;
  }

  function requests() { return mirror().requests; }
  function deals() { return mirror().deals; }
  function recipients() { return mirror().requestRecipients; }
  function machines() { return mirror().machines; }
  function listings() { return mirror().listings; }
  function users() { return mirror().users; }
  function reviews() { return mirror().reviews; }
  function bookings() { return mirror().bookings; }
  function payments() { return mirror().payments; }

  function getRequest(id, opts) {
    opts = opts || {};
    return requests().find(function (r) {
      if (String(r.id) !== String(id)) return false;
      if (opts.userId != null && String(r.userId) !== String(opts.userId)) return false;
      return true;
    }) || null;
  }

  function getDeal(id, opts) {
    opts = opts || {};
    return deals().find(function (d) {
      if (String(d.id) !== String(id)) return false;
      if (opts.userId != null) {
        var uid = String(opts.userId);
        var mine = String(d.userId) === uid || String(d.providerId) === uid;
        if (!mine) return false;
      }
      return true;
    }) || null;
  }

  function getMyRequest(requestId) {
    return getRequest(requestId, { userId: currentUserId() });
  }

  function getMyDeal(dealId) {
    return getDeal(dealId, { userId: currentUserId() });
  }

  function findUser(id) {
    if (id == null) return null;
    return users().find(function (u) {
      return String(u.id) === String(id);
    }) || null;
  }

  function findRequest(id) {
    return getRequest(id);
  }

  function findDeal(id) {
    return getDeal(id);
  }

  var queryService = {
    bindDataAccess: bindDataAccess,
    snapshot: snapshot,
    mirror: mirror,
    qdb: qdb,
    requests: requests,
    deals: deals,
    recipients: recipients,
    machines: machines,
    listings: listings,
    users: users,
    reviews: reviews,
    bookings: bookings,
    payments: payments,
    getRequest: getRequest,
    getDeal: getDeal,
    getMyRequest: getMyRequest,
    getMyDeal: getMyDeal,
    findUser: findUser,
    findRequest: findRequest,
    findDeal: findDeal
  };

  global.KeloQueryService = queryService;
  global.qdb = qdb;
  if (global.KeloService) global.KeloService.query = queryService;
})(typeof window !== 'undefined' ? window : globalThis);
