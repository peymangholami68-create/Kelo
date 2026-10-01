/**
 * KELO — Request Service (Phase 3)
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

  function currentUser() {
    if (State && typeof State.getCurrentUser === 'function') {
      return State.getCurrentUser();
    }
    return null;
  }

  /**
   * @param {{ service: string, data: object, requestKind?: 'need'|'provide', userId?: string, requesterName?: string }} input
   */
  async function create(input) {
    var data = input || {};
    var user = currentUser();
    var userId = data.userId || (user && user.id);
    if (!userId) {
      return Result.fail(Errors.CODES.UNAUTHORIZED, Errors.messageFor(Errors.CODES.UNAUTHORIZED));
    }
    if (!data.service) {
      return Result.fail(Errors.CODES.VALIDATION, 'خدمت انتخاب نشده است.');
    }
    var adapter = getAdapter();
    if (!adapter || typeof adapter.createRequest !== 'function') {
      return Result.fail(Errors.CODES.UNKNOWN, 'Adapter درخواست در دسترس نیست.');
    }
    return adapter.createRequest({
      userId: userId,
      requesterName: data.requesterName || (user && user.name) || '',
      service: data.service,
      data: data.data || {},
      requestKind: data.requestKind === 'provide' ? 'provide' : 'need'
    });
  }

  /**
   * @param {{ id: string, service: string, data: object, userId?: string, requesterName?: string }} input
   */
  async function update(input) {
    var data = input || {};
    var user = currentUser();
    var userId = data.userId || (user && user.id);
    if (!userId) {
      return Result.fail(Errors.CODES.UNAUTHORIZED, Errors.messageFor(Errors.CODES.UNAUTHORIZED));
    }
    if (!data.id) {
      return Result.fail(Errors.CODES.VALIDATION, 'شناسه درخواست مشخص نیست.');
    }
    var adapter = getAdapter();
    if (!adapter || typeof adapter.updateRequest !== 'function') {
      return Result.fail(Errors.CODES.UNKNOWN, 'Adapter درخواست در دسترس نیست.');
    }
    return adapter.updateRequest({
      id: data.id,
      userId: userId,
      service: data.service,
      data: data.data || {},
      requesterName: data.requesterName || (user && user.name) || ''
    });
  }

  /**
   * @param {{ id: string, userId?: string }} input
   */
  async function remove(input) {
    var data = input || {};
    var user = currentUser();
    var userId = data.userId || (user && user.id);
    if (!userId) {
      return Result.fail(Errors.CODES.UNAUTHORIZED, Errors.messageFor(Errors.CODES.UNAUTHORIZED));
    }
    if (!data.id) {
      return Result.fail(Errors.CODES.VALIDATION, 'شناسه درخواست مشخص نیست.');
    }
    var adapter = getAdapter();
    if (!adapter || typeof adapter.deleteRequest !== 'function') {
      return Result.fail(Errors.CODES.UNKNOWN, 'Adapter درخواست در دسترس نیست.');
    }
    return adapter.deleteRequest({ id: data.id, userId: userId });
  }

  /**
   * @param {{ service: string, data: object, userId?: string, providerName?: string }} input
   */
  async function createListing(input) {
    var data = input || {};
    var user = currentUser();
    var userId = data.userId || (user && user.id);
    if (!userId) {
      return Result.fail(Errors.CODES.UNAUTHORIZED, Errors.messageFor(Errors.CODES.UNAUTHORIZED));
    }
    var adapter = getAdapter();
    if (!adapter || typeof adapter.createListing !== 'function') {
      return Result.fail(Errors.CODES.UNKNOWN, 'Adapter آگهی در دسترس نیست.');
    }
    return adapter.createListing({
      userId: userId,
      providerName: data.providerName || (user && user.name) || '',
      service: data.service,
      data: data.data || {}
    });
  }

  var requestService = {
    create: create,
    update: update,
    remove: remove,
    createListing: createListing
  };

  global.KeloRequestService = requestService;
  if (global.KeloService) {
    global.KeloService.requests = requestService;
  }
})(typeof window !== 'undefined' ? window : globalThis);
