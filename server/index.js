require('dotenv').config();

const path = require('path');
const express = require('express');
const {
  normalizePhone,
  normalizeNationalId,
  validPhone,
  validNationalId,
  sanitizeUser,
  requireSession,
  createSession,
  revokeSession,
  logAudit
} = require('./auth');
const { query } = require('./db');

const app = express();
const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT || 3000);

app.set('trust proxy', true);
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Permissions-Policy', 'geolocation=(self), camera=(), microphone=()');
  next();
});

app.get('/api/health', async (req, res, next) => {
  try {
    const result = await query('select 1 as ok');
    return res.json({ ok: result.rows[0]?.ok === 1, service: 'kelo-api' });
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const phone = normalizePhone(req.body?.phone);
    const nationalId = normalizeNationalId(req.body?.nationalId);
    const intent = req.body?.intent === 'admin' ? 'admin' : 'user';

    if (!validPhone(phone)) return res.status(400).json({ ok: false, error: 'شماره تلفن همراه معتبر نیست.' });
    if (!validNationalId(nationalId)) return res.status(400).json({ ok: false, error: 'کد ملی باید ۱۰ رقم باشد.' });

    const byPhone = await query('select * from users where phone = $1 limit 1', [phone]);
    let user = byPhone.rows[0] || null;

    if (intent === 'admin') {
      if (!user || !Array.isArray(user.system_roles) || !user.system_roles.includes('admin')) {
        return res.status(401).json({ ok: false, error: 'اطلاعات ورود مدیر صحیح نیست.' });
      }
      if (user.national_id !== nationalId) {
        return res.status(401).json({ ok: false, error: 'اطلاعات ورود مدیر صحیح نیست.' });
      }
    } else if (user) {
      if (user.national_id !== nationalId) {
        return res.status(409).json({ ok: false, error: 'این شماره همراه قبلاً با کد ملی دیگری ثبت شده است.' });
      }
    } else {
      const byNationalId = await query('select id from users where national_id = $1 limit 1', [nationalId]);
      if (byNationalId.rows[0]) {
        return res.status(409).json({ ok: false, error: 'این کد ملی قبلاً ثبت شده است.' });
      }
      const created = await query(
        `insert into users (phone, national_id)
         values ($1, $2)
         returning *`,
        [phone, nationalId]
      );
      user = created.rows[0];
    }

    await createSession(user, req, res);
    await logAudit(user.id, 'login', 'user', user.id, { intent });
    return res.json({ ok: true, created: !byPhone.rows[0], user: sanitizeUser(user) });
  } catch (error) {
    if (error?.code === '23505') return res.status(409).json({ ok: false, error: 'اطلاعات کاربر تکراری است.' });
    next(error);
  }
});

app.get('/api/auth/session', requireSession, async (req, res) => {
  return res.json({ ok: true, authenticated: true, user: sanitizeUser(req.user) });
});

app.post('/api/auth/logout', async (req, res, next) => {
  try {
    const user = await (async () => {
      try {
        const cookies = String(req.headers.cookie || '').split(';').reduce((acc, part) => {
          const i = part.indexOf('=');
          if (i < 0) return acc;
          acc[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
          return acc;
        }, {});
        const { getUserBySessionToken, COOKIE_NAME } = require('./auth');
        return await getUserBySessionToken(cookies[COOKIE_NAME]);
      } catch (_) { return null; }
    })();
    await revokeSession(req, res);
    if (user) await logAudit(user.id, 'logout', 'user', user.id, {});
    return res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.get('/api/me', requireSession, (req, res) => {
  return res.json({ ok: true, user: sanitizeUser(req.user) });
});

app.patch('/api/me', requireSession, async (req, res, next) => {
  try {
    const body = req.body || {};
    const name = body.name !== undefined ? String(body.name || '').trim() : req.user.name;
    const phone = body.phone !== undefined ? normalizePhone(body.phone) : req.user.phone;
    const nationalId = body.nationalId !== undefined ? normalizeNationalId(body.nationalId) : req.user.national_id;
    const profileCompleted = body.profileCompleted !== undefined ? !!body.profileCompleted : req.user.profile_completed;
    const profile = body.profile !== undefined && body.profile && typeof body.profile === 'object' ? body.profile : (req.user.profile || {});
    const profileLocation = body.profileLocation !== undefined ? body.profileLocation : req.user.profile_location;

    if (!name || name.length < 2) return res.status(400).json({ ok: false, error: 'نام کامل را وارد کنید.' });
    if (!validPhone(phone)) return res.status(400).json({ ok: false, error: 'شماره تلفن همراه معتبر نیست.' });
    if (!validNationalId(nationalId)) return res.status(400).json({ ok: false, error: 'کد ملی باید ۱۰ رقم باشد.' });

    const duplicate = await query(
      `select id from users where (phone = $1 or national_id = $2) and id <> $3 limit 1`,
      [phone, nationalId, req.user.id]
    );
    if (duplicate.rows[0]) return res.status(409).json({ ok: false, error: 'شماره همراه یا کد ملی قبلاً ثبت شده است.' });

    const updated = await query(
      `update users
          set name = $1,
              phone = $2,
              national_id = $3,
              profile_completed = $4,
              profile = $5::jsonb,
              profile_location = $6::jsonb
        where id = $7
      returning *`,
      [name, phone, nationalId, profileCompleted, JSON.stringify(profile), profileLocation == null ? null : JSON.stringify(profileLocation), req.user.id]
    );
    const user = updated.rows[0];
    await logAudit(user.id, 'profile_updated', 'user', user.id, {});
    return res.json({ ok: true, user: sanitizeUser(user) });
  } catch (error) {
    if (error?.code === '23505') return res.status(409).json({ ok: false, error: 'شماره همراه یا کد ملی قبلاً ثبت شده است.' });
    next(error);
  }
});

// Keep server/database/configuration material out of the public web root.
app.use((req, res, next) => {
  const blocked = [
    /^\/(server|database|nginx|supabase|docs)(?:\/|$)/i,
    /^\/(?:\.env(?:\..*)?|package(?:-lock)?\.json|Dockerfile|docker-compose\.yml|README(?:\.md)?|LICENSE)$/i
  ];
  if (blocked.some(pattern => pattern.test(req.path))) {
    return res.status(404).send('Not Found');
  }
  next();
});

// Static frontend. The VPS can place Nginx in front of this process.
app.use(express.static(ROOT, { index: 'index.html', extensions: ['html'] }));

// Friendly SPA fallback for clean frontend URLs while keeping /api/* explicit.
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api/') && !path.extname(req.path)) {
    return res.sendFile(path.join(ROOT, 'index.html'));
  }
  return next();
});

app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ ok: false, error: 'not_found' });
  return res.status(404).send('Not Found');
});

app.use((error, req, res, next) => {
  console.error('[kelo-api]', error);
  if (res.headersSent) return next(error);
  return res.status(500).json({ ok: false, error: 'server_error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`KELO server listening on 0.0.0.0:${PORT}`);
});
