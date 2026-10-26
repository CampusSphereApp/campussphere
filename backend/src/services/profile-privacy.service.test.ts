import { beforeEach, describe, expect, it, vi } from 'vitest';
const db = vi.hoisted(() => ({ connection: { findFirst: vi.fn() } }));
vi.mock('../config/prisma.js', () => ({ prisma: db }));
import { canViewProfile, redactProfileFields } from './profile-privacy.service.js';

beforeEach(() => vi.clearAllMocks());
describe('profile privacy', () => {
  it('lets owners view their own private profile', async () => {
    await expect(canViewProfile({ id: 'owner', privacySettings: { profileVisibility: 'PRIVATE' } }, 'owner')).resolves.toBe(true);
    expect(db.connection.findFirst).not.toHaveBeenCalled();
  });
  it('hides private profiles from other members', async () => {
    await expect(canViewProfile({ id: 'owner', privacySettings: { profileVisibility: 'PRIVATE' } }, 'viewer')).resolves.toBe(false);
  });
  it('checks accepted connections before showing a connections-only profile', async () => {
    db.connection.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'connection' });
    const user = { id: 'owner', privacySettings: { profileVisibility: 'CONNECTIONS' } };
    await expect(canViewProfile(user, 'viewer')).resolves.toBe(false);
    await expect(canViewProfile(user, 'viewer')).resolves.toBe(true);
    expect(db.connection.findFirst.mock.calls[0][0].where.status).toBe('ACCEPTED');
  });
  it('redacts hidden details without exposing settings or modifying the source', () => {
    const user = { id: 'owner', college: 'College', course: 'CS', year: 'FIRST', skills: ['JavaScript'], interests: ['Design'], communities: [{ id: 'club' }], privacySettings: { showCollege: false, showCourseYear: false, showSkillsInterests: false, showActivity: false } };
    expect(redactProfileFields(user, 'viewer')).toEqual({ id: 'owner', college: null, course: null, year: null, skills: [], interests: [], communities: [] });
    expect(redactProfileFields(user, 'owner').college).toBe('College');
    expect(user.skills).toEqual(['JavaScript']);
  });
});
