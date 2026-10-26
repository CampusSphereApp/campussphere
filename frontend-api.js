const localHosts = new Set(['localhost', '127.0.0.1']);
const configuredApiOrigin = String(window.CAMPUSSPHERE_API_ORIGIN || '').trim();
const apiHost = configuredApiOrigin
  ? configuredApiOrigin.replace(/\/+$/, '')
  : window.location.protocol === 'file:' || localHosts.has(window.location.hostname)
    ? `http://${window.location.hostname || '127.0.0.1'}:4000`
    : window.location.origin;

const API_BASE = `${apiHost}/api/v1`;
const accessTokenKey = 'campussphere_access_token';
let currentUserPromise = null;

export const workspaceUrl = (role) => {

  switch (role) {

    case 'ADMIN':
      return 'admin.html';

    case 'STUDENT':
    case 'TEACHER':
    case 'COLLEGE_ADMIN':
    default:
      return 'dashboard.html';

  }

};
export const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
})[character]);

const uiIconPaths = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  location: '<path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  users: '<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0M17 8a3 3 0 1 1 0 6M22 21a6 6 0 0 0-5-5.65"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
  code: '<path d="m8 9-4 3 4 3M16 9l4 3-4 3M14 5l-4 14"/>',
  palette: '<circle cx="12" cy="12" r="9"/><circle cx="8" cy="9" r="1"/><circle cx="12" cy="7" r="1"/><circle cx="16" cy="10" r="1"/><path d="M15 17c-1 0-1.5-.5-1.5-1.2 0-1.3 2-1.4 2-3.3 0-1.5-1.5-2.5-3.5-2.5"/>',
  briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V4h8v3M3 12h18"/>',
  star: '<path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/>'
};
export const uiIcon = (name, className = 'cs-inline-icon') => `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${uiIconPaths[name] || uiIconPaths.star}</svg>`;

const defaultAvatarUrl = (user, size = 80) => {
  const initials = String(user?.fullName || 'CampusSphere').split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="100%" height="100%" rx="${size / 2}" fill="#e94c2b"/><text x="50%" y="52%" dominant-baseline="middle" text-anchor="middle" fill="white" font-family="Arial,sans-serif" font-size="${size * .36}" font-weight="700">${initials}</text></svg>`;
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
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      credentials: 'include',
      ...options,
      headers: {
        ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(options.headers || {})
      }
    });
  } catch (error) {
    throw new Error(
      `Cannot connect to the CampusSphere server at ${apiHost}. Make sure the backend is running and try again.`,
      { cause: error }
    );
  }
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
