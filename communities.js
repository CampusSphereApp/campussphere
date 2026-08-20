import { api, avatarUrl, escapeHtml, requireAuthentication } from './frontend-api.js';

const iconFor = (category = '') => ({ technology: '&lt;/&gt;', engineering: '◉', creative: '✦', business: '↗', sports: '★', social: '●' })[category.toLowerCase()] || 'C';
const message = (text, error = false) => { const node = document.querySelector('#community-feedback'); if (node) { node.textContent = text; node.hidden = !text; node.classList.toggle('error', error); } };

if (document.querySelector('#community-grid')) {
  const search = document.querySelector('#community-search');
  const grid = document.querySelector('#community-grid');
  const empty = document.querySelector('.empty');
  const count = document.querySelector('#count');
  let category = 'all'; let timer;

  const render = (items) => {
    grid.innerHTML = items.map((item) => `<article data-id="${item.id}" tabindex="0"><div class="cover code"></div><b class="icon code-icon">${iconFor(item.category)}</b><div class="card"><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.category)} · ${item._count?.members || 0} members</p><span>${escapeHtml(item.description)}</span><button type="button" data-membership="${item.joined ? 'joined' : 'none'}">${item.joined ? 'Leave community' : 'Join community'}</button></div></article>`).join('');
    grid.hidden = items.length === 0; empty.hidden = items.length > 0; count.textContent = String(items.length);
  };
  const load = async () => {
    try { message(''); const q = search.value.trim(); const items = await api(`/communities?limit=20&q=${encodeURIComponent(q)}`); render(category === 'all' ? items : items.filter((item) => item.category.toLowerCase() === category)); }
    catch (error) { render([]); message(error.message, true); }
  };
  const changeMembership = async (id, joined) => {
    await api(`/communities/${id}${joined ? '/leave' : '/join'}`, { method: joined ? 'DELETE' : 'POST' }); await load();
  };
  document.querySelectorAll('.pills button').forEach((button) => button.addEventListener('click', () => { document.querySelector('.pills .active')?.classList.remove('active'); button.classList.add('active'); category = button.dataset.category || 'all'; void load(); }));
  search.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => void load(), 300); });
  grid.addEventListener('click', async (event) => {
    const card = event.target.closest('article'); if (!card) return;
    const button = event.target.closest('button');
    if (!button) return window.location.assign(`community-details.html?id=${encodeURIComponent(card.dataset.id)}`);
    event.stopPropagation(); button.disabled = true;
    try { await changeMembership(card.dataset.id, button.dataset.membership === 'joined'); }
    catch (error) { message(error.message, true); button.disabled = false; }
  });
  grid.addEventListener('keydown', (event) => { if (event.key === 'Enter') event.target.closest('article')?.click(); });

  const createButton = document.querySelector('#create-community, .search > button');
  if (!document.querySelector('#community-create-dialog')) document.body.insertAdjacentHTML('beforeend', '<dialog id="community-create-dialog" class="community-dialog"><form id="community-create-form" method="dialog"><h2>Create community</h2><label>Name<input name="name" required minlength="2" maxlength="100"></label><label>Category<input name="category" required maxlength="50" placeholder="Technology, Creative, Sports…"></label><label>Description<textarea name="description" required minlength="10" maxlength="2000"></textarea></label><div><button type="button" onclick="this.closest(\'dialog\').close()">Cancel</button><button type="submit">Create community</button></div></form></dialog>');
  createButton?.addEventListener('click', () => document.querySelector('#community-create-dialog')?.showModal());
  document.querySelector('#community-create-form')?.addEventListener('submit', async (event) => {
    event.preventDefault(); const form = new FormData(event.currentTarget); const submit = event.submitter; submit.disabled = true;
    try { const created = await api('/communities', { method: 'POST', body: JSON.stringify(Object.fromEntries(form)) }); window.location.assign(`community-details.html?id=${encodeURIComponent(created.id)}`); }
    catch (error) { message(error.message, true); submit.disabled = false; }
  });
  if (await requireAuthentication()) void load();
}

if (document.querySelector('#community-detail')) {
  const id = new URLSearchParams(window.location.search).get('id');
  const detail = document.querySelector('#community-detail'); const members = document.querySelector('#community-members');
  const render = (item, list) => {
    document.title = `${item.name} — CampusSphere`;
    detail.innerHTML = `<section class="community-hero"><div class="hero-cover code"></div><b>${iconFor(item.category)}</b><div><p>${escapeHtml(item.category)} COMMUNITY</p><h1>${escapeHtml(item.name)}</h1><span>${escapeHtml(item.description)}</span><small>◉ ${item._count?.members || 0} members · ${item.joined ? 'You are a member' : 'Open community'}</small></div><button id="community-membership" type="button">${item.joined ? (item.membershipRole === 'OWNER' ? 'Community owner' : 'Leave community') : 'Join community'}</button></section><div class="detail-tabs"><button class="active" type="button">About</button><button type="button" disabled>Posts</button><button type="button" disabled>Events</button><button type="button">Members</button></div><div class="detail-layout"><section><h2>About ${escapeHtml(item.name)}</h2><p>${escapeHtml(item.description)}</p><div class="stats"><article><b>${item._count?.members || 0}</b><span>Members</span></article><article><b>${item._count?.posts || 0}</b><span>Posts</span></article><article><b>${escapeHtml(item.category)}</b><span>Category</span></article></div><p class="activity-note">Community posts will appear here when they are published.</p></section><aside><h3>Community members</h3><div id="community-members"></div></aside></div>`;
    const memberBox = document.querySelector('#community-members'); memberBox.innerHTML = list.map(({ user, role }) => `<a class="person" href="profile.html?id=${encodeURIComponent(user.id)}"><img src="${escapeHtml(avatarUrl(user, 64))}" alt="${escapeHtml(user.fullName)}"><div><b>${escapeHtml(user.fullName)}</b><span>${role === 'OWNER' ? 'Community owner' : escapeHtml([user.college, user.course].filter(Boolean).join(' · ') || 'Member')}</span></div></a>`).join('') || '<p class="muted">No members yet.</p>';
    const action = document.querySelector('#community-membership'); if (item.membershipRole === 'OWNER') action.disabled = true; else action.addEventListener('click', async () => { action.disabled = true; try { await api(`/communities/${item.id}${item.joined ? '/leave' : '/join'}`, { method: item.joined ? 'DELETE' : 'POST' }); await load(); } catch (error) { message(error.message, true); action.disabled = false; } });
  };
  const load = async () => { try { const [item, list] = await Promise.all([api(`/communities/${encodeURIComponent(id)}`), api(`/communities/${encodeURIComponent(id)}/members`)]); render(item, list); } catch (error) { detail.innerHTML = `<div class="empty"><h2>Community unavailable</h2><p>${escapeHtml(error.message)}</p></div>`; } };
  if (!id) detail.innerHTML = '<div class="empty"><h2>Select a community</h2><p>Choose a community from the communities page.</p></div>'; else if (await requireAuthentication()) void load();
}
