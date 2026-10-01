/**
 * KELO utils — formatting (Phase 10)
 */
(function (global) {
  'use strict';

  function fmtNum(n){ const num = Number(n) || 0; try { return new Intl.NumberFormat('fa-IR').format(num); } catch(e){ return String(num); } }
  global.fmtNum = fmtNum;

  function toPersianDigits(value){ return String(value??'').replace(/\d/g,d=>'۰۱۲۳۴۵۶۷۸۹'[Number(d)]); }
  global.toPersianDigits = toPersianDigits;

  function escapeHtml(value){ return String(value??'').replace(/[&<>'"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
  global.escapeHtml = escapeHtml;

  function normalizeDigits(value){ return String(value||"").replace(/[۰-۹]/g,d=>String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٠-٩]/g,d=>String("٠١٢٣٤٥٦٧٨٩".indexOf(d))); }
  global.normalizeDigits = normalizeDigits;

})(typeof window !== 'undefined' ? window : globalThis);
