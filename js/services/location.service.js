/**
 * KELO Location service — share / poll deal live locations
 * Group C: uses Adapter only (no direct KeloBackend).
 */
(function (global) {
  'use strict';

  var _watchId = null;
  var _lastSentAt = 0;
  var _pollTimer = null;
  var SEND_INTERVAL_MS = 15000;
  var POLL_INTERVAL_MS = 15000;

  function getAdapter() {
    if (global.KeloService && typeof global.KeloService.adapter === 'function') {
      return global.KeloService.adapter();
    }
    return global.KeloLocalAdapter || global.KeloApiAdapter || null;
  }

  function startSharingLocation(dealId) {
    if (!navigator.geolocation || !dealId) return;
    stopSharingLocation();
    _watchId = navigator.geolocation.watchPosition(
      function (pos) {
        var now = Date.now();
        if (now - _lastSentAt < SEND_INTERVAL_MS) return;
        _lastSentAt = now;
        var adapter = getAdapter();
        if (!adapter || typeof adapter.updateDealLocation !== 'function') return;
        adapter.updateDealLocation({
          dealId: dealId,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy
        }).catch(function () {});
      },
      function (err) { console.warn('geolocation error', err); },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
    );
  }

  function stopSharingLocation() {
    if (_watchId !== null) {
      try { navigator.geolocation.clearWatch(_watchId); } catch (e) {}
      _watchId = null;
    }
  }

  function startPollingCounterpartyLocation(dealId, onUpdate) {
    stopPollingCounterpartyLocation();
    if (!dealId) return;
    var tick = function () {
      var adapter = getAdapter();
      if (!adapter || typeof adapter.getDealLocation !== 'function') return;
      adapter.getDealLocation({ dealId: dealId }).then(function (res) {
        var loc = res && res.data && res.data.location !== undefined
          ? res.data.location
          : (res && res.location !== undefined ? res.location : (res && res.data) || null);
        // Result.ok wraps as { ok, data: { location } }
        if (res && res.ok && res.data) loc = res.data.location;
        if (loc && typeof onUpdate === 'function') onUpdate(loc);
      }).catch(function () {});
    };
    tick();
    _pollTimer = setInterval(tick, POLL_INTERVAL_MS);
  }

  function stopPollingCounterpartyLocation() {
    if (_pollTimer) {
      clearInterval(_pollTimer);
      _pollTimer = null;
    }
  }

  function stopAll() {
    stopSharingLocation();
    stopPollingCounterpartyLocation();
  }

  global.KeloLocationService = {
    startSharingLocation: startSharingLocation,
    stopSharingLocation: stopSharingLocation,
    startPollingCounterpartyLocation: startPollingCounterpartyLocation,
    stopPollingCounterpartyLocation: stopPollingCounterpartyLocation,
    stopAll: stopAll
  };
  if (global.KeloService) global.KeloService.location = global.KeloLocationService;
})(typeof window !== 'undefined' ? window : globalThis);
