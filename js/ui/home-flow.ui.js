/**
 * Home "درخواست در جریان" cards — farmer + provider flow on mobile home.
 */
(function (global) {
  'use strict';

  var DAY_MS = 24 * 60 * 60 * 1000;

  function qdb() {
    if (global.KeloQueryService && typeof global.KeloQueryService.qdb === 'function') {
      return global.KeloQueryService.qdb();
    }
    return global.db || { requests: [], deals: [], offers: [], users: [], proposals: [] };
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
    var list = db.offers || db.proposals || [];
    return list.filter(function (o) {
      return String(o.requestId) === String(reqId) && o.status !== 'cancelled' && o.status !== 'rejected';
    });
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
      try { return !!global.hasUserReviewedDeal(dealId); } catch (e) {}
    }
    var reviews = qdb().reviews || [];
    return reviews.some(function (r) {
      return String(r.dealId) === String(dealId) &&
        (String(r.authorId) === String(userId) || String(r.reviewerId) === String(userId));
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
    var requests = (qdb().requests || []).filter(function (r) {
      return String(r.userId) === String(userId) && r.requestKind !== 'provide';
    });
    // oldest first
    requests.sort(function (a, b) {
      return String(a.createdAt || a.id).localeCompare(String(b.createdAt || b.id));
    });

    requests.forEach(function (req) {
      if (req.status === 'cancelled' || req.status === 'deleted') return;
      var deal = activeDealForRequest(req.id);
      var svc = serviceLabel(req.service);
      var needPhrase = 'نیاز به ' + svc;

      if (deal && deal.status === 'completed') {
        if (deal.paymentStatus === 'paid') {
          if (isExpiredCompletedCard(deal)) return;
          if (hasUserReviewed(deal.id, userId)) {
            // hide soon after review or keep until day - hide if reviewed
            if (isExpiredCompletedCard(deal)) return;
            // show until 1 day from complete even if reviewed
          }
          var providerName = userName(deal.providerId);
          cards.push({
            kind: 'farmer-done-paid',
            dealId: deal.id,
            requestId: req.id,
            title: svc + ' مزرعه‌تان به پایان رسید.',
            sub: 'چطور بود؟ به ' + providerName + ' امتیاز بدید',
            action: 'review'
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
          hint: 'با پرداخت آنلاین، خیالتان از ثبت پرداخت راحت‌تره.',
          action: 'pay'
        });
        return;
      }

      // open request without active deal
      if (req.status === 'closed' || req.status === 'fulfilled') return;
      var nOffers = offersForRequest(req.id).length;
      var sub = nOffers > 0
        ? (fmtMoney(nOffers).replace(/٬/g, '') === String(nOffers) ? nOffers : nOffers) + ' پیشنهاد دریافت کرده‌اید'
        : 'هنوز پیشنهادی دریافت نکرده‌اید، کمی صبر کنید';
      // fix number display without money fmt
      if (nOffers > 0) sub = nOffers + ' پیشنهاد دریافت کرده‌اید';
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
        if (hasUserReviewed(deal.id, userId) && isExpiredCompletedCard(deal)) return;
        var farmerName = userName(deal.userId);
        dealCards.push({
          kind: 'provider-done',
          dealId: deal.id,
          title: 'کارتان تمام شد؛ حالا نوبت امتیاز است.',
          sub: 'ثبت امتیاز ' + farmerName,
          action: 'review'
        });
        return;
      }
      var total = deal.total != null ? deal.total : deal.price;
      dealCards.push({
        kind: 'provider-agreed',
        dealId: deal.id,
        title: 'برای ارائه‌ی ' + svc + ' در ' + city + ' توافق کردید.',
        sub: 'مبلغ کل: ' + fmtMoney(total) + ' تومان',
        hint: 'پرداخت آنلاین سریع‌تر به حساب‌تان می‌رسد؛ کارمزد Kelo همین‌جا از مبلغ کم می‌شود.',
        action: 'pay'
      });
    });

    if (dealCards.length) return dealCards;

    // No active deals → listing / provide requests
    var provides = (qdb().requests || []).filter(function (r) {
      return String(r.userId) === String(userId) && r.requestKind === 'provide' &&
        r.status !== 'cancelled' && r.status !== 'deleted' && r.status !== 'expired';
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
        sub: farmers + ' کشاورز فعال در منطقه‌ی فعالیت شما',
        action: 'request'
      });
    });
    return cards;
  }

  function countActiveFarmersNear(provideReq) {
    var svc = provideReq.service;
    var n = (qdb().requests || []).filter(function (r) {
      return r.requestKind === 'need' && r.service === svc &&
        r.status !== 'cancelled' && String(r.userId) !== String(provideReq.userId);
    }).length;
    return n;
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
      if (typeof global.openDealFromSchedule === 'function') global.openDealFromSchedule(dealId);
      else if (typeof global.payDeal === 'function') global.payDeal(dealId);
      return;
    }
    if (action === 'review' && dealId) {
      if (typeof global.openDealReport === 'function') global.openDealReport(dealId);
      return;
    }
    if (action === 'request' && requestId) {
      try {
        if (typeof global.setMobileTab === 'function') {
          // open my requests / offers
          if (typeof global.openRequestOffersMap === 'function') {
            global.openRequestOffersMap(requestId);
          } else {
            global.setMobileTab('proposals');
          }
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

  global.renderHomeFlowSection = renderHomeFlowSection;
  global.bindHomeFlowClicks = bindHomeFlowClicks;
  global.buildHomeFlowCards = buildCardsForUser;
})(typeof window !== 'undefined' ? window : global);
