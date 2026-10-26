import { beforeEach, describe, expect, it, vi } from 'vitest';
const db = vi.hoisted(() => ({ user: { findUnique: vi.fn(), update: vi.fn() } }));
const password = vi.hoisted(() => ({ compare: vi.fn(), hash: vi.fn() }));
vi.mock('../config/prisma.js', () => ({ prisma: db }));
vi.mock('bcryptjs', () => ({ default: password }));
import { changePassword } from './auth.controller.js';
const invoke = async (body: unknown = { currentPassword: 'current-password', newPassword: 'new-password' }) => {
  const response = { json: vi.fn(), clearCookie: vi.fn() }; const next = vi.fn();
  await changePassword({ auth: { sub: 'owner' }, body } as never, response as never, next);
  return { response, error: next.mock.calls[0]?.[0] };
};
beforeEach(() => { vi.resetAllMocks(); db.user.findUnique.mockResolvedValue({ googleSub: null, passwordHash: 'old-hash' }); });
describe('password changes', () => {
  it('rejects malformed requests before reading or updating an account', async () => {
    expect((await invoke(null)).error).toBeDefined(); expect(db.user.update).not.toHaveBeenCalled();
  });
  it('rejects a wrong current password', async () => {
    password.compare.mockResolvedValue(false);
    expect((await invoke()).error).toMatchObject({ code: 'CURRENT_PASSWORD_INCORRECT' });
    expect(db.user.update).not.toHaveBeenCalled();
  });
  it('rejects reusing the existing password', async () => {
    password.compare.mockResolvedValue(true);
    expect((await invoke()).error).toMatchObject({ code: 'PASSWORD_UNCHANGED' }); expect(db.user.update).not.toHaveBeenCalled();
  });
  it('keeps Google-managed accounts on the Google sign-in flow', async () => {
    db.user.findUnique.mockResolvedValue({ googleSub: 'google-id', passwordHash: 'old-hash' });
    expect((await invoke()).error).toMatchObject({ code: 'GOOGLE_ACCOUNT' }); expect(db.user.update).not.toHaveBeenCalled();
  });
  it('saves a hash and invalidates refresh sessions without returning credentials', async () => {
    password.compare.mockResolvedValueOnce(true).mockResolvedValueOnce(false); password.hash.mockResolvedValue('new-hash');
    db.user.update.mockResolvedValue({ id: 'owner' });
    const { response, error } = await invoke(); expect(error).toBeUndefined();
    expect(db.user.update.mock.calls[0][0]).toMatchObject({ where: { id: 'owner' }, data: { passwordHash: 'new-hash', refreshTokenHash: null } });
    expect(response.clearCookie).toHaveBeenCalledWith('refreshToken', expect.objectContaining({ httpOnly: true }));
    expect(JSON.stringify(response.json.mock.calls)).not.toContain('new-hash');
  });
});
