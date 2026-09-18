const path = require('path');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const connectPgSimple = require('connect-pg-simple');
const { Pool } = require('pg');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT || 3000);
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PROD = NODE_ENV === 'production';
const SESSION_TTL_MS = Number(process.env.SESSION_TTL_MS || 30 * 24 * 60 * 60 * 1000);
const SESSION_SECRET = process.env.SESSION_SECRET;

if (!SESSION_SECRET && IS_PROD) {
  throw new Error('SESSION_SECRET is required in production.');
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is required.');
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  max: Number(process.env.DB_POOL_MAX || 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined
});

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', IS_PROD ? 1 : 0);
app.use(express.json({ limit: '256kb' }));

const PgStore = connectPgSimple(session);
app.use(session({
  name: 'kelo.sid',
  secret: SESSION_SECRET || 'development-only-change-me',
  store: new PgStore({
    pool,
    tableName: 'user_sessions',
    createTableIfMissing: true,
    pruneSessionInterval: 60 * 60
  }),
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: 'lax',
    maxAge: SESSION_TTL_MS,
    path: '/'
  }
}));

app.use(express.static(ROOT, { index: false, maxAge: IS_PROD ? '1h' : 0 }));

function normalizePhone(value) {
  let p = String(value || '').replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/\s+/g, '').trim();
  if (p.startsWith('+98')) p = '0' + p.slice(3);
  else if (p.startsWith('98')) p = '0' + p.slice(2);
  return p;
}

function normalizeNationalId(value) {
  return String(value || '').replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/\D/g, '').trim();
}

function assertLoginInput(phone, nationalId) {
  if (!/^09\d{9}$/.test(phone)) {
    const err = new Error('شماره تلفن همراه معتبر نیست.'); err.status = 400; throw err;
  }
  if (!/^\d{10}$/.test(nationalId)) {
    const err = new Error('کد ملی باید ۱۰ رقم باشد.'); err.status = 400; throw err;
  }
}

function getEncryptionKey() {
  const raw = process.env.NATIONAL_ID_ENCRYPTION_KEY || SESSION_SECRET || 'development-only-change-me';
  return crypto.createHash('sha256').update(raw, 'utf8').digest();
}

function nationalIdLookup(nationalId) {
  const secret = SESSION_SECRET || 'development-only-change-me';
  return crypto.createHmac('sha256', secret).update(nationalId, 'utf8').digest('hex');
}

function hashNationalId(nationalId) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(nationalId, salt, 32, { N: 16384, r: 8, p: 1 });
  return `${salt}:${derived.toString('hex')}`;
}

function verifyNationalId(nationalId, encoded) {
  const parts = String(encoded || '').split(':');
  if (parts.length !== 2) return false;
  const salt = Buffer.from(parts[0], 'hex');
  const stored = Buffer.from(parts[1], 'hex');
  const derived = crypto.scryptSync(nationalId, salt, stored.length, { N: 16384, r: 8, p: 1 });
  return stored.length === derived.length && crypto.timingSafeEqual(stored, derived);
}

function encryptNationalId(nationalId) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(nationalId, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext].map(x => x.toString('hex')).join('.');
}

function decryptNationalId(payload) {
  if (!payload) return '';
  const [ivHex, tagHex, cipherHex] = String(payload).split('.');
  if (!ivHex || !tagHex || !cipherHex) return '';
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    return Buffer.concat([decipher.update(Buffer.from(cipherHex, 'hex')), decipher.final()]).toString('utf8');
  } catch (_) {
    return '';
  }
}

async function ensureBootstrapAdmin() {
  const bootstrapPhone = normalizePhone(process.env.BOOTSTRAP_ADMIN_PHONE || '');
  const bootstrapNationalId = normalizeNationalId(process.env.BOOTSTRAP_ADMIN_NATIONAL_ID || '');
  if (!bootstrapPhone || !bootstrapNationalId) return;
  assertLoginInput(bootstrapPhone, bootstrapNationalId);

  const existing = await pool.query(
    `SELECT u.id, u.phone, u.national_id_verifier
       FROM users u
      WHERE u.phone = $1`,
    [bootstrapPhone]
  );

  if (existing.rows[0]) {
    if (!verifyNationalId(bootstrapNationalId, existing.rows[0].national_id_verifier)) {
      throw new Error('BOOTSTRAP_ADMIN_PHONE exists but BOOTSTRAP_ADMIN_NATIONAL_ID does not match.');
    }
    await pool.query(
      `INSERT INTO user_roles (user_id, role) VALUES ($1, 'admin') ON CONFLICT DO NOTHING`,
      [existing.rows[0].id]
    );
    return;
  }

  const lookup = nationalIdLookup(bootstrapNationalId);
  await pool.query(
    `INSERT INTO users (phone, national_id_lookup, national_id_verifier, national_id_ciphertext)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (phone) DO NOTHING`,
    [bootstrapPhone, lookup, hashNationalId(bootstrapNationalId), encryptNationalId(bootstrapNationalId)]
  );
  const created = await pool.query('SELECT id FROM users WHERE phone = $1', [bootstrapPhone]);
  if (created.rows[0]) {
    await pool.query(`INSERT INTO profiles (user_id, full_name, profile_completed) VALUES ($1, 'مدیر KELO', true) ON CONFLICT (user_id) DO NOTHING`, [created.rows[0].id]);
    await pool.query(`INSERT INTO user_roles (user_id, role) VALUES ($1, 'admin') ON CONFLICT DO NOTHING`, [created.rows[0].id]);
  }
}

