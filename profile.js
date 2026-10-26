import('./frontend-api.js').then(async ({ api, avatarUrl, escapeHtml, mediaUrl, restoreSession }) => {
  const { actionFor, labelFor, stateFor } = await import('./connections-ui.js');
  const yearLabels = { FIRST: '1st year', SECOND: '2nd year', THIRD: '3rd year', FOURTH: '4th year', POSTGRADUATE: 'Postgraduate' };
  const yearValues = Object.fromEntries(Object.entries(yearLabels).map(([value, label]) => [label.toLowerCase(), value]));
  const splitList = (value) => [...new Set(value.split(',').map((item) => item.trim()).filter(Boolean))];

  try {
    const currentUser = await restoreSession();
    if (!currentUser) return window.location.assign('login.html');
    const viewedUserId = new URLSearchParams(window.location.search).get('id');
    let user = viewedUserId && viewedUserId !== currentUser.id ? await api(`/users/${encodeURIComponent(viewedUserId)}`) : currentUser;
    const isOwnProfile = user.id === currentUser.id;

    const renderProfile = () => {
      const heading = document.querySelector('.identity h1');
      if (heading?.firstChild) heading.firstChild.nodeValue = `${user.fullName} `;
      const identity = document.querySelector('.identity > p');
      if (identity) identity.textContent = [user.course, user.college, yearLabels[user.year]].filter(Boolean).join(' · ');
      const location = document.querySelector('.identity > small');
      if (location) location.textContent = [(isOwnProfile ? user.email : null), user.location].filter(Boolean).join(' · ') || 'CampusSphere member';
      document.querySelectorAll('.profile-image').forEach((image) => { image.src = avatarUrl(user, 120); image.alt = user.fullName; });
      const cover = document.querySelector('.profile-hero .cover');
      if (cover) { const coverUrl = mediaUrl(user.coverImage); cover.style.backgroundImage = coverUrl ? `url("${coverUrl.replaceAll('"','%22')}")` : ''; cover.classList.toggle('has-cover', Boolean(coverUrl)); }
      const about = document.querySelector('.about > p');
      if (about) about.textContent = user.bio || 'Tell your campus community about yourself.';
      const skills = document.querySelector('.skills');
      if (skills) skills.innerHTML = user.skills?.length ? user.skills.map((skill) => `<b>${escapeHtml(skill)}</b>`).join('') : '<span>No skills added yet.</span>';
      const interests = document.querySelector('.interests');
      if (interests) interests.textContent = user.interests?.length ? user.interests.join(' · ') : 'No interests added yet.';
    };

    renderProfile();
    const communityList = document.querySelector('.community-list');
    if (communityList) communityList.innerHTML = user.communities?.length ? user.communities.map((community) => `<a class="profile-community" href="community-details.html?id=${encodeURIComponent(community.id)}"><b>${escapeHtml(community.name)}</b><span>${escapeHtml(community.category)} · ${community._count?.members || 0} members · ${community.role.toLowerCase()}</span></a>`).join('') : '<span>No community memberships yet.</span>';
    try {
      const userProjects = await api(`/projects?userId=${encodeURIComponent(user.id)}`);
      const projectSection = [...document.querySelectorAll('.heading')].find((heading) => heading.querySelector('h2')?.textContent.trim() === 'Projects')?.closest('article');
      const projectCard = projectSection?.querySelector('.project');
      if (projectCard) projectCard.innerHTML = userProjects.length ? userProjects.slice(0, 3).map((project) => `<a class="project-link" href="project-details.html?id=${encodeURIComponent(project.id)}"><b class="project-icon">${escapeHtml(project.title.slice(0, 2).toUpperCase())}</b><div><h3>${escapeHtml(project.title)}</h3><p>${escapeHtml(project.description)}</p><span>${project.isOwner ? 'Project owner' : 'Project member'}</span></div></a>`).join('') : '<p>No projects shared yet.</p>';
    } catch (error) { console.warn(error.message); }
    const editButton = document.querySelector('.edit');
    const messageButton = document.querySelector('.profile-message');
    const rejectButton = document.querySelector('.connection-reject');
    const feedback = document.querySelector('#connection-feedback');
    const showFeedback = (message, isError = false) => {
      if (!feedback) return;
      feedback.textContent = message;
      feedback.style.color = isError ? '#a45151' : '';
      feedback.hidden = false;
    };
    const renderConnection = async () => {
      if (!editButton) return;
      if (isOwnProfile) {
        editButton.hidden = false;
        editButton.textContent = '✎ Edit profile';
        rejectButton.hidden = true;
        editButton.onclick = () => window.location.assign('settings.html');
        return;
      }
      const relationship = await stateFor(api, user.id);
      const { state, connection } = relationship;
      editButton.hidden = false;
      editButton.textContent = labelFor(state);
      if (rejectButton) rejectButton.hidden = state !== 'PENDING_RECEIVED';
      editButton.onclick = async () => {
        try {
          editButton.disabled = true;
          await actionFor(api, state, user.id, connection?.id);
          showFeedback(state === 'NONE' ? 'Connection request sent.' : state === 'PENDING_RECEIVED' ? 'Connection request accepted.' : 'Connection updated.');
          await renderConnection();
        } catch (error) { showFeedback(error instanceof Error ? error.message : 'Unable to update this connection.', true); }
        finally { editButton.disabled = false; }
      };
      if (rejectButton) rejectButton.onclick = async () => {
        try {
          rejectButton.disabled = true;
          await api(`/connections/${encodeURIComponent(connection.id)}/reject`, { method: 'PATCH' });
          showFeedback('Connection request rejected.');
          await renderConnection();
        } catch (error) { showFeedback(error instanceof Error ? error.message : 'Unable to reject this request.', true); }
        finally { rejectButton.disabled = false; }
      };
    };
    await renderConnection();
    const wirePhotoUpload = () => {
      if (!isOwnProfile) return;
      const triggers = [document.querySelector('.profile-image'), document.querySelector('.photo-row button')].filter(Boolean);
      if (!triggers.length) return;
      document.querySelector('.profile-image')?.classList.add('photo-change-trigger');
      const dialog = document.createElement('div'); dialog.className = 'photo-modal'; dialog.hidden = true;
      dialog.innerHTML = `<section role="dialog" aria-modal="true" aria-labelledby="photo-title"><button class="photo-close" type="button" aria-label="Close">×</button><h2 id="photo-title">Change profile photo</h2><img class="photo-preview" alt="Selected photo preview"><input class="photo-input" type="file" accept="image/jpeg,image/png,image/webp"><p class="photo-feedback" role="status"></p><div><button class="photo-cancel" type="button">Cancel</button><button class="photo-save" type="button" disabled>Upload photo</button></div></section>`;
      document.body.append(dialog);
      const input = dialog.querySelector('.photo-input'), preview = dialog.querySelector('.photo-preview'), save = dialog.querySelector('.photo-save'), feedback = dialog.querySelector('.photo-feedback'); let objectUrl;
      const close = () => { dialog.hidden = true; input.value = ''; save.disabled = true; feedback.textContent = ''; if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null; } };
      triggers.forEach((trigger) => trigger.addEventListener('click', () => { dialog.hidden = false; preview.src = avatarUrl(user, 160); input.focus(); }));
      input.addEventListener('change', () => { const file = input.files[0]; if (!file) return; if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) { feedback.textContent = 'Choose a JPEG, PNG, or WebP image up to 5 MB.'; save.disabled = true; return; } objectUrl = URL.createObjectURL(file); preview.src = objectUrl; feedback.textContent = ''; save.disabled = false; });
      save.addEventListener('click', async () => { const file = input.files[0]; if (!file) return; const body = new FormData(); body.append('avatar', file); try { save.disabled = true; save.textContent = 'Uploading…'; user = await api('/users/me/avatar', { method: 'POST', body }); const avatarField = document.querySelector('#profile-avatar'); if (avatarField) avatarField.value = user.avatar || ''; renderProfile(); document.querySelectorAll('[data-current-user-avatar], .account-trigger img, .account-summary img, .photo-row img').forEach((image) => { image.dataset.avatarFallback = 'false'; image.src = avatarUrl(user, 120); }); close(); } catch (error) { feedback.textContent = error.message; } finally { save.textContent = 'Upload photo'; if (!dialog.hidden) save.disabled = false; } });
      dialog.addEventListener('click', (event) => { if (event.target === dialog || event.target.closest('.photo-close,.photo-cancel')) close(); });
      document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !dialog.hidden) close(); });
    };
    wirePhotoUpload();
    if (isOwnProfile) {
      const cover = document.querySelector('.profile-hero .cover');
      const controls = document.createElement('div'); controls.className = 'cover-controls'; controls.innerHTML = '<button type="button" data-change-cover>Change cover</button><button type="button" data-remove-cover>Remove cover</button>'; cover.append(controls);
      const input = Object.assign(document.createElement('input'), { type: 'file', accept: 'image/jpeg,image/png,image/webp', hidden: true }); document.body.append(input);
      controls.querySelector('[data-change-cover]').addEventListener('click', () => input.click());
      input.addEventListener('change', async () => { const file=input.files[0]; if(!file)return; if(!input.accept.split(',').includes(file.type)||file.size>8*1024*1024)return showFeedback('Choose a JPEG, PNG, or WebP cover up to 8 MB.',true); const preview=URL.createObjectURL(file);cover.style.backgroundImage=`url("${preview}")`;cover.classList.add('has-cover');const body=new FormData();body.append('cover',file);const button=controls.querySelector('[data-change-cover]');button.disabled=true;try{user=await api('/users/me/cover',{method:'POST',body});renderProfile();showFeedback('Profile cover updated.')}catch(error){renderProfile();showFeedback(error.message,true)}finally{URL.revokeObjectURL(preview);button.disabled=false;input.value=''}});
      controls.querySelector('[data-remove-cover]').addEventListener('click', async () => { const button=controls.querySelector('[data-remove-cover]');button.disabled=true;try{user=await api('/users/me/cover',{method:'DELETE'});renderProfile();showFeedback('Profile cover removed.')}catch(error){showFeedback(error.message,true)}finally{button.disabled=false} });
    }
    if (messageButton) { messageButton.hidden = isOwnProfile; messageButton.onclick = async () => { try { const conversation = await api(`/conversations/direct/${encodeURIComponent(user.id)}`, { method: 'POST' }); window.location.assign(`messages.html?conversationId=${encodeURIComponent(conversation.id)}`); } catch (error) { showFeedback(error.message, true); } }; }

    const form = document.querySelector('#profile-settings-form');
    if (!form) return;
    if (!isOwnProfile) return window.location.assign('profile.html');
    const message = document.querySelector('#profile-message');
    const fields = {
      fullName: form.querySelector('#profile-full-name'), college: form.querySelector('#profile-college'),
      course: form.querySelector('#profile-course'), year: form.querySelector('#profile-year'),
      location: form.querySelector('#profile-location'), avatar: form.querySelector('#profile-avatar'),
      bio: form.querySelector('#profile-bio'), skills: form.querySelector('#profile-skills'), interests: form.querySelector('#profile-interests')
    };
    Object.values(fields).forEach((field) => { if (!field) throw new Error('Profile settings fields are unavailable.'); });
    fields.fullName.value = user.fullName || '';
    fields.college.value = user.college || '';
    fields.course.value = user.course || '';
    fields.year.value = yearLabels[user.year] || '3rd year';
    fields.location.value = user.location || '';
    fields.avatar.value = user.avatar || '';
    fields.bio.value = user.bio || '';
    fields.skills.value = (user.skills || []).join(', ');
    fields.interests.value = (user.interests || []).join(', ');

    const showMessage = (text, isError = false) => {
      message.textContent = text;
      message.hidden = false;
      message.classList.toggle('error', isError);
    };
    document.querySelector('#save')?.addEventListener('click', async (event) => {
      event.preventDefault();
      const button = event.currentTarget;
      const year = yearValues[fields.year.value.trim().toLowerCase()];
      if (!fields.fullName.value.trim() || !year) return showMessage('Enter your full name and select a valid year.', true);
      const payload = {
        fullName: fields.fullName.value.trim(), college: fields.college.value.trim() || null,
        course: fields.course.value.trim() || null, year, location: fields.location.value.trim() || null,
        avatar: fields.avatar.value.trim() || null, bio: fields.bio.value.trim() || null,
        skills: splitList(fields.skills.value), interests: splitList(fields.interests.value)
      };
      try {
        button.disabled = true;
        button.textContent = 'Saving...';
        user = await api('/users/me', { method: 'PATCH', body: JSON.stringify(payload) });
        renderProfile();
        showMessage('Profile saved. Your updates will remain after refresh.');
      } catch (error) {
        showMessage(error instanceof Error ? error.message : 'Unable to save your profile.', true);
      } finally {
        button.disabled = false;
        button.textContent = 'Save changes';
      }
    });
  } catch (error) {
    console.warn(error.message);
  }
});
