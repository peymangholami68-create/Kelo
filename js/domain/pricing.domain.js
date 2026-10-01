/**
 * KELO Domain — Pricing (Phase 9)
 * Pure business rules. No UI. No Adapter.
 */
(function (global) {
  'use strict';

  function parseIsoishDate(value) {
    if (value instanceof Date && !isNaN(value.getTime())) return value;
    if (typeof value !== 'string') return null;
    var n = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}T/.test(n)) {
      var d = new Date(n);
      return isNaN(d.getTime()) ? null : d;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(n)) {
      var p = n.split('-');
      return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]), 12, 0, 0, 0);
    }
    return null;
  }

  /**
   * @param {object|null} request
   * @param {object|null} priceData listing/candidate data with price + priceUnit
   * @param {number} fallbackPrice
   */
  function calculateTotal(request, priceData, fallbackPrice) {
    var price = Number(priceData && priceData.price) || Number(fallbackPrice) || 0;
    var unit = String((priceData && priceData.priceUnit) || '');
    if (!request) return price;
    var reqData = request.data || {};

    if (unit.indexOf('هکتار') >= 0) {
      var area = Number(reqData.area) || Number(reqData.amount) || 0;
      return price * area;
    }
    if (unit.indexOf('تن') >= 0) {
      var amount = Number(reqData.amount) || Number(reqData.area) || 0;
      return price * amount;
    }
    if (unit.indexOf('روز') >= 0) {
      var start = parseIsoishDate(reqData.dateStart || reqData.date);
      var end = parseIsoishDate(reqData.dateEnd || reqData.dateStart || reqData.date);
      if (start && end) {
        var millisecondsPerDay = 24 * 60 * 60 * 1000;
        var days = Math.floor((end.getTime() - start.getTime()) / millisecondsPerDay) + 1;
        return price * Math.max(days, 1);
      }
      return price;
    }
    if (unit.indexOf('سرویس') >= 0) return price;
    return price;
  }

  global.KeloDomain = global.KeloDomain || {};
  global.KeloDomain.pricing = {
    calculateTotal: calculateTotal,
    parseIsoishDate: parseIsoishDate
  };
})(typeof window !== 'undefined' ? window : globalThis);