async function getUserById(userId) {
  const result = await pool.query(
    `SELECT u.id, u.phone, u.national_id_verifier, u.national_id_ciphertext,
            p.full_name, p.province, p.city, p.village, p.profile_location, p.profile_completed,
            COALESCE(array_agg(ur.role) FILTER (WHERE ur.role IS NOT NULL), '{}') AS system_roles
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id
       LEFT JOIN user_roles ur ON ur.user_id = u.id
      WHERE u.id = $1
      GROUP BY u.id, p.user_id`,
    [userId]
  );
  if (!result.rows[0]) return null;
  return mapUserRow(result.rows[0]);
}

function mapUserRow(row) {
  return {
    id: row.id,
    name: row.full_name || '',
    phone: row.phone,
    nationalId: decryptNationalId(row.national_id_ciphertext),
    systemRoles: Array.isArray(row.system_roles) ? row.system_roles : [],
    profileCompleted: !!row.profile_completed,
    profile: {
      province: row.province || '',
      city: row.city || '',
      village: row.village || ''
    },
    profileLocation: row.profile_location || null
  };
}

function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) return res.status(401).json({ error: 'احراز هویت لازم است.' });
  next();
}

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, service: 'kelo-api', database: 'up' });
  } catch (error) {
    console.error('health:', error.message);
    res.status(503).json({ ok: false, service: 'kelo-api', database: 'down' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const phone = normalizePhone(req.body.phone);
    const nationalId = normalizeNationalId(req.body.nationalId);
    const authMode = req.body.authMode === 'admin' ? 'admin' : 'public';
    assertLoginInput(phone, nationalId);

    const found = await pool.query(
      `SELECT u.id, u.phone, u.national_id_verifier, u.national_id_ciphertext,
              p.full_name, p.province, p.city, p.village, p.profile_location, p.profile_completed,
              COALESCE(array_agg(ur.role) FILTER (WHERE ur.role IS NOT NULL), '{}') AS system_roles
         FROM users u
         LEFT JOIN profiles p ON p.user_id = u.id
         LEFT JOIN user_roles ur ON ur.user_id = u.id
        WHERE u.phone = $1
        GROUP BY u.id, p.user_id`,
      [phone]
    );

    let userRow = found.rows[0];
    let created = false;

    if (userRow) {
      if (!verifyNationalId(nationalId, userRow.national_id_verifier)) {
        return res.status(401).json({ error: 'اطلاعات ورود صحیح نیست.' });
      }
      if (authMode === 'admin' && !userRow.system_roles.includes('admin')) {
        return res.status(401).json({ error: 'اطلاعات ورود مدیر صحیح نیست.' });
      }
    } else {
      if (authMode === 'admin') {
        return res.status(401).json({ error: 'اطلاعات ورود مدیر صحیح نیست.' });
      }

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const lookup = nationalIdLookup(nationalId);
        await client.query(`SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))`, [phone, lookup]);
        const duplicate = await client.query('SELECT id FROM users WHERE national_id_lookup = $1 LIMIT 1', [lookup]);
        if (duplicate.rows[0]) {
          await client.query('ROLLBACK');
          return res.status(409).json({ error: 'این کد ملی قبلاً ثبت شده است.' });
        }
        const inserted = await client.query(
          `INSERT INTO users (phone, national_id_lookup, national_id_verifier, national_id_ciphertext)
           VALUES ($1, $2, $3, $4)
           RETURNING id, phone, national_id_verifier, national_id_ciphertext, created_at`,
          [phone, lookup, hashNationalId(nationalId), encryptNationalId(nationalId)]
        );
        userRow = inserted.rows[0];
        await client.query(
          `INSERT INTO profiles (user_id) VALUES ($1)`,
          [userRow.id]
        );
        await client.query('COMMIT');
        created = true;
      } catch (error) {
        try { await client.query('ROLLBACK'); } catch (_) {}
        if (error.code === '23505') return res.status(409).json({ error: 'شماره همراه یا کد ملی قبلاً ثبت شده است.' });
        throw error;
      } finally {
        client.release();
      }
      userRow = (await pool.query(
        `SELECT u.id, u.phone, u.national_id_verifier, u.national_id_ciphertext,
                p.full_name, p.province, p.city, p.village, p.profile_location, p.profile_completed,
                COALESCE(array_agg(ur.role) FILTER (WHERE ur.role IS NOT NULL), '{}') AS system_roles
           FROM users u
           LEFT JOIN profiles p ON p.user_id = u.id
           LEFT JOIN user_roles ur ON ur.user_id = u.id
          WHERE u.id = $1
          GROUP BY u.id, p.user_id`,
        [userRow.id]
      )).rows[0];
    }

    const user = mapUserRow(userRow);
    req.session.userId = user.id;
    req.session.authMode = authMode;
    return res.json({ ok: true, created, user });
  } catch (error) {
    console.error('login:', error);
    const status = error.status || 500;
    return res.status(status).json({ error: status === 500 ? 'خطای داخلی سرور.' : error.message });
  }
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  try {
    const user = await getUserById(req.session.userId);
    if (!user) {
      req.session.destroy(() => {});
      return res.status(401).json({ error: 'نشست کاربر معتبر نیست.' });
    }
    res.json(user);
  } catch (error) {
    console.error('me:', error);
    res.status(500).json({ error: 'خطای داخلی سرور.' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(error => {
    if (error) {
      console.error('logout:', error);
      return res.status(500).json({ error: 'خروج انجام نشد.' });
    }
    res.clearCookie('kelo.sid', { httpOnly: true, secure: IS_PROD, sameSite: 'lax', path: '/' });
    return res.json({ ok: true });
  });
});

app.put('/api/profile', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const current = await getUserById(req.session.userId);
    if (!current) return res.status(401).json({ error: 'کاربر معتبر نیست.' });

    const body = req.body || {};
    const name = String(body.name || '').trim();
    const phone = normalizePhone(body.phone !== undefined ? body.phone : current.phone);
    const nationalId = normalizeNationalId(body.nationalId !== undefined ? body.nationalId : current.nationalId);
    if (name.length < 2) return res.status(400).json({ error: 'نام کامل را وارد کنید.' });
    if (!/^09\d{9}$/.test(phone)) return res.status(400).json({ error: 'شماره همراه معتبر نیست.' });
    if (!/^\d{10}$/.test(nationalId)) return res.status(400).json({ error: 'کد ملی باید ۱۰ رقم باشد.' });

    const profile = body.profile && typeof body.profile === 'object' ? body.profile : {};
    const profileLocation = body.profileLocation && typeof body.profileLocation === 'object' ? body.profileLocation : null;
    const profileCompleted = body.profileCompleted !== false;

    await client.query('BEGIN');
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))`, [phone, nationalId]);

    const phoneDup = await client.query('SELECT id FROM users WHERE phone = $1 AND id <> $2 LIMIT 1', [phone, current.id]);
    if (phoneDup.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'این شماره همراه قبلاً ثبت شده است.' });
    }

    const lookup = nationalIdLookup(nationalId);
    const duplicateNid = await client.query('SELECT id FROM users WHERE national_id_lookup = $1 AND id <> $2 LIMIT 1', [lookup, current.id]);
    if (duplicateNid.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'این کد ملی قبلاً ثبت شده است.' });
    }

    await client.query(
      `UPDATE users
          SET phone = $1,
              national_id_lookup = $2,
              national_id_verifier = $3,
              national_id_ciphertext = $4
        WHERE id = $5`,
      [phone, lookup, hashNationalId(nationalId), encryptNationalId(nationalId), current.id]
    );

    await client.query(
      `INSERT INTO profiles (user_id, full_name, province, city, village, profile_location, profile_completed)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
       ON CONFLICT (user_id) DO UPDATE SET
          full_name = EXCLUDED.full_name,
          province = EXCLUDED.province,
          city = EXCLUDED.city,
          village = EXCLUDED.village,
          profile_location = EXCLUDED.profile_location,
          profile_completed = EXCLUDED.profile_completed`,
      [current.id, name, profile.province || null, profile.city || null, profile.village || null, profileLocation ? JSON.stringify(profileLocation) : null, profileCompleted]
    );

    await client.query('COMMIT');
    const updated = await getUserById(current.id);
    return res.json({ ok: true, user: updated });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    console.error('profile:', error);
    if (error.code === '23505') return res.status(409).json({ error: 'شماره همراه یا کد ملی تکراری است.' });
    return res.status(500).json({ error: 'ذخیره اطلاعات انجام نشد.' });
  } finally {
    client.release();
  }
});

app.get(/^(?!\/api(?:\/|$)).*/, (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(ROOT, 'index.html'));
});

app.use((err, _req, res, _next) => {
  console.error('unhandled:', err);
  res.status(500).json({ error: 'خطای داخلی سرور.' });
});

let server;

(async function startServer(){
  try {
    await ensureBootstrapAdmin();
  } catch (error) {
    console.error('bootstrap admin:', error.message);
    if (IS_PROD) process.exit(1);
  }
  server = app.listen(PORT, () => {
    console.log(`KELO server listening on :${PORT}`);
  });
})();

async function shutdown(signal) {
  console.log(`Received ${signal}; shutting down.`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
