/**
 * KELO frontend/backend boundary.
 *
 * Local mode remains the compatibility mode for the current prototype.
 * API mode targets the VPS-hosted Node/PostgreSQL backend through the same
 * interface, so the UI does not need to know where persistence lives.
 */
(function () {
  const cfg = window.KELO_CONFIG || {};
  const api = cfg.api || {};

  const mode = cfg.mode || 'local';
  const baseUrl = String(api.baseUrl || '').replace(/\/+$/, '');
  const timeoutMs = Number(api.timeoutMs || 15000);

  async function request(path, options = {}) {
    if (!baseUrl) throw new Error('KELO API base URL is not configured.');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const headers = new Headers(options.headers || {});
      if (!headers.has('Content-Type') && options.body != null) {
        headers.set('Content-Type', 'application/json');
      }

      const response = await fetch(baseUrl + path, {
        credentials: 'include',
        ...options,
        headers,
        signal: controller.signal
      });

      const text = await response.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }

      if (!response.ok) {
        const message = data && data.error ? data.error : `HTTP ${response.status}`;
        const error = new Error(message);
        error.status = response.status;
        error.data = data;
        throw error;
      }
      return data;
    } finally {
      clearTimeout(timer);
    }
  }

  window.KeloBackend = {
    mode,
    baseUrl,
    isApiConfigured() {
      return Boolean(mode === 'api' && baseUrl);
    },
    async health() {
      return request('/api/health');
    },
    async getServices() {
      return request('/api/services');
    },
    async getPublicSettings() {
      return request('/api/settings/public');
    },
    async createRequest(payload) {
      return request('/api/requests', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    },
    async acceptRequestRecipient(recipientId) {
      return request(`/api/request-recipients/${encodeURIComponent(recipientId)}/accept`, {
        method: 'POST'
      });
    }
  };
})();
