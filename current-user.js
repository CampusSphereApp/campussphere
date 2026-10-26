import { api, avatarUrl, logout, restoreSession } from './frontend-api.js';

const courseLabel = (user) => [user.course, user.college].filter(Boolean).join(' · ') || 'CampusSphere member';
const applyAppearance = appearance => window.CampusSphereTheme?.apply(appearance, true);

const applyCurrentUser = (user) => {
  document.querySelectorAll('.sidebar-user, .sidebar .user').forEach((area) => {
    const image = area.querySelector('img');
    const name = area.querySelector('b');
    const detail = area.querySelector('small');
    if (image) { image.src = avatarUrl(user, 64); image.alt = user.fullName; }
    if (name) name.textContent = user.fullName;
    if (detail) detail.textContent = courseLabel(user);
  });

  document.querySelectorAll('[data-current-user-avatar], header img[alt="Vijay"], header img[alt="Vijay Gaikwad"], header img[src*="pravatar.cc/64?img=11"]').forEach((image) => {
    image.src = avatarUrl(user, 64);
    image.alt = user.fullName;
  });
};

const ensureStyles = () => {
  if (document.querySelector('link[href="header-controls.css"]')) return;
  const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = 'header-controls.css'; document.head.append(link);
  const mobileLink = document.createElement('link'); mobileLink.rel = 'stylesheet'; mobileLink.href = 'mobile-controls.css'; document.head.append(mobileLink);
};

const wireAccountMenu = (user) => {
  const image = document.querySelector('.top-actions > img[data-current-user-avatar], header > img[data-current-user-avatar], header > img[alt="Current user"], header > img[alt="Profile avatar"]');
  if (!image || image.closest('.account-host')) return;
  const host = document.createElement('span'); host.className = 'account-host';
  const trigger = document.createElement('button'); trigger.type = 'button'; trigger.className = 'account-trigger'; trigger.setAttribute('aria-label', 'Open account menu'); trigger.setAttribute('aria-expanded', 'false');
  image.parentNode.insertBefore(host, image); trigger.append(image); host.append(trigger);
  const menu = document.createElement('div'); menu.className = 'account-menu'; menu.hidden = true;
  menu.innerHTML = `<div class="account-summary"><img alt=""><span><b></b><small></small></span></div><a href="profile.html">View Profile</a><a href="settings.html">Settings</a><button class="logout-action" type="button">Logout</button>`;
  menu.querySelector('img').src = avatarUrl(user, 80); menu.querySelector('img').alt = user.fullName;
  menu.querySelector('b').textContent = user.fullName; menu.querySelector('small').textContent = user.email || courseLabel(user);
  host.append(menu);
  const close = () => { menu.hidden = true; trigger.setAttribute('aria-expanded', 'false'); };
  trigger.addEventListener('click', (event) => { event.stopPropagation(); menu.hidden = !menu.hidden; trigger.setAttribute('aria-expanded', String(!menu.hidden)); });
  menu.querySelector('.logout-action').addEventListener('click', async () => { await logout(); window.location.assign('login.html'); });
  document.addEventListener('click', (event) => { if (!host.contains(event.target)) close(); });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') close(); });
};

document.querySelectorAll('[data-logout]').forEach((link) => link.addEventListener('click', async (event) => {
  event.preventDefault();
  await logout();
  window.location.assign('login.html');
}));

try {
  const currentUser = await restoreSession();
  if (currentUser) { ensureStyles(); applyCurrentUser(currentUser); wireAccountMenu(currentUser); const settings = await api('/users/me/settings').catch(() => null); if (settings?.appearanceSettings) applyAppearance(settings.appearanceSettings); }
} catch (error) {
  console.warn(error instanceof Error ? error.message : error);
}
