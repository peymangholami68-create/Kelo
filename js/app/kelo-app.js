/**
 * KELO — Application bootstrap (Phase 19B)
 *
 * Single entry: KeloApp.init()
 *
 * Layers (do not put Domain rules here):
 *   UI modules → KeloService → Domain → Adapter → Data
 */
(function (global) {
  'use strict';

  var _ready = false;
  var _initPromise = null;

  var UI_MODULES = [
    'KeloAuthUI',
    'KeloProfileUI',
    'KeloRequestUI',
    'KeloProposalUI',
    'KeloDealUI',
    'KeloPaymentUI',
    'KeloMapUI',
    'KeloSheetUI'
  ];

  function getDb() {
    return global.db;
  }

  function bindDataLayer() {
    if (!global.KeloLocalAdapter || typeof global.KeloLocalAdapter.bindDataAccess !== 'function') {
      console.warn('KELO: LocalAdapter missing at bindDataLayer');
      return;
    }
    global.KeloLocalAdapter.bindDataAccess({
      getDB: function () { return getDb(); },
      saveDB: function () {
        return typeof global.saveDB === 'function' ? global.saveDB() : false;
      },
      normalizePhone: function (v) {
        return typeof global.normalizePhone === 'function' ? global.normalizePhone(v) : v;
      },
      normalizeNationalId: function (v) {
        return typeof global.normalizeNationalId === 'function' ? global.normalizeNationalId(v) : v;
      },
      isAdmin: function (u) {
        return typeof global.isAdmin === 'function' ? global.isAdmin(u) : false;
      },
      helpers: {
        hasActiveProposalForRequest: function (a, b, c) {
          return typeof global.hasActiveProposalForRequest === 'function'
            ? global.hasActiveProposalForRequest(a, b, c) : false;
        },
        getEligibleProvidersForRequest: function (r) {
          return typeof global.getEligibleProvidersForRequest === 'function'
            ? global.getEligibleProvidersForRequest(r) : [];
        },
        calculateTotal: function (req, data, price) {
          return typeof global.calculateTotal === 'function'
            ? global.calculateTotal(req, data, price) : (Number(price) || 0);
        },
        sendOfferAlreadyToast: function (r) {
          return typeof global.sendOfferAlreadyToast === 'function' ? global.sendOfferAlreadyToast(r) : null;
        },
        sendOfferSuccessToast: function (r) {
          return typeof global.sendOfferSuccessToast === 'function' ? global.sendOfferSuccessToast(r) : null;
        },
        sendOfferUnavailableToast: function (r) {
          return typeof global.sendOfferUnavailableToast === 'function' ? global.sendOfferUnavailableToast(r) : null;
        },
        providerHasUnfinishedDeal: function (uid) {
          return typeof global.providerHasUnfinishedDeal === 'function'
            ? global.providerHasUnfinishedDeal(uid) : false;
        },
        serviceName: function (s) {
          return typeof global.serviceName === 'function' ? global.serviceName(s) : s;
        },
        requestDate: function (r) {
          return typeof global.requestDate === 'function' ? global.requestDate(r) : '';
        },
        parseStoredDate: function (v) {
          return typeof global.parseStoredDate === 'function' ? global.parseStoredDate(v) : null;
        },
        nearestCityFromCoords: function (lat, lng) {
          return typeof global.nearestCityFromCoords === 'function'
            ? global.nearestCityFromCoords(lat, lng) : null;
        },
        provinceFromCity: function (c) {
          return typeof global.provinceFromCity === 'function' ? global.provinceFromCity(c) : null;
        },
        formatActivityArea: function (a) {
          return typeof global.formatActivityArea === 'function' ? global.formatActivityArea(a) : '';
        }
      }
    });

    if (global.KeloQueryService && typeof global.KeloQueryService.bindDataAccess === 'function') {
      global.KeloQueryService.bindDataAccess({
        getDB: function () { return getDb(); }
      });
    }
  }

  function bindUiModules() {
    UI_MODULES.forEach(function (name) {
      var mod = global[name];
      if (mod && typeof mod.init === 'function') {
        try {
          mod.init();
        } catch (e) {
          console.warn('KELO UI init failed:', name, e);
        }
      }
    });
  }

  function applyImageFallbacks() {
    var map = global.driveImageMap;
    if (!map) return;
    document.querySelectorAll('img').forEach(function (img) {
      var localSrc = img.getAttribute('src') || '';
      var parts = localSrc.split('/');
      var filename = parts[parts.length - 1].split('?')[0];
      var externalUrl = map[filename];
      if (externalUrl) {
        img.dataset.fallbackExternal = externalUrl;
        img.src = localSrc;
        img.onerror = function () {
          if (this.dataset.fallbackExternal && !this.dataset.triedExternal) {
            this.dataset.triedExternal = 'true';
            this.src = this.dataset.fallbackExternal;
          } else {
            this.style.background = '#dfe7cc';
          }
        };
      }
    });
  }

  function installPwaManifest() {
    try {
      var iconSvg = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'><rect width='512' height='512' rx='96' fill='%23C5B23E'/><text x='256' y='340' text-anchor='middle' font-family='Tahoma,sans-serif' font-size='280' font-weight='900' fill='%23fff'>K</text></svg>";
      var manifest = {
        name: 'کِلو | بازار خدمات کشاورزی',
        short_name: 'کِلو',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#fffdf6',
        theme_color: '#C5B23E',
        lang: 'fa',
        dir: 'rtl',
        icons: [{
          src: 'data:image/svg+xml;utf8,' + iconSvg,
          sizes: '512x512',
          type: 'image/svg+xml',
          purpose: 'any maskable'
        }]
      };
      var blob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
      var link = document.createElement('link');
      link.rel = 'manifest';
      link.href = URL.createObjectURL(blob);
      document.head.appendChild(link);
    } catch (e) { /* ignore */ }
  }

  function removePreloadStyle() {
    var preStyle = document.getElementById('keloPreloadHideLanding');
    if (preStyle) preStyle.remove();
  }

  async function restoreSessionAndPaint() {
    // Phase 19B: no direct KeloBackend — go through Service/Sync
    if (global.KeloService && typeof global.KeloService.bootstrap === 'function') {
      await global.KeloService.bootstrap();
    } else if (global.KeloSync && typeof global.KeloSync.initRuntime === 'function') {
      await global.KeloSync.initRuntime();
    }

    var authApi = global.KeloService && global.KeloService.auth;
    if (!authApi) {
      removePreloadStyle();
      if (typeof global.showToast === 'function') {
        global.showToast('سرویس ورود کِلو بارگذاری نشد.', 'error');
      }
      return { ok: false, reason: 'no-auth-service' };
    }

    var restored = await authApi.restoreSession();
    removePreloadStyle();

    if (!restored || !restored.ok) {
      if (restored && restored.code === 'SERVER_UNAVAILABLE' && typeof global.showToast === 'function') {
        global.showToast(restored.message || 'سرویس داده کِلو در دسترس نیست.', 'error');
      }
      return restored || { ok: false };
    }

    var user = restored.data && restored.data.user;
    var mode = (restored.data && restored.data.mode) ||
      (global.KeloService.mode && global.KeloService.mode());

    if (user) {
      if (typeof global.enterAuthenticatedUser === 'function') {
        global.enterAuthenticatedUser(user, { render: false });
      }
      if (mode === 'server' && typeof global.refreshServerSnapshot === 'function') {
        try {
          await global.refreshServerSnapshot(false);
        } catch (err) {
          console.warn('kelo snapshot on boot:', err);
        }
      }
      var cu = global.currentUser;
      if (cu && !cu.profileCompleted && typeof global.showCompleteProfile === 'function') {
        global.showCompleteProfile();
      } else if (typeof global.renderApp === 'function') {
        global.renderApp();
      }
    } else {
      var landing = document.getElementById('landing');
      var appEl = document.getElementById('app');
      if (appEl) appEl.classList.add('hidden');
      if (landing) landing.classList.remove('hidden');
    }
    return { ok: true, user: user || null, mode: mode };
  }

  function init() {
    if (_initPromise) return _initPromise;
    _initPromise = (async function () {
      bindDataLayer();
      bindUiModules();
      installPwaManifest();
      applyImageFallbacks();
      try {
        await restoreSessionAndPaint();
      } catch (e) {
        removePreloadStyle();
        console.error('KELO App.init failed', e);
        if (typeof global.showToast === 'function') {
          global.showToast('خطا در راه‌اندازی ورود کِلو.', 'error');
        }
        throw e;
      }
      _ready = true;
      try {
        global.dispatchEvent(new CustomEvent('kelo:ready', { detail: { app: KeloApp } }));
      } catch (e2) { /* ignore */ }
      return KeloApp;
    })();
    return _initPromise;
  }

  var KeloApp = {
    version: '18',
    isReady: function () { return _ready; },
    init: init,
    bindDataLayer: bindDataLayer,
    bindUiModules: bindUiModules,
    render: function () {
      if (typeof global.renderApp === 'function') global.renderApp();
    },
    modules: UI_MODULES
  };

  global.KeloApp = KeloApp;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      KeloApp.init();
    });
  } else {
    KeloApp.init();
  }
})(typeof window !== 'undefined' ? window : globalThis);
