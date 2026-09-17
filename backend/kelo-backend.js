/**
 * KELO backend boundary.
 *
 * Current status:
 * - mode=local: Final_1_osm_fixed2 behavior remains localStorage-backed.
 * - mode=supabase: reserved for the production integration step.
 *
 * Keeping this boundary separate means the UI can stay stable while the
 * persistence/auth layer moves from browser-only storage to PostgreSQL/Auth.
 */
(function () {
  const cfg = window.KELO_CONFIG || {};
  const supabase = cfg.supabase || {};

  window.KeloBackend = {
    mode: cfg.mode || 'local',
    isSupabaseConfigured() {
      return Boolean(supabase.url && supabase.anonKey);
    },
    getSupabaseConfig() {
      return { url: supabase.url || '', anonKey: supabase.anonKey || '' };
    },
    assertProductionReady() {
      if (this.mode === 'supabase' && !this.isSupabaseConfigured()) {
        throw new Error('KELO Supabase configuration is missing.');
      }
      return true;
    }
  };
})();
