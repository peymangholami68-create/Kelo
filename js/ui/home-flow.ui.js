/**
 * Home "درخواست در جریان" cards — farmer + provider flow on mobile home.
 */
(function (global) {
  'use strict';

  var DAY_MS = 24 * 60 * 60 * 1000;

  function qdb() {
    try {
      if (global.KeloQueryService && typeof global.KeloQueryService.qdb === 'function') {
        var q = global.KeloQueryService.qdb();
        if (q && (q.requests || q.deals || q.requestRecipients)) return q;
      }
    } catch (e) {}
    // Fallback: live app db (server snapshot / local) — never return empty hard-coded shell
    if (global.db) {
      return {
        requests: global.db.requests || [],
        deals: global.db.deals || [],
        offers: global.db.offers || global.db.requestRecipients || [],
        users: global.db.users || [],
        proposals: global.db.proposals || global.db.requestRecipients || [],
        requestRecipients: global.db.requestRecipients || [],
        reviews: global.db.reviews || [],
        lands: global.db.lands || [],
        fleet: global.db.fleet || []
      };
    }
    return {
      requests: [], deals: [], offers: [], users: [], proposals: [],
      requestRecipients: [], reviews: [], lands: [], fleet: []
    };
  }

  function serviceLabel(code) {
    try {
      if (global.SERVICE_DEFS && global.SERVICE_DEFS[code] && global.SERVICE_DEFS[code].name) {
        return global.SERVICE_DEFS[code].name;
      }
    } catch (e) {}
    var map = { tractor: 'شخم و دیسک', planting: 'کاشت', spray: 'سمپاشی', harvest: 'برداشت' };
    return map[code] || code || 'خدمت';
  }

  function fmtMoney(n) {
    n = Number(n) || 0;
    try {
      if (typeof global.fmtNum === 'function') return global.fmtNum(n);
    } catch (e) {}
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '٬');
  }

  function escapeHtml(s) {
    if (typeof global.escapeHtml === 'function') return global.escapeHtml(s);
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function userName(id) {
    var u = (qdb().users || []).find(function (x) { return String(x.id) === String(id); });
    return (u && u.name) ? u.name : 'طرف مقابل';
  }

  function requestCity(req) {
    if (!req) return 'منطقه فعالیت';
    var c = req.city || req.area || req.serviceLocation || req.activityArea || '';
    if (typeof c === 'object' && c && c.name) c = c.name;
    if (Array.isArray(c)) c = c.filter(Boolean).join('، ');
    c = String(c || '').trim();
    if (!c && req.fields) {
      c = req.fields.activityArea || req.fields.serviceLocation || '';
    }
    return c || 'مازندران';
  }

  function offersForRequest(reqId) {
    var db = qdb();
    var seen = {};
    var list = [];
    function add(arr) {
      (arr || []).forEach(function (o) {
        if (!o) return;
        if (String(o.requestId) !== String(reqId)) return;
        var st = String(o.status || 'pending');
        // inbound active proposals for this request
        if (st !== 'pending' && st !== 'accepted') return;
        var key = String(o.id || (o.proposerId || '') + ':' + (o.providerId || o.recipientId || ''));
        if (seen[key]) return;
        seen[key] = 1;
        list.push(o);
      });
    }
    add(db.requestRecipients);
    add(db.offers);
    add(db.proposals);
    return list;
  }

  function dealsForRequest(reqId) {
    return (qdb().deals || []).filter(function (d) {
      return String(d.requestId) === String(reqId);
    });
  }

  function activeDealForRequest(reqId) {
    var deals = dealsForRequest(reqId);
    return deals.find(function (d) {
      return d.status !== 'cancelled';
    }) || null;
  }

  function hasUserReviewed(dealId, userId) {
    if (typeof global.hasUserReviewedDeal === 'function') {
      try {
        if (global.hasUserReviewedDeal(dealId, userId)) return true;
        if (global.hasUserReviewedDeal(dealId)) return true;
      } catch (e) {}
    }
    var reviews = qdb().reviews || [];
    return reviews.some(function (r) {
      if (String(r.dealId) !== String(dealId)) return false;
      var who = r.userId || r.authorId || r.reviewerId || r.author_id;
      return String(who) === String(userId);
    });
  }

  function completedAtMs(deal) {
    var t = deal.completedAt || deal.completed_at || deal.updatedAt || deal.updated_at;
    if (!t) return 0;
    var ms = Date.parse(t);
    return isNaN(ms) ? 0 : ms;
  }

  function isExpiredCompletedCard(deal) {
    if (!deal || deal.status !== 'completed') return false;
    if (deal.paymentStatus !== 'paid') return false;
    var ms = completedAtMs(deal);
    if (!ms) return false;
    return (Date.now() - ms) > DAY_MS;
  }

  /** Farmer cannot create new need-request while unpaid completed deal exists */
  function farmerHasUnpaidCompletedBlock(userId) {
    return (qdb().deals || []).some(function (d) {
      return String(d.userId) === String(userId) &&
        d.status === 'completed' &&
        d.paymentStatus !== 'paid';
    });
  }

  global.keloFarmerHasUnpaidBlock = farmerHasUnpaidCompletedBlock;

  function farmerCards(userId) {
    var cards = [];
    var uid = String(userId);
    var requests = (qdb().requests || []).filter(function (r) {
      if (!r) return false;
      var owner = String(r.userId || r.requesterId || r.requester_id || '');
      if (owner !== uid) return false;
      var kind = r.requestKind || r.request_kind || 'need';
      return kind !== 'provide';
    });
    // oldest first
    requests.sort(function (a, b) {
      return String(a.createdAt || a.id).localeCompare(String(b.createdAt || b.id));
    });

    requests.forEach(function (req) {
      var st = String(req.status || 'pending');
      if (st === 'cancelled' || st === 'deleted' || st === 'expired') return;
      var deal = activeDealForRequest(req.id);
      var svc = serviceLabel(req.service);
      var needPhrase = 'نیاز به ' + svc;

      if (deal && deal.status === 'completed') {
        if (deal.paymentStatus === 'paid') {
          if (isExpiredCompletedCard(deal)) return;
          var providerName = userName(deal.providerId);
          var reviewed = hasUserReviewed(deal.id, userId);
          if (reviewed && isExpiredCompletedCard(deal)) return;
          cards.push({
            kind: 'farmer-done-paid',
            dealId: deal.id,
            requestId: req.id,
            title: svc + ' مزرعه‌تان به پایان رسید.',
            sub: reviewed
              ? ('شما به ' + providerName + ' امتیاز داده‌اید. متشکریم.')
              : ('چطور بود؟ به ' + providerName + ' امتیاز بدید'),
            action: reviewed ? 'deal' : 'review'
          });
        } else {
          cards.push({
            kind: 'farmer-done-unpaid',
            dealId: deal.id,
            requestId: req.id,
            title: 'کار ' + svc + ' مزرعه‌تان تمام شده، ولی هنوز پرداختش ثبت نشده.',
            sub: 'با ثبت پرداخت، هم کار جمع می‌شه هم می‌تونید درخواست بعدی را بزنید.',
            action: 'pay'
          });
        }
        return;
      }

      if (deal && (deal.status === 'agreed' || deal.status === 'paid' || deal.status === 'in_progress' || deal.paymentStatus === 'paid')) {
        var total = deal.total != null ? deal.total : deal.price;
        cards.push({
          kind: 'farmer-agreed',
          dealId: deal.id,
          requestId: req.id,
          title: 'برای ' + svc + ' مزرعه‌تان یک توافق صورت گرفت.',
          sub: 'مبلغ کل: ' + fmtMoney(total) + ' تومان',
          action: 'pay'
        });
        return;
      }

      // open request without active deal
      if (req.status === 'closed' || req.status === 'fulfilled' || req.status === 'accepted' || req.status === 'completed') return;
      var nProviders = countActiveProvidersNear(req);
      var nDisp = nProviders;
      try {
        if (typeof global.toPersianDigits === 'function') nDisp = global.toPersianDigits(String(nProviders));
      } catch (e) {}
      var sub = nProviders > 0
        ? (nDisp + ' ماشین‌دار فعال در منطقه فعالیت شما پیدا شد.')
        : 'هنوز ماشین‌دار فعالی در منطقه شما پیدا نشد. کمی صبر کنید.';
      cards.push({
        kind: 'farmer-open',
        requestId: req.id,
        title: 'یک درخواست ' + needPhrase + ' برای مزرعه‌تان ثبت کرده‌اید.',
        sub: sub,
        action: 'request'
      });
    });
    return cards;
  }

  function providerCards(userId) {
    var cards = [];
    var activeDeals = (qdb().deals || []).filter(function (d) {
      return String(d.providerId) === String(userId) && d.status !== 'cancelled';
    });
    // sort oldest first
    activeDeals.sort(function (a, b) {
      return String(a.createdAt || a.id).localeCompare(String(b.createdAt || b.id));
    });

    var hasActiveDeal = activeDeals.some(function (d) {
      return d.status !== 'completed' || d.paymentStatus !== 'paid' || !isExpiredCompletedCard(d);
    });

    // If any non-expired deal (including completed awaiting review/paid within day)
    var dealCards = [];
    activeDeals.forEach(function (deal) {
      var req = (qdb().requests || []).find(function (r) { return String(r.id) === String(deal.requestId); });
      var svc = serviceLabel((req && req.service) || deal.service);
      var city = requestCity(req);
      if (deal.status === 'completed') {
        if (deal.paymentStatus === 'paid' && isExpiredCompletedCard(deal)) return;
        var farmerName = userName(deal.userId || deal.requesterId);
        var reviewed = hasUserReviewed(deal.id, userId);
        if (reviewed && isExpiredCompletedCard(deal)) return;
        dealCards.push({
          kind: 'provider-done',
          dealId: deal.id,
          title: reviewed ? 'امتیاز شما ثبت شد.' : 'کارتان تمام شد؛ حالا نوبت امتیاز است.',
          sub: reviewed
            ? ('شما به ' + farmerName + ' امتیاز داده‌اید.')
            : ('ثبت امتیاز ' + farmerName),
          action: reviewed ? 'deal' : 'review'
        });
        return;
      }
      var total = deal.total != null ? deal.total : deal.price;
      dealCards.push({
        kind: 'provider-agreed',
        dealId: deal.id,
        title: 'برای ارائه‌ی ' + svc + ' در ' + city + ' توافق کردید.',
        sub: 'مبلغ کل: ' + fmtMoney(total) + ' تومان',
        action: 'pay'
      });
    });

    if (dealCards.length) return dealCards;

    // No active deals → listing / provide requests
    var provides = (qdb().requests || []).filter(function (r) {
      if (String(r.userId) !== String(userId) && String(r.requesterId || '') !== String(userId)) return false;
      var kind = r.requestKind || r.request_kind || '';
      if (kind !== 'provide') return false;
      var st = String(r.status || 'pending');
      return st !== 'cancelled' && st !== 'deleted' && st !== 'expired' && st !== 'completed';
    });
    provides.sort(function (a, b) {
      return String(a.createdAt || a.id).localeCompare(String(b.createdAt || b.id));
    });
    provides.forEach(function (req) {
      // skip expired by dateEnd if present
      var svc = serviceLabel(req.service);
      var city = requestCity(req);
      var farmers = countActiveFarmersNear(req);
      cards.push({
        kind: 'provider-listing',
        requestId: req.id,
        title: 'یک درخواست برای ' + svc + ' در مزارع ' + city + ' ثبت کرده‌اید.',
        sub: (function () {
          var nd = farmers;
          try { if (typeof global.toPersianDigits === 'function') nd = global.toPersianDigits(String(farmers)); } catch (e) {}
          if (farmers <= 0) return 'هنوز کشاورز فعالی در منطقه شما پیدا نشد. کمی صبر کنید.';
          return nd + ' کشاورز فعال در منطقه فعالیت شما پیدا شد.';
        })(),
        action: 'request'
      });
    });
    return cards;
  }

  function countActiveProvidersNear(needReq) {
    var svc = needReq && needReq.service;
    var closed = { cancelled:1, deleted:1, expired:1, completed:1, closed:1, fulfilled:1 };
    var seen = {};
    (qdb().requests || []).forEach(function (r) {
      if (!r) return;
      var kind = r.requestKind || r.request_kind || 'need';
      if (kind !== 'provide') return;
      if (svc && r.service && r.service !== svc) return;
      if (closed[String(r.status || '')]) return;
      var owner = String(r.userId || r.requesterId || r.requester_id || r.id);
      // exclude self
      var me = String(needReq.userId || needReq.requesterId || '');
      if (me && owner === me) return;
      seen[owner] = 1;
    });
    // also count top/active providers from deals as provider (same service)
    (qdb().deals || []).forEach(function (d) {
      if (!d || d.status === 'cancelled') return;
      if (svc && d.service && d.service !== svc) return;
      var pid = String(d.providerId || '');
      if (!pid) return;
      var me = String(needReq.userId || needReq.requesterId || '');
      if (me && pid === me) return;
      seen[pid] = 1;
    });
    return Object.keys(seen).length;
  }

  function countActiveFarmersNear(provideReq) {
    var svc = provideReq.service;
    var closed = { cancelled:1, deleted:1, expired:1, completed:1, closed:1, fulfilled:1, accepted:1 };
    var seenUsers = {};
    (qdb().requests || []).forEach(function (r) {
      var kind = r.requestKind || r.request_kind || 'need';
      if (kind === 'provide') return;
      if (svc && r.service && r.service !== svc) return;
      if (String(r.userId || r.requesterId) === String(provideReq.userId || provideReq.requesterId)) return;
      if (closed[String(r.status || '')]) return;
      // still open = no active deal
      var rid = r.id;
      var hasActive = (qdb().deals || []).some(function (d) {
        return String(d.requestId) === String(rid) && d.status !== 'cancelled' && d.status !== 'completed';
      });
      if (hasActive) return;
      var uid = String(r.userId || r.requesterId || rid);
      seenUsers[uid] = 1;
    });
    return Object.keys(seenUsers).length;
  }

  function buildCardsForUser(user) {
    if (!user || !user.id) return [];
    var farmer = farmerCards(user.id);
    var provider = providerCards(user.id);
    // Interleave: farmer cards then provider (or by role preference)
    return farmer.concat(provider);
  }

  function renderCardHtml(card) {
    var hint = card.hint
      ? '<div class="home-flow-hint">' + escapeHtml(card.hint) + '</div>'
      : '';
    return '<button type="button" class="home-flow-card" data-action="' + escapeHtml(card.action || '') + '"'
      + (card.dealId ? ' data-deal-id="' + escapeHtml(String(card.dealId)) + '"' : '')
      + (card.requestId ? ' data-request-id="' + escapeHtml(String(card.requestId)) + '"' : '')
      + '>'
      + '<div class="home-flow-title">' + escapeHtml(card.title) + '</div>'
      + '<div class="home-flow-sub">' + escapeHtml(card.sub || '') + '</div>'
      + hint
      + '</button>';
  }

  function renderHomeFlowSection(user) {
    var cards = buildCardsForUser(user);
    var body;
    if (!cards.length) {
      body = '<div class="home-flow-empty">'
        + '<p class="home-flow-empty-text">هنوز درخواستی ثبت نکرده‌اید. وقتی اولین درخواست‌تان را بزنید، وضعیتش همین‌جا دیده می‌شود.</p>'
        + '<button type="button" class="btn btn-brand home-flow-cta" onclick="if(typeof onMobilePlusClick===\'function\')onMobilePlusClick()">ثبت درخواست</button>'
        + '</div>';
    } else {
      body = '<div class="home-flow-scroller">' + cards.map(renderCardHtml).join('') + '</div>';
    }
    return '<section class="home-flow-section" aria-label="درخواست در جریان">'
      + '<h2 class="home-flow-heading">درخواست در جریان</h2>'
      + body
      + '</section>';
  }

  function onHomeFlowCardClick(ev) {
    var btn = ev.target && ev.target.closest ? ev.target.closest('.home-flow-card') : null;
    if (!btn) return;
    var action = btn.getAttribute('data-action');
    var dealId = btn.getAttribute('data-deal-id');
    var requestId = btn.getAttribute('data-request-id');
    if (action === 'pay' && dealId) {
      if (typeof global.openPaymentOptions === 'function') global.openPaymentOptions(dealId);
      else if (typeof global.payDeal === 'function') global.payDeal(dealId);
      return;
    }
    if (action === 'review' && dealId) {
      if (typeof global.openDealReport === 'function') global.openDealReport(dealId);
      return;
    }
    if (action === 'deal' && dealId) {
      if (typeof global.setMobileOrdersSubTab === 'function') global.setMobileOrdersSubTab('deals');
      if (typeof global.setMobileTab === 'function') global.setMobileTab('proposals');
      setTimeout(function () {
        var card = document.querySelector('[data-deal-id="' + dealId + '"]');
        if (card) {
          card.scrollIntoView({ behavior: 'smooth', block: 'center' });
          card.classList.add('kelo-card-highlight');
          setTimeout(function () { card.classList.remove('kelo-card-highlight'); }, 1800);
        }
      }, 280);
      return;
    }
    if (action === 'request' && requestId) {
      try {
        if (typeof global.openRequestOffersMap === 'function') {
          global.openRequestOffersMap(requestId);
        } else if (typeof global.setMobileTab === 'function') {
          global.setMobileTab('proposals');
        }
      } catch (e) {}
    }
  }

  function bindHomeFlowClicks(root) {
    var el = root || document.querySelector('.home-flow-section');
    if (!el) return;
    el.addEventListener('click', onHomeFlowCardClick);
  }


  function getWalletBalance(user) {
    if (!user) return 0;
    var n = Number(user.walletBalance != null ? user.walletBalance : user.balance);
    return isNaN(n) ? 0 : n;
  }

  function renderHomeWalletBar(user) {
    var bal = getWalletBalance(user);
    var balText = (typeof global.fmtNum === 'function' ? global.fmtNum(bal) : String(bal)) + ' تومان';
    return '<section class="home-wallet-bar" role="button" tabindex="0" onclick="if(typeof openHomeWallet===\'function\')openHomeWallet()">'
      + '<span class="home-wallet-icon" aria-hidden="true">'
      + '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">'
      + '<path d="M3.5 8.5h14.5a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5.5a2 2 0 0 1-2-2v-9z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>'
      + '<path d="M3.5 8.5V7a2 2 0 0 1 2-2h11" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>'
      + '<circle cx="16.2" cy="13.5" r="1.2" fill="currentColor"/>'
      + '</svg></span>'
      + '<span class="home-wallet-label">کیف پول</span>'
      + '<span class="home-wallet-balance">' + escapeHtml(balText) + '</span>'
      + '<span class="home-wallet-chevron" aria-hidden="true">'
      + '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M14 6l-6 6 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      + '</span>'
      + '</section>';
  }

  function openHomeWallet() {
    if (typeof global.showToast === 'function') {
      global.showToast('کیف پول به‌زودی فعال می‌شود.', 'success');
    } else {
      alert('کیف پول به‌زودی فعال می‌شود.');
    }
  }

  global.renderHomeWalletBar = renderHomeWalletBar;
  global.openHomeWallet = openHomeWallet;


  var TOP_MIN_REVIEWS = 1;

  function serviceNameOf(code) {
    try {
      if (global.SERVICE_DEFS && global.SERVICE_DEFS[code]) return global.SERVICE_DEFS[code].name;
    } catch (e) {}
    return code || 'خدمت';
  }

  function fetchTopProviders(opts) {
    opts = opts || {};
    var svc = (global.KeloService && global.KeloService.providers) || global.KeloProviderService;
    if (!svc || typeof svc.getTopProviders !== 'function') {
      return Promise.resolve({ ok: true, data: { providers: [] } });
    }
    var user = global.currentUser;
    return Promise.resolve(svc.getTopProviders({
      minReviews: opts.minReviews || TOP_MIN_REVIEWS,
      limit: opts.limit || 12,
      service: opts.service || null,
      userId: user && user.id
    }));
  }

  function formatProviderRating(rating, count) {
    if (rating == null || !(Number(count) > 0)) return '';
    var avg = Number(rating).toFixed(1);
    var cnt = String(Math.floor(Number(count) || 0));
    if (typeof global.toPersianDigits === 'function') {
      avg = global.toPersianDigits(avg);
      cnt = global.toPersianDigits(cnt);
    }
    return avg + ' (' + cnt + '+)';
  }

  function normalizeLocationLabel(v) {
    if (v == null || v === '') return '';
    if (typeof v === 'string') return v;
    if (typeof v === 'object') {
      if (v.label) return String(v.label);
      if (v.city) return String(v.city) + (v.province ? '، ' + v.province : '');
      if (v.name) return String(v.name);
      if (Array.isArray(v)) {
        try {
          if (typeof global.formatActivityArea === 'function') {
            var fa = global.formatActivityArea(v);
            if (fa && fa !== '—') return fa;
          }
        } catch (e) {}
        return v.map(normalizeLocationLabel).filter(Boolean).join('، ');
      }
    }
    return '';
  }

  function renderTopProviderCard(p) {
    var ratingStr = formatProviderRating(p.rating, p.reviewCount);
    var ratingHtml = ratingStr
      ? ('<span class="kelo-rating-badge home-top-rating-badge">' + escapeHtml(ratingStr) + '</span>')
      : '';

    // Prefer the real provide-request object (same source as «کارهای من»)
    var req = null;
    if (p.requestId) {
      try {
        var db = qdb();
        req = (db.requests || []).find(function (r) { return String(r.id) === String(p.requestId); }) || null;
      } catch (e) {}
    }
    if (!req) {
      var data = p.requestData || {};
      var area = p.activityArea || data.activityArea || null;
      var city = normalizeLocationLabel(p.location) || normalizeLocationLabel(area);
      req = {
        id: p.requestId || null,
        service: p.service || '',
        requestKind: 'provide',
        data: {
          machineType: p.machineType || data.machineType || '',
          price: p.unitPrice != null ? p.unitPrice : data.price,
          priceUnit: p.priceUnit || data.priceUnit || '',
          dateStart: p.dateStart || data.dateStart || null,
          dateEnd: p.dateEnd || data.dateEnd || null,
          activityArea: area,
          city: city || undefined,
          serviceLocation: city ? { label: city } : undefined,
          serviceLocationLabel: city || ''
        }
      };
    } else {
      // clone-ish so we don't mutate mirror
      req = {
        id: req.id,
        service: req.service,
        requestKind: 'provide',
        data: Object.assign({}, req.data || {}, {
          machineType: (req.data && req.data.machineType) || p.machineType || '',
          price: (req.data && req.data.price) != null ? req.data.price : p.unitPrice,
          priceUnit: (req.data && req.data.priceUnit) || p.priceUnit || '',
          dateStart: (req.data && req.data.dateStart) || p.dateStart || null,
          dateEnd: (req.data && req.data.dateEnd) || p.dateEnd || null
        })
      };
    }

    var html;
    if (typeof global.renderKeloRequestCard === 'function') {
      html = global.renderKeloRequestCard(req, {
        historyChip: ratingHtml,
        actions: ''
      });
    } else {
      html = '<div class="mobile-activity-card kelo-service-card">' + escapeHtml(serviceNameOf(p.service)) + '</div>';
    }
    // same visual card; no navigation — strip interactive role
    return html
      .replace(
        'class="mobile-activity-card kelo-service-card"',
        'class="mobile-activity-card kelo-service-card home-top-provider-card" data-provider-id="' + escapeHtml(String(p.providerId || '')) + '"'
      );
  }

  function renderHomeTopProvidersSectionSync(providers) {
    var body;
    if (!providers || !providers.length) {
      body = '<div class="home-top-empty">'
        + '<p>هنوز ماشین‌دار امتیازدار در منطقه ثبت نشده. به‌محض ثبت اولین امتیازها، پیشنهادها اینجا دیده می‌شوند.</p>'
        + '</div>';
    } else {
      body = '<div class="home-top-scroller">' + providers.map(renderTopProviderCard).join('') + '</div>';
    }
    return '<section class="home-top-section" aria-label="ماشین‌داران برتر">'
      + '<h2 class="home-flow-heading">ماشین‌داران برتر</h2>'
      + body
      + '</section>';
  }

  /** Async fill after home paint */
  function loadAndPaintHomeTopProviders(rootEl) {
    var mount = rootEl && rootEl.querySelector ? rootEl.querySelector('#homeTopProvidersMount') : document.getElementById('homeTopProvidersMount');
    if (!mount) return;
    fetchTopProviders({}).then(function (res) {
      var list = (res && res.ok && res.data && res.data.providers) ? res.data.providers : [];
      if (!list.length && res && res.providers) list = res.providers;
      // Result.ok shape
      if (res && res.data && Array.isArray(res.data.providers)) list = res.data.providers;
      if (res && Array.isArray(res.providers)) list = res.providers;
      // Adapter returns Result
      if (res && res.ok && res.data) list = res.data.providers || [];
      mount.innerHTML = renderHomeTopProvidersSectionSync(list || []);
      /* top provider cards are display-only — no click action */
    }).catch(function () {
      mount.innerHTML = renderHomeTopProvidersSectionSync([]);
    });
  }

  function renderWizardTopProvidersHtml(service, providers) {
    return ''; /* removed: نزدیک شوید block */
    if (!providers || !providers.length) return '';
    var cards = providers.slice(0, 6).map(function (p) {
      var stars = formatProviderRating(p.rating, p.reviewCount);
      return '<button type="button" class="wizard-top-chip" data-provider-id="' + escapeHtml(String(p.providerId || '')) + '">'
        + '<strong>' + escapeHtml(p.provider || 'ارائه‌دهنده') + '</strong>'
        + '<span>' + escapeHtml(stars) + (p.machineType ? ' · ' + escapeHtml(p.machineType) : '') + '</span>'
        + '</button>';
    }).join('');
    return '<div class="wizard-top-block" id="wizardTopProviders">'
      + '<div class="wizard-top-title">یا مستقیم به یکی از این‌ها نزدیک شوید</div>'
      + '<p class="wizard-top-hint">بعد از ثبت درخواست می‌توانید برایشان پیشنهاد بفرستید.</p>'
      + '<div class="wizard-top-list">' + cards + '</div></div>';
  }

  function loadWizardTopProviders(service) {
    var host = document.getElementById('wizardTopProvidersMount');
    if (host) host.innerHTML = '';
  }

  global.renderHomeTopProvidersSectionSync = renderHomeTopProvidersSectionSync;
  global.loadAndPaintHomeTopProviders = loadAndPaintHomeTopProviders;
  global.loadWizardTopProviders = loadWizardTopProviders;
  global.fetchTopProviders = fetchTopProviders;

  function refreshHomeFlow() {
    try {
      if (typeof global.renderMobileHome === 'function' && global.currentUser) {
        global.renderMobileHome();
      }
    } catch (e) {}
  }
  global.refreshHomeFlow = refreshHomeFlow;
  global.renderHomeFlowSection = renderHomeFlowSection;
  global.bindHomeFlowClicks = bindHomeFlowClicks;
  global.buildHomeFlowCards = buildCardsForUser;
})(typeof window !== 'undefined' ? window : global);
