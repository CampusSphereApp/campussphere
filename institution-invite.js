import { api, restoreSession, workspaceUrl } from './frontend-api.js?v=wit-admin-1';
const area = document.querySelector('#invite-state'); const token = new URLSearchParams(location.search).get('token'); const user = await restoreSession();
if (!token) area.innerHTML = '<b>Invitation link is incomplete.</b><p>Ask your college administrator for a new link.</p>';
else if (!user) { const next = encodeURIComponent(location.href); area.innerHTML = `<b>Sign in to continue</b><p><a href="login.html?next=${next}">Sign in with the invited email</a></p>`; }
else { try { const result = await api('/academic/institution/invitations/accept', { method: 'POST', body: JSON.stringify({ token }) }); area.innerHTML = `<b>Welcome to ${result.college.shortName}</b><p>Your academic workspace is now active. <a href="${workspaceUrl(result.user.role)}">Continue</a></p>`; } catch (error) { area.innerHTML = `<b>Invitation could not be accepted</b><p>${error.message}</p>`; } }
