import('./frontend-api.js').then(async ({ api, avatarUrl, escapeHtml, restoreSession }) => {
  const { actionFor, labelFor, stateFor } = await import('./connections-ui.js');
  const search = document.querySelector('#student-search');
  const globalSearch = document.querySelector('#global-student-search');
  const grid = document.querySelector('#student-grid');
  const count = document.querySelector('#count');
  const tabCount = document.querySelector('#tab-count');
  const status = document.querySelector('#discover-status');
  const empty = document.querySelector('.empty');
  const yearLabels = { FIRST: '1st year', SECOND: '2nd year', THIRD: '3rd year', FOURTH: '4th year', POSTGRADUATE: 'Postgraduate' };
  let currentUser;
  let requestVersion = 0;
  let debounceTimer;
  const filters = document.querySelector('#filters');
  filters.querySelectorAll('.filter').forEach(node => node.remove());
  filters.insertAdjacentHTML('beforeend', `<label class="filter"><strong>Course</strong><input id="discover-course" placeholder="Course name"></label><label class="filter"><strong>Year</strong><select id="discover-year"><option value="">Any year</option><option value="FIRST">1st year</option><option value="SECOND">2nd year</option><option value="THIRD">3rd year</option><option value="FOURTH">4th year</option><option value="POSTGRADUATE">Postgraduate</option></select></label><label class="filter"><strong>Skill</strong><input id="discover-skill" placeholder="React, design..."></label><label class="filter"><strong>Role</strong><select id="discover-role"><option value="">Any role</option><option value="STUDENT">Student</option><option value="TEACHER">Teacher</option><option value="COLLEGE_ADMIN">College admin</option></select></label>`);
  const filterControls = ['discover-course','discover-year','discover-skill','discover-role'].map(id => document.querySelector(`#${id}`));

  const setStatus = (message) => { status.textContent = message; };
  const updateCount = (value) => { count.textContent = value; tabCount.textContent = value; };
  const openProfile = (id) => window.location.assign(`profile.html?id=${encodeURIComponent(id)}`);
  const render = (users, relationships) => {
    grid.innerHTML = users.map((user) => {
      const relationship = relationships.get(user.id) || { state: 'NONE', connection: null };
      const pendingReceived = relationship.state === 'PENDING_RECEIVED';
      return `<article data-user-id="${user.id}" tabindex="0" role="link" aria-label="View ${escapeHtml(user.fullName)}'s profile"><div class="cover violet"></div><img class="avatar" src="${avatarUrl(user, 90)}" alt="${escapeHtml(user.fullName)}"><div class="card-body"><h2>${escapeHtml(user.fullName)}</h2><p>${escapeHtml(user.course || 'Campus member')}${user.year ? ` · ${yearLabels[user.year]}` : ''}</p><small>${escapeHtml(user.college || 'CampusSphere')}</small><div class="skills">${user.skills?.length ? user.skills.slice(0, 3).map((skill) => `<b>${escapeHtml(skill)}</b>`).join('') : '<span>No skills listed</span>'}</div><div class="mutual">${relationship.state === 'CONNECTED' ? 'You are connected' : 'CampusSphere member'}</div><button class="connect" type="button" data-connection-action data-state="${relationship.state}" data-connection-id="${relationship.connection?.id || ''}">${labelFor(relationship.state)}</button>${pendingReceived ? '<button class="more" type="button" data-connection-reject>Decline</button>' : ''}</div></article>`;
    }).join('');
    grid.setAttribute('aria-busy', 'false');
    updateCount(users.length);
    empty.hidden = users.length !== 0;
    grid.hidden = users.length === 0;
    setStatus(users.length ? `${users.length} registered students loaded.` : 'No registered students matched your search.');
  };
  const loadUsers = async () => {
    const version = ++requestVersion;
    const query = search.value.trim();
    grid.setAttribute('aria-busy', 'true');
    empty.hidden = true;
    setStatus(query ? 'Searching registered students…' : 'Loading registered students…');
    try {
      const params = new URLSearchParams({ limit: '20' }); if (query) params.set('q', query); ['course','year','skill','role'].forEach((key,index) => { if (filterControls[index].value.trim()) params.set(key, filterControls[index].value.trim()); });
      const users = await api(`/users/search?${params}`);
      const visible = users.filter((user) => user.id !== currentUser.id);
      const relationshipEntries = await Promise.all(visible.map(async (user) => [user.id, await stateFor(api, user.id)]));
      if (version !== requestVersion) return;
      render(visible, new Map(relationshipEntries));
    } catch (error) {
      if (version !== requestVersion) return;
      grid.innerHTML = '';
      grid.hidden = true;
      grid.setAttribute('aria-busy', 'false');
      updateCount(0);
      empty.hidden = false;
      empty.querySelector('h2').textContent = 'Unable to load students';
      empty.querySelector('p').textContent = error instanceof Error ? error.message : 'Please try again.';
      setStatus('Unable to load registered students.');
    }
  };
  const scheduleSearch = (value) => {
    search.value = value;
    if (globalSearch) globalSearch.value = value;
    window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => { void loadUsers(); }, 250);
  };
  const clearSearch = () => { search.value = ''; if (globalSearch) globalSearch.value = ''; filterControls.forEach(control => control.value = ''); void loadUsers(); };

  try {
    currentUser = await restoreSession();
    if (!currentUser) return window.location.assign('login.html');
    search.addEventListener('input', () => scheduleSearch(search.value));
    search.addEventListener('search', () => void loadUsers());
    globalSearch?.addEventListener('input', () => scheduleSearch(globalSearch.value));
    globalSearch?.addEventListener('search', () => void loadUsers());
    filterControls.forEach(control => control.addEventListener(control.tagName === 'INPUT' ? 'input' : 'change', () => scheduleSearch(search.value)));
    document.querySelector('#clear-filters')?.addEventListener('click', clearSearch);
    document.querySelector('#empty-clear')?.addEventListener('click', clearSearch);
    document.querySelector('#filter-toggle')?.addEventListener('click', () => document.querySelector('#filters')?.classList.toggle('show'));
    grid.addEventListener('click', async (event) => {
      const card = event.target.closest('[data-user-id]');
      if (!card) return;
      const reject = event.target.closest('[data-connection-reject]');
      const action = event.target.closest('[data-connection-action]');
      if (!reject && !action) return openProfile(card.dataset.userId);
      try {
        if (reject) await api(`/connections/${encodeURIComponent(card.querySelector('[data-connection-id]').dataset.connectionId)}/reject`, { method: 'PATCH' });
        else await actionFor(api, action.dataset.state, card.dataset.userId, action.dataset.connectionId);
        await loadUsers();
      } catch (error) { setStatus(error instanceof Error ? error.message : 'Unable to update this connection.'); }
    });
    grid.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { const card = event.target.closest('[data-user-id]'); if (card) { event.preventDefault(); openProfile(card.dataset.userId); } } });
    await loadUsers();
  } catch (error) {
    grid.setAttribute('aria-busy', 'false');
    setStatus('Please sign in again to discover students.');
  }
});
