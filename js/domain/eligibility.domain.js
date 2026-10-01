/**
 * KELO Domain — Provider eligibility (Phase 9b)
 *
 * Pure rules over data snapshots. Geo helpers are injected (UI-owned).
 */
(function (global) {
  'use strict';

  function listingMatchesRequest(listing, request, geo) {
    if (!listing || !request || listing.service !== request.service) return false;
    var area = listing.data && listing.data.activityArea;
    if (!Array.isArray(area) || !area.length) return true;

    var reqLoc = request.data && request.data.serviceLocation;
    var reqProvince = '';
    var reqCity = '';
    if (reqLoc && typeof reqLoc.lat === 'number' && typeof reqLoc.lng === 'number' && geo) {
      if (typeof geo.nearestCityFromCoords === 'function') {
        reqCity = geo.nearestCityFromCoords(reqLoc.lat, reqLoc.lng) || '';
      }
      if (typeof geo.provinceFromCity === 'function') {
        reqProvince = geo.provinceFromCity(reqCity) || '';
      }
    }
    if (!reqProvince && request.data && Array.isArray(request.data.activityArea) && request.data.activityArea.length) {
      var firstRow = request.data.activityArea[0];
      reqProvince = firstRow.province || '';
      reqCity = (firstRow.all || !(firstRow.cities && firstRow.cities.length)) ? '' : (firstRow.cities[0] || '');
    }
    if (!reqProvince) {
      reqProvince = (request.data && request.data.province) || '';
      reqCity = (request.data && request.data.city) || '';
    }
    if (!reqProvince) return true;

    var provinceRow = area.find(function (x) { return x.province === reqProvince; });
    if (!provinceRow) return false;
    if (provinceRow.all || !Array.isArray(provinceRow.cities) || provinceRow.cities.length === 0) return true;
    if (!reqCity) return true;
    return provinceRow.cities.indexOf(reqCity) >= 0;
  }

  function listingAvailableForRequest(listing, start, end, parseDate) {
    if (!start || !end) return true;
    parseDate = parseDate || function () { return null; };
    var ls = parseDate(listing.data && listing.data.dateStart);
    var le = parseDate(listing.data && (listing.data.dateEnd || listing.data.dateStart));
    if (ls && start < ls) return false;
    if (le && end > le) return false;
    return true;
  }

  function getProviderIdentityFromListing(listing, users, formatActivityArea) {
    users = users || [];
    var ownerUser = users.find(function (u) { return String(u.id) === String(listing.userId); });
    var location = '—';
    if (typeof formatActivityArea === 'function') {
      location = formatActivityArea(listing.data && listing.data.activityArea) || '—';
    }
    return {
      providerId: listing.userId,
      provider: listing.providerName || (ownerUser && ownerUser.name) || 'ارائه‌دهنده',
      machineId: listing.machineId || listing.id,
      listingId: listing.id,
      service: listing.service,
      unitPrice: Number(listing.data && listing.data.price) || 0,
      priceUnit: (listing.data && listing.data.priceUnit) || '',
      rating: Number(listing.rating) || 4.5,
      location: location,
      data: listing.data || {}
    };
  }

  /**
   * @param {object} ctx
   * @param {object} ctx.request
   * @param {Array} ctx.listings
   * @param {Array} ctx.machines
   * @param {Array} ctx.users
   * @param {Array} ctx.bookings
   * @param {Function} [ctx.parseDate]
   * @param {object} [ctx.geo] nearestCityFromCoords, provinceFromCity, formatActivityArea
   */
  function getEligibleProviders(ctx) {
    ctx = ctx || {};
    var request = ctx.request;
    if (!request) return [];

    var Booking = (global.KeloDomain && global.KeloDomain.booking) || {};
    var parseDate = ctx.parseDate ||
      (global.KeloDomain && global.KeloDomain.pricing && global.KeloDomain.pricing.parseIsoishDate) ||
      function () { return null; };

    var range = Booking.getRequestDateRange
      ? Booking.getRequestDateRange(request, parseDate)
      : { start: null, end: null };
    var start = range.start;
    var end = range.end;

    var listings = ctx.listings || [];
    var machines = ctx.machines || [];
    var users = ctx.users || [];
    var bookings = ctx.bookings || [];
    var geo = ctx.geo || {};

    var seen = {};
    var result = [];

    listings
      .filter(function (l) {
        return l.status === 'active' &&
          String(l.userId) !== String(request.userId) &&
          l.service === request.service;
      })
      .forEach(function (l) {
        if (!listingMatchesRequest(l, request, geo)) return;
        if (!listingAvailableForRequest(l, start, end, parseDate)) return;
        if (start && Booking.hasProviderBookingConflict &&
            Booking.hasProviderBookingConflict(bookings, l.userId, l.id, start, end, parseDate)) {
          return;
        }
        var p = getProviderIdentityFromListing(l, users, geo.formatActivityArea);
        var key = p.providerId + '|' + (p.listingId || '');
        if (seen[key]) return;
        seen[key] = true;
        result.push(p);
      });

    machines
      .filter(function (m) {
        return m.services && m.services[request.service] !== undefined;
      })
      .forEach(function (m) {
        var ownerUser = users.find(function (u) { return u.name === m.owner; });
        var providerId = (ownerUser && ownerUser.id) || ('machine-owner:' + m.owner);
        if (String(providerId) === String(request.userId)) return;
        var machineKey = 'machine:' + m.id;
        var key = providerId + '|' + machineKey;
        if (seen[key]) return;
        if (start && Booking.hasProviderBookingConflict &&
            Booking.hasProviderBookingConflict(bookings, providerId, machineKey, start, end, parseDate)) {
          return;
        }
        seen[key] = true;
        result.push({
          providerId: providerId,
          provider: m.owner || (ownerUser && ownerUser.name) || 'ارائه‌دهنده',
          machineId: m.id,
          listingId: null,
          service: request.service,
          unitPrice: Number(m.services[request.service]) || 0,
          priceUnit: 'تومان / هکتار',
          rating: Number(m.rating) || 4.5,
          location: m.location || '—',
          data: {
            price: Number(m.services[request.service]) || 0,
            priceUnit: 'تومان / هکتار'
          }
        });
      });

    return result;
  }

  global.KeloDomain = global.KeloDomain || {};
  global.KeloDomain.eligibility = {
    listingMatchesRequest: listingMatchesRequest,
    listingAvailableForRequest: listingAvailableForRequest,
    getProviderIdentityFromListing: getProviderIdentityFromListing,
    getEligibleProviders: getEligibleProviders
  };
})(typeof window !== 'undefined' ? window : globalThis);
