/**
 * KELO runtime configuration.
 *
 * This file intentionally contains no secrets.
 * For the current browser prototype, mode stays "local".
 * When the Supabase project is ready, set mode to "supabase" and provide
 * the public (anon) project URL/key here or inject them during deployment.
 * Never place a service_role key in browser code.
 */
window.KELO_CONFIG = Object.assign({
  appEnv: 'development',
  mode: 'local',
  supabase: {
    url: '',
    anonKey: ''
  }
}, window.KELO_CONFIG || {});
