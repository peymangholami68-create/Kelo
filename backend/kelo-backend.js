/**
 * KELO browser/backend bridge.
 *
 * In production the frontend and API share the same origin:
 *   https://kelo.ir            -> web UI
 *   https://kelo.ir/api/*      -> Node/Express API
 *
 * The Vercel preview keeps the old local prototype working automatically when
 * /api/health is not available.
 */
(function () {
  const cfg = window.KELO_CONFIG || {};
  const rawBase = String(cfg.apiBaseUrl || '').trim();
  const API_BASE = rawBase.replace(/\/+$/, '');
  let remoteAvailable = false;
  let availabilityChecked = false;
  let checkingPromise = null;

  function buildUrl(path) {
    if (/^https?:\/\//i.test(path)) return path;
    const normalized = path.startsWith('/') ? path : '/' + path;
    return API_BASE + normalized;
  }

  async function apiFetch(path, options) {
    const opts = Object.assign({ credentials: 'include' }, options || {});
    opts.headers = Object.assign({ 'Accept': 'application/json' }, opts.headers || {});
    if (opts.body && typeof opts.body !== 'string') {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(opts.body);
    }
    const controller = new AbortController();
    const timeoutMs = Number(opts.timeoutMs || 5000);
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    delete opts.timeoutMs;
    opts.signal = opts.signal || controller.signal;
    try {
      const res = await fetch(buildUrl(path), opts);
      let payload = null;
      try { payload = await res.json(); } catch (e) { payload = null; }
      if (!res.ok) {
        const error = new Error(payload?.error || payload?.message || ('API error ' + res.status));
        error.status = res.status;
        error.payload = payload;
        throw error;
      }
      return payload;
    } finally {
      clearTimeout(timer);
    }
  }

  async function checkApi() {
    if (availabilityChecked) return remoteAvailable;
    if (checkingPromise) return checkingPromise;
    const forcedLocal = (cfg.backendMode || 'auto') === 'local';
    const forcedRemote = (cfg.backendMode || 'auto') === 'api';
    if (forcedLocal) {
      availabilityChecked = true;
      remoteAvailable = false;
      return false;
    }
    checkingPromise = (async function () {
      try {
        const response = await apiFetch('/api/health', { method: 'GET', timeoutMs: forcedRemote ? 4000 : 1800 });
        remoteAvailable = !!(response && response.ok);
      } catch (e) {
        remoteAvailable = false;
        if (forcedRemote) console.error('KELO API health check failed:', e);
      }
      availabilityChecked = true;
      return remoteAvailable;
    })();
    return checkingPromise;
  }

  async function requireApi() {
    const available = await checkApi();
    if (!available) throw new Error('KELO backend is not available.');
    return true;
  }

  function userForBrowser(user) {
    if (!user) return null;
    return {
      id: user.id,
      name: user.name || '',
      phone: user.phone || '',
      nationalId: user.nationalId || '',
      profileCompleted: !!user.profileCompleted,
      profile: user.profile && typeof user.profile === 'object' ? user.profile : {},
      profileLocation: user.profileLocation && typeof user.profileLocation === 'object' ? user.profileLocation : null,
      systemRoles: Array.isArray(user.systemRoles) ? user.systemRoles : []
    };
  }

  window.KeloBackend = {
    get remoteAvailable() { return remoteAvailable; },
    async bootstrap() { return checkApi(); },
    async health() { return apiFetch('/api/health', { method: 'GET' }); },
    async login(phone, nationalId, intent) {
      await requireApi();
      const response = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: { phone, nationalId, intent: intent || 'user' }
      });
      return Object.assign({}, response, { user: userForBrowser(response.user) });
    },
    async getSession() {
      await requireApi();
      const response = await apiFetch('/api/auth/session', { method: 'GET' });
      return Object.assign({}, response, { user: userForBrowser(response.user) });
    },
    async logout() {
      if (!remoteAvailable) return { ok: true };
      try { return await apiFetch('/api/auth/logout', { method: 'POST' }); }
      catch (e) { console.warn('KELO remote logout failed:', e); return { ok: false }; }
    },
    async updateCurrentUser(changes) {
      await requireApi();
      const response = await apiFetch('/api/me', { method: 'PATCH', body: changes || {} });
      return userForBrowser(response.user);
    }
  };
})();
