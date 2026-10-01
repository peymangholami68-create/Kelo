/**
 * KELO Domain — Booking rules (Phase 9)
 */
(function (global) {
  'use strict';

  var pricing = function () {
    return (global.KeloDomain && global.KeloDomain.pricing) || {};
  };

  function rangesOverlap(aStart, aEnd, bStart, bEnd) {
    if (!aStart || !aEnd || !bStart || !bEnd) return false;
    return aStart.getTime() <= bEnd.getTime() && bStart.getTime() <= aEnd.getTime();
  }

  function getRequestDateRange(request, parseDate) {
    parseDate = parseDate || (pricing().parseIsoishDate);
    var start = parseDate ? parseDate(request && request.data && (request.data.dateStart || request.data.date)) : null;
    var end = parseDate
      ? parseDate(request && request.data && (request.data.dateEnd || request.data.dateStart || request.data.date))
      : null;
    return { start: start, end: end || start };
  }

  /**
   * @param {Array} bookings
   */
  function hasProviderBookingConflict(bookings, providerId, machineId, start, end, parseDate) {
    if (!start || !end) return false;
    parseDate = parseDate || (pricing().parseIsoishDate);
    bookings = bookings || [];
    return bookings.some(function (b) {
      if (b.status !== 'confirmed' && b.status !== 'active') return false;
      if (String(b.providerId) !== String(providerId)) return false;
      if (machineId && String(b.machineId) !== String(machineId)) return false;
      var bs = parseDate(b.start || b.date);
      var be = parseDate(b.end || b.start || b.date);
      return rangesOverlap(start, end, bs, be);
    });
  }

  global.KeloDomain = global.KeloDomain || {};
  global.KeloDomain.booking = {
    rangesOverlap: rangesOverlap,
    getRequestDateRange: getRequestDateRange,
    hasProviderBookingConflict: hasProviderBookingConflict
  };
})(typeof window !== 'undefined' ? window : globalThis);
