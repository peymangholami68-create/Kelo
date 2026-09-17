/**
 * KELO runtime configuration.
 *
 * The browser never stores database credentials or server secrets here.
 * Production runs the frontend and API on the same origin (kelo.ir), so
 * apiBaseUrl can stay empty and the browser uses /api/*.
 * Vercel preview automatically falls back to the existing local demo when
 * no API is available.
 */
window.KELO_CONFIG = Object.assign({
  appEnv: 'development',
  backendMode: 'auto',
  apiBaseUrl: '',
  sessionCookieName: 'kelo_session'
}, window.KELO_CONFIG || {});
