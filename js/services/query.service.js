/**
 * KELO — Query / Read layer (Cleanup C)
 *
 * UI should read marketplace data through here, not via global `db.*`.
 * Writes still go through domain services.
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
    // last-resort compatibility (should be bound from app.js)
    if (global.db) return global.db;
    return null;
  }

  function getAdapter() {
    if (global.KeloService && typeof global.KeloService.adapter === 'function') {
      return global.KeloService.adapter();
    }
    return global.KeloLocalAdapter || null;
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
      ? Result.ok({
          requests: db.requests || [],
          listings: db.listings || [],
          machines: db.machines || [],
          users: db.users || [],
          bookings: db.bookings || [],
          requestRecipients: db.requestRecipients || [],
          deals: db.deals || [],
          reviews: db.reviews || []
        })
      : { ok: true, data: db };
  }

  function currentUserId() {
    var u = State && State.getCurrentUser ? State.getCurrentUser() : global.currentUser;
    return u && u.id != null ? u.id : null;
  }

  /** Synchronous helpers for UI that still runs sync render paths */
  function requests() {
    var db = getDB();
    return (db && db.requests) || [];
  }

  function deals() {
    var db = getDB();
    return (db && db.deals) || [];
  }

  function recipients() {
    var db = getDB();
    return (db && db.requestRecipients) || [];
  }

  function machines() {
    var db = getDB();
    return (db && db.machines) || [];
  }

  function listings() {
    var db = getDB();
    return (db && db.listings) || [];
  }

  function getRequest(id, opts) {
    opts = opts || {};
    var list = requests();
    return list.find(function (r) {
      if (String(r.id) !== String(id)) return false;
      if (opts.userId != null && String(r.userId) !== String(opts.userId)) return false;
      return true;
    }) || null;
  }

  function getDeal(id, opts) {
    opts = opts || {};
    var list = deals();
    return list.find(function (d) {
      if (String(d.id) !== String(id)) return false;
      if (opts.userId != null && String(d.userId) !== String(opts.userId)) return false;
      return true;
    }) || null;
  }

  function getMyRequest(requestId) {
    return getRequest(requestId, { userId: currentUserId() });
  }

  function getMyDeal(dealId) {
    return getDeal(dealId, { userId: currentUserId() });
  }

  var queryService = {
    bindDataAccess: bindDataAccess,
    snapshot: snapshot,
    requests: requests,
    deals: deals,
    recipients: recipients,
    machines: machines,
    listings: listings,
    getRequest: getRequest,
    getDeal: getDeal,
    getMyRequest: getMyRequest,
    getMyDeal: getMyDeal
  };

  global.KeloQueryService = queryService;
  if (global.KeloService) global.KeloService.query = queryService;
})(typeof window !== 'undefined' ? window : globalThis);
