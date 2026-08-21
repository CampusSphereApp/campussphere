const apiHost = window.CAMPUSSPHERE_API_ORIGIN || (['localhost', '127.0.0.1'].includes(window.location.hostname) ? `${window.location.protocol}//${window.location.hostname}:4000` : window.location.origin);
const API_BASE = `${apiHost}/api/v1`;
const accessTokenKey = 'campussphere_access_token';
let currentUserPromise = null;

export const workspaceUrl = (role) => role === 'TEACHER' ? 'teacher-dashboard.html' : role === 'COLLEGE_ADMIN' ? 'college-admin.html' : role === 'ADMIN' ? 'admin.html' : 'dashboard.html';

export const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
})[character]);

const defaultAvatarUrl = (user, size = 80) => {
  const initials = String(user?.fullName || 'CampusSphere').split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="100%" height="100%" rx="${size / 2}" fill="#5b49c7"/><text x="50%" y="52%" dominant-baseline="middle" text-anchor="middle" fill="white" font-family="Arial,sans-serif" font-size="${size * .36}" font-weight="700">${initials}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};
export const mediaUrl = (value) => {
  const mediaPath = String(value || '').trim();
  if (!mediaPath || /^[a-z]:[\\/]/i.test(mediaPath) || mediaPath.startsWith('file:')) return null;
  if (/^https?:\/\//i.test(mediaPath) || mediaPath.startsWith('data:') || mediaPath.startsWith('blob:')) return mediaPath;
  return `${apiHost}/${mediaPath.replace(/^\/+/, '')}`;
};
export const avatarUrl = (user, size = 80) => mediaUrl(user?.avatar) || defaultAvatarUrl(user, size);

if (typeof document !== 'undefined') document.addEventListener('error', (event) => {
  const image = event.target;
  if (!(image instanceof HTMLImageElement) || image.dataset.avatarFallback === 'true') return;
  image.dataset.avatarFallback = 'true'; image.src = defaultAvatarUrl({ fullName: image.alt }, Math.max(image.width || 0, image.height || 0, 80));
}, true);
export const formatDate = (value) => value ? new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(value)) : 'Open deadline';

const readPayload = async (response) => { try { return await response.json(); } catch { return {}; } };
const canRefresh = (path) => !['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout'].includes(path);

export async function refreshSession() {
  const response = await fetch(`${API_BASE}/auth/refresh`, { method: 'POST', credentials: 'include' });
  const payload = await readPayload(response);
  if (!response.ok || !payload.data?.accessToken) {
    localStorage.removeItem(accessTokenKey);
    return null;
  }
  localStorage.setItem(accessTokenKey, payload.data.accessToken);
  return payload.data.accessToken;
}

export async function api(path, options = {}, hasRetried = false) {
  const accessToken = localStorage.getItem(accessTokenKey);
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    ...options,
    headers: {
      ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(options.headers || {})
    }
  });
  if (response.status === 204) return null;
  const payload = await readPayload(response);
  if (response.status === 401 && !hasRetried && canRefresh(path) && await refreshSession()) return api(path, options, true);
  if (!response.ok) throw new Error(payload.error?.message || 'Unable to load CampusSphere data.');
  return payload.data;
}

export async function restoreSession() {
  if (!currentUserPromise) currentUserPromise = api('/auth/me').catch(() => null);
  return currentUserPromise;
}

export async function requireAuthentication() {
  if (await restoreSession()) return true;
  window.location.assign('login.html');
  return false;
}

export async function requireRole(...allowedRoles) {
  const user = await restoreSession();
  if (!user) { window.location.assign('login.html'); return null; }
  if (!allowedRoles.includes(user.role)) { window.location.assign(workspaceUrl(user.role)); return null; }
  return user;
}

export async function logout() {
  try { await api('/auth/logout', { method: 'POST' }); } finally { localStorage.removeItem(accessTokenKey); currentUserPromise = null; }
}

if (typeof window !== 'undefined') void import('./current-user.js');
