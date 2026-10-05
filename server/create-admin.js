/**
 * Create or promote an admin user against the current auth schema:
 * users (phone, national_id_*), profiles, user_roles.
 *
 * Env:
 *   KELO_ADMIN_PHONE
 *   KELO_ADMIN_NATIONAL_ID
 *   KELO_ADMIN_NAME (optional)
 *   NATIONAL_ID_ENCRYPTION_KEY (same as API server)
 *   SESSION_SECRET (same as API server — used for national_id_lookup HMAC)
 */
require('dotenv').config();
const crypto = require('crypto');
const { query, pool } = require('./db');
const { normalizePhone, normalizeNationalId, validPhone, validNationalId } = require('./lib/normalize');

const SESSION_SECRET = process.env.SESSION_SECRET || 'development-only-change-me';
const NATIONAL_ID_ENCRYPTION_KEY = process.env.NATIONAL_ID_ENCRYPTION_KEY || 'development-only-change-me-encryption';

function getEncryptionKey() {
  return crypto.createHash('sha256').update(NATIONAL_ID_ENCRYPTION_KEY, 'utf8').digest();
}

function nationalIdLookup(nationalId) {
  return crypto.createHmac('sha256', SESSION_SECRET).update(nationalId, 'utf8').digest('hex');
}

function hashNationalId(nationalId) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(nationalId, salt, 32, { N: 16384, r: 8, p: 1 });
  return `${salt}:${derived.toString('hex')}`;
}

function verifyNationalId(nationalId, encoded) {
  const parts = String(encoded || '').split(':');
  if (parts.length !== 2) return false;
  const salt = parts[0];
  const stored = Buffer.from(parts[1], 'hex');
  const derived = crypto.scryptSync(nationalId, salt, stored.length, { N: 16384, r: 8, p: 1 });
  return stored.length === derived.length && crypto.timingSafeEqual(stored, derived);
}

function encryptNationalId(nationalId) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(nationalId, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext].map((x) => x.toString('hex')).join('.');
}

async function main() {
  const phone = normalizePhone(process.env.KELO_ADMIN_PHONE);
  const nationalId = normalizeNationalId(process.env.KELO_ADMIN_NATIONAL_ID);
  const name = String(process.env.KELO_ADMIN_NAME || 'مدیر KELO').trim();
  if (!validPhone(phone)) throw new Error('KELO_ADMIN_PHONE is missing/invalid.');
  if (!validNationalId(nationalId)) throw new Error('KELO_ADMIN_NATIONAL_ID is missing/invalid.');

  const existing = await query(
    `SELECT id, national_id_verifier FROM users WHERE phone = $1 LIMIT 1`,
    [phone]
  );

  let userId;
  if (existing.rows[0]) {
    userId = existing.rows[0].id;
    if (!verifyNationalId(nationalId, existing.rows[0].national_id_verifier)) {
      throw new Error('Phone exists but national id does not match stored verifier. Refusing to overwrite.');
    }
  } else {
    const lookup = nationalIdLookup(nationalId);
    const ins = await query(
      `INSERT INTO users (phone, national_id_lookup, national_id_verifier, national_id_ciphertext)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [phone, lookup, hashNationalId(nationalId), encryptNationalId(nationalId)]
    );
    userId = ins.rows[0].id;
  }

  await query(
    `INSERT INTO profiles (user_id, full_name, profile_completed)
     VALUES ($1, $2, true)
     ON CONFLICT (user_id) DO UPDATE SET full_name = EXCLUDED.full_name, profile_completed = true`,
    [userId, name]
  );
  await query(
    `INSERT INTO user_roles (user_id, role) VALUES ($1, 'admin') ON CONFLICT DO NOTHING`,
    [userId]
  );

  console.log(`[admin] ready: ${userId} / ${phone}`);
  await pool.end();
}

main().catch(async (error) => {
  console.error(error);
  try { await pool.end(); } catch (_) {}
  process.exit(1);
});
