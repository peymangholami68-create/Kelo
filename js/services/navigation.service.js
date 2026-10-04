/**
 * KELO Navigation — open external maps apps
 */
(function (global) {
  'use strict';

  function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent || '') ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  function tryOpenApp(appUrl, fallbackUrl) {
    var fallbackTimer = setTimeout(function () {
      if (fallbackUrl) window.location.href = fallbackUrl;
    }, 1200);
    window.addEventListener('blur', function () { clearTimeout(fallbackTimer); }, { once: true });
    window.location.href = appUrl;
  }

  function closeNavSheet() {
    var el = document.getElementById('keloNavChoiceSheet');
    if (el) el.remove();
  }

  function showNavigationChoiceSheet(options) {
    closeNavSheet();
    var list = (options || []).map(function (opt, i) {
      return '<button type="button" class="kelo-nav-choice-btn" data-idx="' + i + '">' +
        (opt.label || 'نقشه') + '</button>';
    }).join('');
    var html =
      '<div class="mobile-sheet-backdrop open" id="keloNavChoiceSheet" style="z-index:12000">' +
      '<div class="mobile-sheet" style="max-height:55vh">' +
      '<button type="button" class="mobile-sheet-handle"></button>' +
      '<div class="mobile-sheet-header"><h2 style="margin:0;font-size:16px">مسیریابی با</h2>' +
      '<button type="button" class="mobile-sheet-back-btn" id="keloNavChoiceClose" aria-label="بستن">×</button></div>' +
      '<div class="mobile-sheet-body" style="padding:8px 16px 20px;display:flex;flex-direction:column;gap:8px">' + list + '</div>' +
      '</div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
    var root = document.getElementById('keloNavChoiceSheet');
    root.querySelector('#keloNavChoiceClose').onclick = closeNavSheet;
    root.addEventListener('click', function (e) {
      if (e.target === root) closeNavSheet();
    });
    root.querySelectorAll('.kelo-nav-choice-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var opt = options[Number(btn.getAttribute('data-idx'))];
        closeNavSheet();
        if (opt) tryOpenApp(opt.url, opt.fallback);
      });
    });
  }

  function openNavigationTo(lat, lng, label) {
    if (typeof lat !== 'number' || typeof lng !== 'number') return;
    var encodedLabel = encodeURIComponent(label || 'مقصد');

    if (!isIOS()) {
      // Android: system chooser for all geo-capable apps
      window.location.href = 'geo:' + lat + ',' + lng + '?q=' + lat + ',' + lng + '(' + encodedLabel + ')';
      return;
    }

    showNavigationChoiceSheet([
      {
        label: 'نشان',
        url: 'neshan://route?dlat=' + lat + '&dlng=' + lng,
        fallback: 'https://neshan.org/maps#/routing/car/origin/current/destination/' + lng + ',' + lat
      },
      {
        label: 'بلد',
        url: 'balad://direction?destination=' + lat + ',' + lng,
        fallback: 'https://balad.ir'
      },
      {
        label: 'Waze',
        url: 'waze://?ll=' + lat + ',' + lng + '&navigate=yes',
        fallback: 'https://waze.com/ul?ll=' + lat + ',' + lng + '&navigate=yes'
      },
      {
        label: 'Google Maps',
        url: 'comgooglemaps://?daddr=' + lat + ',' + lng + '&directionsmode=driving',
        fallback: 'https://www.google.com/maps/dir/?api=1&destination=' + lat + ',' + lng
      },
      {
        label: 'نقشه‌های اپل',
        url: 'maps://?daddr=' + lat + ',' + lng,
        fallback: 'https://maps.apple.com/?daddr=' + lat + ',' + lng
      }
    ]);
  }

  global.KeloNavigationService = {
    openNavigationTo: openNavigationTo,
    showNavigationChoiceSheet: showNavigationChoiceSheet,
    tryOpenApp: tryOpenApp
  };
  global.openNavigationTo = openNavigationTo;
})(typeof window !== 'undefined' ? window : globalThis);
