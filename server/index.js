import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import healthRoutes from './routes/health.js';
import publicRoutes from './routes/public.js';
import notReadyRoutes from './routes/not-ready.js';
import { closePool } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const app = express();
const port = Number(process.env.PORT || 3000);
const allowedOrigins = String(process.env.CORS_ORIGINS || process.env.PUBLIC_ORIGIN || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

app.disable('x-powered-by');
app.set('trust proxy', String(process.env.TRUST_PROXY || '').toLowerCase() === 'true');

// Helmet is enabled for the API/server. CSP is intentionally disabled here
// because the current frontend uses external Leaflet assets and existing
// inline UI handlers; CSP will be hardened after those assets are bundled.
app.use(helmet({ contentSecurityPolicy: false }));

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('CORS origin not allowed.'));
  },
  credentials: true
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-8',
  legacyHeaders: false
});
app.use('/api', apiLimiter);

app.get('/api/config', (_req, res) => {
  res.json({
    appEnv: process.env.NODE_ENV || 'development',
    apiVersion: '1',
    siteOrigin: process.env.PUBLIC_ORIGIN || null
  });
});

app.use('/api', healthRoutes);
app.use('/api', publicRoutes);
app.use('/api', notReadyRoutes);

// Never expose deployment/source/control files through the web server.
// The frontend needs index.html, css/, js/, config/kelo-config.js and
// backend/kelo-backend.js; everything else below is server-side or internal.
app.use((req, res, next) => {
  const blocked = [
    /^\/server(?:\/|$)/,
    /^\/scripts(?:\/|$)/,
    /^\/database(?:\/|$)/,
    /^\/docs(?:\/|$)/,
    /^\/legacy(?:\/|$)/,
    /^\/nginx(?:\/|$)/,
    /^\/node_modules(?:\/|$)/,
    /^\/(?:\.env(?:\.|$)|package(?:-lock)?\.json$|Dockerfile$|docker-compose\.ya?ml$|README(?:\.md)?$)/i
  ];
  if (blocked.some((pattern) => pattern.test(req.path))) {
    return res.status(404).end();
  }
  return next();
});

app.use(express.static(rootDir, {
  index: 'index.html',
  extensions: ['html']
}));

// SPA fallback for non-file GET requests, excluding /api.
app.get('/*splat', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  if (path.extname(req.path)) return next();
  return res.sendFile(path.join(rootDir, 'index.html'));
});

app.use((err, _req, res, _next) => {
  const status = err.message === 'CORS origin not allowed.' ? 403 : 500;
  console.error('[KELO][API]', err);
  res.status(status).json({
    error: status === 403 ? 'cors_not_allowed' : 'internal_error'
  });
});

const server = app.listen(port, () => {
  console.log(`[KELO] server listening on http://127.0.0.1:${port}`);
});

async function shutdown(signal) {
  console.log(`[KELO] received ${signal}; shutting down`);
  server.close(async () => {
    try { await closePool(); } catch (_) {}
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
