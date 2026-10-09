/**
 * KELO — Assets Service (lands / fleet)
 */
(function (global) {
  'use strict';

  var Result = global.KeloResult;
  var Errors = global.KeloErrors;
  var State = global.KeloState;
  var Domain = null;

  function domain() {
    return Domain || global.KeloAssetsDomain;
  }

  function getAdapter() {
    if (global.KeloService && typeof global.KeloService.adapter === 'function') {
      return global.KeloService.adapter();
    }
    return global.KeloLocalAdapter || global.KeloApiAdapter || null;
  }

  function currentUserId(explicit) {
    // Accept raw id, or payload object { userId / id }
    if (explicit && typeof explicit === 'object') {
      explicit = explicit.userId || explicit.id || null;
    }
    if (explicit) return explicit;
    if (State && typeof State.getCurrentUser === 'function') {
      var u = State.getCurrentUser();
      if (u && u.id) return u.id;
    }
    if (global.currentUser && global.currentUser.id) return global.currentUser.id;
    return null;
  }

  function listLands(userId) {
    var uid = currentUserId(userId);
    if (!uid) return Result.fail(Errors.CODES.UNAUTHORIZED, Errors.messageFor(Errors.CODES.UNAUTHORIZED));
    var adapter = getAdapter();
    if (adapter && typeof adapter.listLands === 'function') {
      return adapter.listLands({ userId: uid });
    }
    return Result.ok({ lands: [] });
  }

  function listFleet(userId) {
    var uid = currentUserId(userId);
    if (!uid) return Result.fail(Errors.CODES.UNAUTHORIZED, Errors.messageFor(Errors.CODES.UNAUTHORIZED));
    var adapter = getAdapter();
    if (adapter && typeof adapter.listFleet === 'function') {
      return adapter.listFleet({ userId: uid });
    }
    return Result.ok({ fleet: [] });
  }

  function createLand(input) {
    var uid = currentUserId(input && input.userId);
    if (!uid) return Result.fail(Errors.CODES.UNAUTHORIZED, Errors.messageFor(Errors.CODES.UNAUTHORIZED));
    var d = domain();
    var payload = Object.assign({}, input || {}, { userId: uid });
    var v = d.validateLand(payload);
    if (!v.ok) return Result.fail(Errors.CODES.VALIDATION, v.message);
    var adapter = getAdapter();
    if (!adapter || typeof adapter.createLand !== 'function') {
      return Result.fail(Errors.CODES.UNKNOWN, 'Adapter دارایی در دسترس نیست.');
    }
    return adapter.createLand(payload);
  }

  function updateLand(input) {
    var uid = currentUserId(input && input.userId);
    if (!uid) return Result.fail(Errors.CODES.UNAUTHORIZED, Errors.messageFor(Errors.CODES.UNAUTHORIZED));
    var d = domain();
    var payload = Object.assign({}, input || {}, { userId: uid });
    if (!payload.id) return Result.fail(Errors.CODES.VALIDATION, 'شناسه زمین مشخص نیست.');
    var v = d.validateLand(payload);
    if (!v.ok) return Result.fail(Errors.CODES.VALIDATION, v.message);
    var adapter = getAdapter();
    if (!adapter || typeof adapter.updateLand !== 'function') {
      return Result.fail(Errors.CODES.UNKNOWN, 'Adapter به‌روزرسانی زمین در دسترس نیست.');
    }
    return adapter.updateLand(payload);
  }

  function deleteLand(id, userId) {
    var uid = currentUserId(userId);
    if (!uid) return Result.fail(Errors.CODES.UNAUTHORIZED, Errors.messageFor(Errors.CODES.UNAUTHORIZED));
    var adapter = getAdapter();
    if (!adapter || typeof adapter.deleteLand !== 'function') {
      return Result.fail(Errors.CODES.UNKNOWN, 'Adapter دارایی در دسترس نیست.');
    }
    return adapter.deleteLand({ id: id, userId: uid });
  }

  function updateMachine(input) {
    var uid = currentUserId(input && input.userId);
    if (!uid) return Result.fail(Errors.CODES.UNAUTHORIZED, Errors.messageFor(Errors.CODES.UNAUTHORIZED));
    var payload = Object.assign({}, input || {}, { userId: uid });
    if (!payload.id) return Result.fail(Errors.CODES.VALIDATION, 'شناسه ماشین مشخص نیست.');
    var adapter = getAdapter();
    if (!adapter || typeof adapter.updateMachine !== 'function') {
      return Result.fail(Errors.CODES.UNKNOWN, 'Adapter به‌روزرسانی ماشین در دسترس نیست.');
    }
    return adapter.updateMachine(payload);
  }

  function createMachine(input) {
    var uid = currentUserId(input && input.userId);
    if (!uid) return Result.fail(Errors.CODES.UNAUTHORIZED, Errors.messageFor(Errors.CODES.UNAUTHORIZED));
    var d = domain();
    var payload = Object.assign({}, input || {}, { userId: uid });
    var v = d.validateMachine(payload);
    if (!v.ok) return Result.fail(Errors.CODES.VALIDATION, v.message);
    var adapter = getAdapter();
    if (!adapter || typeof adapter.createMachine !== 'function') {
      return Result.fail(Errors.CODES.UNKNOWN, 'Adapter دارایی در دسترس نیست.');
    }
    return adapter.createMachine(payload);
  }

  function deleteMachine(id, userId) {
    var uid = currentUserId(userId);
    if (!uid) return Result.fail(Errors.CODES.UNAUTHORIZED, Errors.messageFor(Errors.CODES.UNAUTHORIZED));
    var adapter = getAdapter();
    if (!adapter || typeof adapter.deleteMachine !== 'function') {
      return Result.fail(Errors.CODES.UNKNOWN, 'Adapter دارایی در دسترس نیست.');
    }
    return adapter.deleteMachine({ id: id, userId: uid });
  }

  /**
   * After successful need/provide create — capture asset if not duplicate.
   * Returns Promise<Result> or sync Result.
   */
  function captureFromRequest(userId, kind, service, data) {
    var uid = currentUserId(userId);
    if (!uid || !data) return Result.ok({ skipped: true });
    var d = domain();
    var adapter = getAdapter();
    if (!adapter) return Result.ok({ skipped: true });

    if (kind === 'need' || kind === 'receive') {
      var land = d.landFromRequestData(uid, service, data);
      if (!land.location || typeof land.location.lat !== 'number') {
        return Result.ok({ skipped: true, reason: 'no_location' });
      }
      if (!(Number(land.area) > 0)) return Result.ok({ skipped: true, reason: 'no_area' });
      return Promise.resolve(listLands(uid)).then(function (res) {
        var lands = (res && res.ok && res.data && res.data.lands) ? res.data.lands : [];
        if (lands.some(function (L) { return d.isSameLand(L, land); })) {
          return Result.ok({ skipped: true, reason: 'duplicate' });
        }
        return createLand(land);
      });
    }

    if (kind === 'provide') {
      var machine = d.machineFromRequestData(uid, service, data);
      if (!machine.machineType) return Result.ok({ skipped: true });
      return Promise.resolve(listFleet(uid)).then(function (res) {
        var fleet = (res && res.ok && res.data && res.data.fleet) ? res.data.fleet : [];
        if (fleet.some(function (M) { return d.isSameMachine(M, machine); })) {
          return Result.ok({ skipped: true, reason: 'duplicate' });
        }
        return createMachine(machine);
      });
    }
    return Result.ok({ skipped: true });
  }

  global.KeloAssetsService = {
    listLands: listLands,
    listFleet: listFleet,
    createLand: createLand,
    updateLand: updateLand,
    deleteLand: deleteLand,
    createMachine: createMachine,
    updateMachine: updateMachine,
    deleteMachine: deleteMachine,
    captureFromRequest: captureFromRequest
  };
})(typeof window !== 'undefined' ? window : globalThis);
