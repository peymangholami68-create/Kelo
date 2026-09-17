/**
 * KELO runtime configuration.
 *
 * No secret belongs in this file. In development/test the prototype keeps
 * using localStorage. On the VPS, switch mode to "api" and point baseUrl at
 * the Kelo backend (normally the same origin, so baseUrl can remain empty).
 */
window.KELO_CONFIG = Object.assign({
  appEnv: 'development',
  mode: 'local',
  api: {
    baseUrl: '',
    timeoutMs: 15000
  }
}, window.KELO_CONFIG || {});
