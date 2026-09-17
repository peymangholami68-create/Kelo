const crypto = require('crypto');
const { query } = require('./db');

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'kelo_session';
const SESSION_DAYS = Math.max(1, Number(process.env.SESSION_DAYS || 30));
const COOKIE_SECURE = String(process.env.COOKIE_SECURE || (process.env.NODE_ENV === 'production')).toLowerCase() !== 'false';

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

function hashToken(token) {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

function parseCookies(header) {
  const out = {};
  String(header || '').split(';').forEach(part => {
    const index = part.indexOf('=');
    if (index < 0) return;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (!key) return;
    try { out[key] = decodeURIComponent(value); } catch (_) { out[key] = value; }
  });
  return out;
}

function appendCookie(res, token, maxAgeSeconds) {
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`
  ];
  if (COOKIE_SECURE) parts.push('Secure');
  res.append('Set-Cookie', parts.join('; '));
}

function clearCookie(res) {
  const parts = [
    `${COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT'
  ];
  if (COOKIE_SECURE) parts.push('Secure');
  res.append('Set-Cookie', parts.join('; '));
}

function sanitizeUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name || '',
    phone: row.phone,
    nationalId: row.national_id,
    profileCompleted: !!row.profile_completed,
    profile: row.profile || {},
    profileLocation: row.profile_location || null,
    systemRoles: Array.isArray(row.system_roles) ? row.system_roles : []
  };
}

async function getUserBySessionToken(token) {
  if (!token) return null;
  const tokenHash = hashToken(token);
  const result = await query(
    `select u.*
       from sessions s
       join users u on u.id = s.user_id
      where s.token_hash = $1
        and s.expires_at > now()
      limit 1`,
    [tokenHash]
  );
  if (!result.rows[0]) return null;
  await query('update sessions set last_seen_at = now() where token_hash = $1', [tokenHash]);
  return result.rows[0];
}

async function requireSession(req, res, next) {
  try {
    const cookies = parseCookies(req.headers.cookie);
    const user = await getUserBySessionToken(cookies[COOKIE_NAME]);
    if (!user) {
      clearCookie(res);
      return res.status(401).json({ ok: false, error: 'session_required' });
    }
    req.user = user;
    req.sessionToken = cookies[COOKIE_NAME];
    next();
  } catch (error) {
    next(error);
  }
}

async function createSession(user, req, res) {
  const token = crypto.randomBytes(32).toString('base64url');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await query(
    `insert into sessions (user_id, token_hash, expires_at, ip_address, user_agent)
     values ($1, $2, $3, $4, $5)`,
    [user.id, tokenHash, expiresAt, req.ip || null, req.get('user-agent') || null]
  );
  appendCookie(res, token, SESSION_DAYS * 24 * 60 * 60);
}

async function revokeSession(req, res) {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[COOKIE_NAME];
  if (token) await query('delete from sessions where token_hash = $1', [hashToken(token)]);
  clearCookie(res);
}

async function logAudit(actorId, action, entityType, entityId, metadata) {
  await query(
    `insert into audit_logs (actor_id, action, entity_type, entity_id, metadata)
     values ($1, $2, $3, $4, $5::jsonb)`,
    [actorId || null, action, entityType, entityId || null, JSON.stringify(metadata || {})]
  );
}

module.exports = {
  COOKIE_NAME,
  SESSION_DAYS,
  validPhone,
  validNationalId,
  normalizePhone,
  normalizeNationalId,
  sanitizeUser,
  requireSession,
  createSession,
  revokeSession,
  getUserBySessionToken,
  logAudit
};
