// Shared phone / national-id helpers.
//
// Previously duplicated in two places: server/app.js (the code that is
// actually used) and server/auth.js (a leftover, never-wired-up session
// system built around a `sessions` table that does not exist in the current
// schema — the real session store is express-session + connect-pg-simple,
// see server/app.js). server/auth.js has been removed; this file is the one
// place normalization now lives, used by both server/app.js and
// server/create-admin.js.

function normalizeDigits(value) {
  return String(value || '')
    .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

function normalizePhone(value) {
  let p = normalizeDigits(value).replace(/\s+/g, '').trim();
  if (p.startsWith('+98')) p = '0' + p.slice(3);
  else if (p.startsWith('98')) p = '0' + p.slice(2);
  return p;
}

function normalizeNationalId(value) {
  return normalizeDigits(value).replace(/\D/g, '').trim();
}

function validPhone(phone) { return /^09\d{9}$/.test(phone); }
function validNationalId(nid) { return /^\d{10}$/.test(nid); }

module.exports = { normalizePhone, normalizeNationalId, validPhone, validNationalId };
