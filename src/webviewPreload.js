import { ipcRenderer } from 'electron';

const isApiRequest = (url) => {
  if (!url) return false;
  if (typeof url !== 'string') return false;

  // Most ERPNext/POSAwesome API calls go through /api or /api/method
  return url.startsWith('/api/') || url.includes('/api/method') || url.includes('/api/resource');
};

const normalizeHeaders = (headers) => {
  if (!headers) return {};
  const normalized = {};

  try {
    const h = new Headers(headers);
    h.forEach((value, key) => {
      normalized[key] = value;
    });
  } catch {
    Object.assign(normalized, headers);
  }

  return normalized;
};

const safeJsonParse = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const createResponse = (result) => {
  const status = result?.status ?? 500;
  const data = result?.data ?? null;
  const body = typeof data === 'string' ? data : JSON.stringify(data);

  const headers = new Headers(result?.headers || {});
  if (!headers.has('content-type')) {
    headers.set('content-type', typeof data === 'string' ? 'text/plain' : 'application/json');
  }

  return new Response(body, {
    status,
    headers,
  });
};

const syncOnlineStatus = () => {
  ipcRenderer.invoke('interceptor-set-online-status', navigator.onLine).catch(() => null);
};

window.addEventListener('online', syncOnlineStatus);
window.addEventListener('offline', syncOnlineStatus);

syncOnlineStatus();

const originalFetch = window.fetch.bind(window);
window.fetch = async (input, init = {}) => {
  const request = input instanceof Request ? input : null;

  const url = typeof input === 'string' ? input : request?.url;
  const method = (init.method || request?.method || 'GET').toUpperCase();

  if (!isApiRequest(url)) {
    return originalFetch(input, init);
  }

  const headers = {
    ...normalizeHeaders(request?.headers),
    ...normalizeHeaders(init.headers),
  };

  let bodyText = null;
  if (typeof init.body === 'string') {
    bodyText = init.body;
  } else if (init.body != null) {
    try {
      bodyText = JSON.stringify(init.body);
    } catch {
      bodyText = null;
    }
  } else if (request) {
    try {
      bodyText = await request.clone().text();
    } catch {
      bodyText = null;
    }
  }

  // Online: pass-through to native fetch, but cache successful GET responses.
  if (navigator.onLine) {
    try {
      const response = await originalFetch(input, init);

      if (method === 'GET' && response.ok) {
        try {
          const clone = response.clone();
          const text = await clone.text();
          const parsed = safeJsonParse(text);
          await ipcRenderer.invoke('interceptor-cache-response', method, url, bodyText, parsed);
        } catch {
          // Ignore caching errors
        }
      }

      return response;
    } catch {
      // Fall back to offline handling below
    }
  }

  // Offline (or online fetch failure): route through offline interceptor service.
  const result = await ipcRenderer.invoke('interceptor-execute-request', method, url, {
    headers,
    body: bodyText,
  });

  return createResponse(result);
};

// XHR interception (offline fallback only)
const originalOpen = XMLHttpRequest.prototype.open;
const originalSend = XMLHttpRequest.prototype.send;
const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;

XMLHttpRequest.prototype.open = function (method, url, async = true, user, password) {
  this.__intercepted = {
    method: (method || 'GET').toUpperCase(),
    url,
    headers: {},
    async,
    user,
    password,
  };

  return originalOpen.call(this, method, url, async, user, password);
};

XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
  if (this.__intercepted) {
    this.__intercepted.headers[name] = value;
  }
  return originalSetRequestHeader.call(this, name, value);
};

XMLHttpRequest.prototype.send = function (body) {
  const meta = this.__intercepted;
  if (!meta || !isApiRequest(meta.url) || navigator.onLine) {
    return originalSend.call(this, body);
  }

  const bodyText = typeof body === 'string' ? body : body ? JSON.stringify(body) : null;

  const complete = async () => {
    try {
      const result = await ipcRenderer.invoke('interceptor-execute-request', meta.method, meta.url, {
        headers: meta.headers,
        body: bodyText,
      });

      this.status = result?.status ?? 500;
      this.responseText = typeof result?.data === 'string' ? result.data : JSON.stringify(result?.data);
      this.readyState = 4;

      if (typeof this.onreadystatechange === 'function') this.onreadystatechange();
      if (typeof this.onload === 'function') this.onload();
    } catch (error) {
      this.readyState = 4;
      if (typeof this.onreadystatechange === 'function') this.onreadystatechange();
      if (typeof this.onerror === 'function') this.onerror(error);
    }
  };

  complete();
};
