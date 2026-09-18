/**
 * KELO runtime configuration.
 *
 * mode=auto:
 *   - uses the real VPS backend when /api/health exists;
 *   - falls back to the existing local prototype only when the API is not
 *     present (e.g. the current static Vercel test deployment).
 *
 * mode=server:
 *   - production/VPS mode; API must be available.
 *
 * No secrets belong in this file.
 */
window.KELO_CONFIG = Object.assign({
  appEnv: 'development',
  mode: 'auto',
  apiBase: '/api'
}, window.KELO_CONFIG || {});
