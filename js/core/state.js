/**
 * KELO — Shared app state (Phase 0)
 *
 * فقط نگهداری state مشترک. بدون Business Logic.
 * در فازهای بعدی، Serviceها از اینجا currentUser را می‌خوانند/می‌نویسند.
 *
 * توجه: در Phase 0 هنوز app.js مالک اصلی currentUser است.
 * این ماژول برای آماده‌سازی قرارداد و همگام‌سازی اختیاری است.
 */
(function (global) {
  'use strict';

  var _currentUser = null;
  var _session = {
    mode: 'local', // 'local' | 'server' | 'server-error'
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
    return {
      mode: _session.mode,
      ready: _session.ready
    };
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
      try { fn(event); } catch (e) { /* ignore listener errors */ }
    });
  }

  /**
   * همگام‌سازی یک‌طرفه از متغیرهای legacy داخل app.js
   * تا قبل از مهاجرت کامل Auth، state یکپارچه بماند.
   */
  function syncFromLegacy(user, mode) {
    if (user !== undefined) _currentUser = user || null;
    if (mode) _session.mode = mode;
    return {
      currentUser: _currentUser,
      session: getSession()
    };
  }

  global.KeloState = {
    getCurrentUser: getCurrentUser,
    setCurrentUser: setCurrentUser,
    clearCurrentUser: clearCurrentUser,
    getSession: getSession,
    setSessionMode: setSessionMode,
    isAuthenticated: isAuthenticated,
    onChange: onChange,
    syncFromLegacy: syncFromLegacy
  };
})(typeof window !== 'undefined' ? window : globalThis);
