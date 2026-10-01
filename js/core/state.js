/**
 * KELO — Shared app state (Phase 11)
 *
 * منبع حقیقت برای currentUser و session mode.
 */
(function (global) {
  'use strict';

  var _currentUser = null;
  var _session = {
    mode: 'local',
    ready: false
  };
  var _listeners = [];

  function getCurrentUser() {
    return _currentUser;
  }

  function setCurrentUser(user) {
    _currentUser = user || null;
    _notify({ type: 'user', user: _currentUser });
    return _currentUser;
  }

  function clearCurrentUser() {
    return setCurrentUser(null);
  }

  function getSession() {
    return { mode: _session.mode, ready: _session.ready };
  }

  function setSessionMode(mode, ready) {
    if (mode) _session.mode = mode;
    if (typeof ready === 'boolean') _session.ready = ready;
    _notify({ type: 'session', session: getSession() });
    return getSession();
  }

  function isAuthenticated() {
    return !!_currentUser;
  }

  function onChange(fn) {
    if (typeof fn !== 'function') return function () {};
    _listeners.push(fn);
    return function unsubscribe() {
      _listeners = _listeners.filter(function (x) { return x !== fn; });
    };
  }

  function _notify(event) {
    _listeners.forEach(function (fn) {
      try { fn(event); } catch (e) { /* ignore */ }
    });
  }

  function syncFromLegacy(user, mode) {
    if (user !== undefined) setCurrentUser(user);
    if (mode) setSessionMode(mode);
    return { currentUser: _currentUser, session: getSession() };
  }

  /**
   * window.currentUser را به KeloState وصل می‌کند تا همه scriptهای کلاسیک
   * یک منبع حقیقت داشته باشند.
   */
  function installWindowBridge() {
    if (!global || typeof global.Object === 'undefined' || !global.Object.defineProperty) {
      return;
    }
    try {
      var existing = global.Object.getOwnPropertyDescriptor(global, 'currentUser');
      if (existing && existing.get && existing.set) return;
      global.Object.defineProperty(global, 'currentUser', {
        configurable: true,
        enumerable: true,
        get: function () {
          return _currentUser;
        },
        set: function (v) {
          setCurrentUser(v);
        }
      });
    } catch (e) {
      try { global.currentUser = _currentUser; } catch (e2) {}
    }
  }

  installWindowBridge();

  global.KeloState = {
    getCurrentUser: getCurrentUser,
    setCurrentUser: setCurrentUser,
    clearCurrentUser: clearCurrentUser,
    getSession: getSession,
    setSessionMode: setSessionMode,
    isAuthenticated: isAuthenticated,
    onChange: onChange,
    syncFromLegacy: syncFromLegacy,
    installWindowBridge: installWindowBridge
  };
})(typeof window !== 'undefined' ? window : globalThis);
