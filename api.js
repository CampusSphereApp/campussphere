const apiHost = String(window.CAMPUSSPHERE_API_ORIGIN || '').replace(/\/+$/, '') || (window.location.protocol === 'file:' || ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname) ? `http://${window.location.hostname || '127.0.0.1'}:4000` : window.location.origin);
const API_BASE = `${apiHost}/api/v1`;
const accessTokenKey = 'campussphere_access_token';

const readPayload = async (response) => {
  try { return await response.json(); } catch { return {}; }
};

const isRefreshableRequest = (path) => !['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout'].includes(path);

async function refreshAccessToken() {
  const response = await fetch(`${API_BASE}/auth/refresh`, { method: 'POST', credentials: 'include' });
  const payload = await readPayload(response);
  if (!response.ok || !payload.data?.accessToken) {
    localStorage.removeItem(accessTokenKey);
    return null;
  }
  localStorage.setItem(accessTokenKey, payload.data.accessToken);
  return payload.data.accessToken;
}

async function request(path, options = {}, hasRetried = false) {
  const token = localStorage.getItem(accessTokenKey);
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });
  if (response.status === 204) return null;
  const payload = await readPayload(response);
  if (response.status === 401 && !hasRetried && isRefreshableRequest(path) && await refreshAccessToken()) return request(path, options, true);
  if (!response.ok) throw new Error(payload.error?.message || 'Request failed.');
  return payload.data;
}

async function restoreSession() {
  try { return await request('/auth/me'); } catch { return null; }
}

async function logout() {
  try { await request('/auth/logout', { method: 'POST' }); } finally { localStorage.removeItem(accessTokenKey); }
}

window.CampusSphereAPI = {
  request,
  login: (email, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  googleConfig: () => request('/auth/google/config'),
  googleLogin: (credential) => request('/auth/google', { method: 'POST', body: JSON.stringify({ credential }) }),
  register: (data) => request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  logout,
  refresh: refreshAccessToken,
  restoreSession,
  me: () => request('/auth/me'),
  dashboard: () => request('/dashboard'),
  search: (q) => request(`/search?q=${encodeURIComponent(q)}`)
};
