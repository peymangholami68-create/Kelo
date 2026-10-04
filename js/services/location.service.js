/**
 * KELO Location service — share / poll deal live locations
 */
(function (global) {
  'use strict';

  var _watchId = null;
  var _lastSentAt = 0;
  var _pollTimer = null;
  var SEND_INTERVAL_MS = 15000;
  var POLL_INTERVAL_MS = 15000;

  function backend() {
    return global.KeloBackend || null;
  }

  function startSharingLocation(dealId) {
    if (!navigator.geolocation || !dealId) return;
    stopSharingLocation();
    _watchId = navigator.geolocation.watchPosition(
      function (pos) {
        var now = Date.now();
        if (now - _lastSentAt < SEND_INTERVAL_MS) return;
        _lastSentAt = now;
        var api = backend();
        if (!api || typeof api.updateDealLocation !== 'function') return;
        api.updateDealLocation(dealId, {
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
      var api = backend();
      if (!api || typeof api.getDealLocation !== 'function') return;
      api.getDealLocation(dealId).then(function (loc) {
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
})(typeof window !== 'undefined' ? window : globalThis);
