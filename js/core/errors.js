/**
 * KELO — Shared error codes (Phase 0)
 *
 * کدهای مشترک برای Local و Server. Service این کدها را برمی‌گرداند
 * و UI فقط message را نمایش می‌دهد.
 */
(function (global) {
  'use strict';

  var CODES = {
    UNKNOWN: 'UNKNOWN',
    NETWORK: 'NETWORK',
    UNAUTHORIZED: 'UNAUTHORIZED',
    FORBIDDEN: 'FORBIDDEN',
    NOT_FOUND: 'NOT_FOUND',
    VALIDATION: 'VALIDATION',
    CONFLICT: 'CONFLICT',

    // Auth
    INVALID_PHONE: 'INVALID_PHONE',
    INVALID_NATIONAL_ID: 'INVALID_NATIONAL_ID',
    NATIONAL_ID_MISMATCH: 'NATIONAL_ID_MISMATCH',
    LOGIN_FAILED: 'LOGIN_FAILED',
    SESSION_EXPIRED: 'SESSION_EXPIRED',

    // Profile
    PROFILE_INCOMPLETE: 'PROFILE_INCOMPLETE',
    PROFILE_SAVE_FAILED: 'PROFILE_SAVE_FAILED',

    // Request
    REQUEST_NOT_FOUND: 'REQUEST_NOT_FOUND',
    REQUEST_NOT_OWNED: 'REQUEST_NOT_OWNED',
    REQUEST_INVALID_STATE: 'REQUEST_INVALID_STATE',

    // Proposal
    PROPOSAL_NOT_FOUND: 'PROPOSAL_NOT_FOUND',
    PROPOSAL_NOT_ALLOWED: 'PROPOSAL_NOT_ALLOWED',
    PROPOSAL_ALREADY_HANDLED: 'PROPOSAL_ALREADY_HANDLED',
    REVERSE_PROPOSAL_BLOCKED: 'REVERSE_PROPOSAL_BLOCKED',

    // Deal / Payment
    DEAL_NOT_FOUND: 'DEAL_NOT_FOUND',
    DEAL_INVALID_STATE: 'DEAL_INVALID_STATE',
    PAYMENT_FAILED: 'PAYMENT_FAILED',

    // Mode / infra
    SERVER_UNAVAILABLE: 'SERVER_UNAVAILABLE',
    NOT_IMPLEMENTED: 'NOT_IMPLEMENTED'
  };

  var DEFAULT_MESSAGES = {
    UNKNOWN: 'خطای ناشناخته رخ داد.',
    NETWORK: 'ارتباط با سرور برقرار نشد.',
    UNAUTHORIZED: 'برای ادامه وارد شوید.',
    FORBIDDEN: 'اجازه انجام این کار را ندارید.',
    NOT_FOUND: 'مورد درخواستی پیدا نشد.',
    VALIDATION: 'اطلاعات واردشده معتبر نیست.',
    CONFLICT: 'این عملیات با وضعیت فعلی تداخل دارد.',
    INVALID_PHONE: 'شماره تلفن همراه معتبر نیست.',
    INVALID_NATIONAL_ID: 'کد ملی باید ۱۰ رقم باشد.',
    NATIONAL_ID_MISMATCH: 'این شماره همراه قبلاً با کد ملی دیگری ثبت شده است.',
    LOGIN_FAILED: 'ورود انجام نشد.',
    SESSION_EXPIRED: 'نشست شما منقضی شده است. دوباره وارد شوید.',
    PROFILE_INCOMPLETE: 'ابتدا پروفایل خود را تکمیل کنید.',
    PROFILE_SAVE_FAILED: 'ذخیره پروفایل انجام نشد.',
    REQUEST_NOT_FOUND: 'درخواست پیدا نشد.',
    REQUEST_NOT_OWNED: 'این درخواست متعلق به شما نیست.',
    REQUEST_INVALID_STATE: 'وضعیت درخواست برای این عملیات مناسب نیست.',
    PROPOSAL_NOT_FOUND: 'پیشنهاد پیدا نشد.',
    PROPOSAL_NOT_ALLOWED: 'ارسال این پیشنهاد مجاز نیست.',
    PROPOSAL_ALREADY_HANDLED: 'این پیشنهاد قبلاً رسیدگی شده است.',
    REVERSE_PROPOSAL_BLOCKED: 'پیشنهاد معکوس روی همین درخواست مجاز نیست.',
    DEAL_NOT_FOUND: 'معامله پیدا نشد.',
    DEAL_INVALID_STATE: 'وضعیت معامله برای این عملیات مناسب نیست.',
    PAYMENT_FAILED: 'پرداخت انجام نشد.',
    SERVER_UNAVAILABLE: 'سرویس در دسترس نیست.',
    NOT_IMPLEMENTED: 'این قابلیت هنوز پیاده‌سازی نشده است.'
  };

  function messageFor(code, override) {
    if (override) return String(override);
    return DEFAULT_MESSAGES[code] || DEFAULT_MESSAGES.UNKNOWN;
  }

  global.KeloErrors = {
    CODES: CODES,
    DEFAULT_MESSAGES: DEFAULT_MESSAGES,
    messageFor: messageFor
  };
})(typeof window !== 'undefined' ? window : globalThis);
