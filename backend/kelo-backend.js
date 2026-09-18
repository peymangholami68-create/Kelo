/**
 * KELO frontend/backend bridge.
 *
 * In VPS/production mode the browser talks to the same-origin Express API.
 * In the current static Vercel test, /api/health is absent, so the client
 * safely falls back to the existing localStorage prototype.
 */
(function () {
  const cfg = window.KELO_CONFIG || {};
  const state = {
    requestedMode: cfg.mode || 'auto',
    mode: 'local',
    apiBase: String(cfg.apiBase || '/api').replace(/\/$/, ''),
    initPromise: null,
    lastError: null
  };

  async function parseResponse(res) {
    let body = null;
    try { body = await res.json(); } catch (_) {}
    if (!res.ok) {
      const err = new Error(body && body.error ? body.error : `HTTP ${res.status}`);
      err.status = res.status;
      err.body = body;
      throw err;
    }
    return body || {};
  }

  async function request(path, options) {
    const opts = Object.assign({
      credentials: 'same-origin',
      headers: {}
    }, options || {});
    opts.headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
    const res = await fetch(state.apiBase + path, opts);
    return parseResponse(res);
  }

  async function init() {
    if (state.initPromise) return state.initPromise;
    state.initPromise = (async function () {
      if (state.requestedMode === 'local') {
        state.mode = 'local';
        return state.mode;
      }

      try {
        const res = await fetch(state.apiBase + '/health', {
          method: 'GET',
          credentials: 'same-origin',
          cache: 'no-store'
        });

        if (res.status === 404) {
          // Static deployment (current Vercel test): preserve prototype mode.
          state.mode = 'local';
          return state.mode;
        }

        if (res.ok) {
          state.mode = 'server';
          return state.mode;
        }

        // API exists but is unhealthy: do NOT silently fall back to a fake
        // local database on production infrastructure.
        state.mode = 'server-error';
        state.lastError = new Error(`KELO API health check failed (${res.status})`);
        return state.mode;
      } catch (error) {
        // file:// and static-only hosting have no same-origin API. In auto
        // mode that is expected; in explicit server mode it is a real error.
        if (state.requestedMode === 'server') {
          state.mode = 'server-error';
          state.lastError = error;
          return state.mode;
        }
        state.mode = 'local';
        state.lastError = error;
        return state.mode;
      }
    })();
    return state.initPromise;
  }

  window.KeloBackend = {
    async init() { return init(); },
    isServerMode() { return state.mode === 'server'; },
    isServerError() { return state.mode === 'server-error'; },
    getMode() { return state.mode; },
    getApiBase() { return state.apiBase; },

    async login(phone, nationalId, authMode) {
      await init();
      if (state.mode !== 'server') throw new Error('KELO server API is not active.');
      return request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ phone, nationalId, authMode: authMode || 'public' })
      });
    },

    async me() {
      await init();
      if (state.mode !== 'server') return null;
      try {
        return await request('/auth/me', { method: 'GET' });
      } catch (error) {
        if (error.status === 401) return null;
        throw error;
      }
    },

    async logout() {
      await init();
      if (state.mode !== 'server') return { ok: true, local: true };
      return request('/auth/logout', { method: 'POST', body: '{}' });
    },

    async updateProfile(payload) {
      await init();
      if (state.mode !== 'server') throw new Error('KELO server API is not active.');
      return request('/profile', {
        method: 'PUT',
        body: JSON.stringify(payload || {})
      });
    }
  };
})();
