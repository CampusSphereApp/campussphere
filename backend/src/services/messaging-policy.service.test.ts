import { beforeEach, describe, expect, it, vi } from 'vitest';
const db = vi.hoisted(() => ({ user: { findUnique: vi.fn() }, connection: { findFirst: vi.fn() }, opportunityApplication: { findFirst: vi.fn() } }));
vi.mock('../config/prisma.js', () => ({ prisma: db }));
import { assertCanMessage } from './messaging-policy.service.js';
beforeEach(() => {
  vi.resetAllMocks();
  db.user.findUnique.mockResolvedValue({ privacySettings: null });
  db.connection.findFirst.mockResolvedValue(null);
  db.opportunityApplication.findFirst.mockResolvedValue(null);
});
describe('messaging policy', () => {
  it('allows accepted connections', async () => {
    db.connection.findFirst.mockResolvedValue({ status: 'ACCEPTED' });
    await expect(assertCanMessage('sender', 'recipient')).resolves.toBeUndefined();
  });
  it('allows accepted collaborators with the default policy', async () => {
    db.opportunityApplication.findFirst.mockResolvedValue({ id: 'collaboration' });
    await expect(assertCanMessage('sender', 'recipient')).resolves.toBeUndefined();
  });
  it('rejects a collaborator after the recipient changes to connections only', async () => {
    db.user.findUnique.mockResolvedValue({ privacySettings: { messagesFrom: 'CONNECTIONS' } });
    db.opportunityApplication.findFirst.mockResolvedValue({ id: 'collaboration' });
    await expect(assertCanMessage('sender', 'recipient')).rejects.toMatchObject({ code: 'MESSAGING_RESTRICTED' });
  });
  it('denies blocked members even when a collaboration exists', async () => {
    db.connection.findFirst.mockResolvedValue({ status: 'BLOCKED' });
    db.opportunityApplication.findFirst.mockResolvedValue({ id: 'collaboration' });
    await expect(assertCanMessage('sender', 'recipient')).rejects.toMatchObject({ code: 'MESSAGING_RESTRICTED' });
  });
  it('denies unsolicited messages and missing recipients', async () => {
    await expect(assertCanMessage('sender', 'recipient')).rejects.toMatchObject({ code: 'RELATIONSHIP_REQUIRED' });
    db.user.findUnique.mockResolvedValue(null);
    await expect(assertCanMessage('sender', 'recipient')).rejects.toMatchObject({ code: 'USER_NOT_FOUND' });
  });
});
