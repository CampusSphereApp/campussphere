import { describe, expect, it, vi } from 'vitest';
import { createPreferredNotification, createPreferredNotifications, shouldNotify } from './notification-preference.service.js';

describe('notification preferences', () => {
  it('suppresses an explicitly disabled category', async () => {
    const db = { user: { findUnique: vi.fn().mockResolvedValue({ notificationPreferences: { connections: false } }) } };
    await expect(shouldNotify('user-1', 'connections', db as never)).resolves.toBe(false);
  });

  it('preserves delivery when the preference has not been configured', async () => {
    const db = { user: { findUnique: vi.fn().mockResolvedValue({ notificationPreferences: null }) } };
    await expect(shouldNotify('user-1', 'connections', db as never)).resolves.toBe(true);
  });
});

describe('notification delivery', () => {
  it('suppresses notification creation for disabled categories', async () => {
    const db = { user: { findUnique: vi.fn().mockResolvedValue({ notificationPreferences: { messages: false } }) }, notification: { create: vi.fn() } };
    await expect(createPreferredNotification('user-1', 'messages', { userId: 'user-1', type: 'MESSAGE', title: 'New message', message: 'New activity' }, db as never)).resolves.toBeNull();
    expect(db.notification.create).not.toHaveBeenCalled();
  });
  it('does not create notifications for deleted accounts or mismatched recipients', async () => {
    const db = { user: { findUnique: vi.fn().mockResolvedValue(null) }, notification: { create: vi.fn() } };
    await expect(shouldNotify('deleted', 'messages', db as never)).resolves.toBe(false);
    await expect(createPreferredNotification('owner', 'messages', { userId: 'other', type: 'MESSAGE', title: 'New message', message: 'New activity' }, db as never)).rejects.toThrow('recipient');
  });
  it('delivers a fan-out only to enabled existing recipients', async () => {
    const db = { user: { findMany: vi.fn().mockResolvedValue([{ id: 'enabled', notificationPreferences: null }, { id: 'disabled', notificationPreferences: { events: false } }]) }, notification: { createMany: vi.fn().mockResolvedValue({ count: 1 }) } };
    await expect(createPreferredNotifications(['enabled', 'disabled', 'deleted', 'enabled'], 'events', { type: 'EVENT_REMINDER', title: 'Event updated', message: 'Details changed' }, db as never)).resolves.toEqual({ count: 1 });
    expect(db.notification.createMany.mock.calls[0][0].data).toEqual([{ userId: 'enabled', type: 'EVENT_REMINDER', title: 'Event updated', message: 'Details changed' }]);
  });
});
