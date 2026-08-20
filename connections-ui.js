export const stateFor = async (api, userId) => api(`/connections/status/${encodeURIComponent(userId)}`);

export const actionFor = async (api, state, userId, connectionId) => {
  if (state === 'NONE') return api(`/connections/${encodeURIComponent(userId)}`, { method: 'POST' });
  if (state === 'PENDING_RECEIVED') return api(`/connections/${encodeURIComponent(connectionId)}/accept`, { method: 'PATCH' });
  if (state === 'PENDING_SENT' || state === 'CONNECTED') return api(`/connections/${encodeURIComponent(connectionId)}`, { method: 'DELETE' });
  return null;
};

export const labelFor = (state) => ({ NONE: 'Connect', PENDING_SENT: 'Cancel request', PENDING_RECEIVED: 'Accept request', CONNECTED: 'Remove connection' }[state] || 'Connect');
