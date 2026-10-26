import type { RequestHandler } from 'express';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const db = vi.hoisted(() => ({ user: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn(), update: vi.fn() }, connection: { findFirst: vi.fn() }, $transaction: vi.fn() }));
vi.mock('../config/prisma.js', () => ({ prisma: db }));
import { getSettings, getUser, listUsers, removeCover, updateCover, updateSettings } from './user.controller.js';
import { settingsDefaults } from '../utils/settings.js';
const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'campussphere-upload-test-'));
afterAll(() => { for (const name of fs.readdirSync(folder)) fs.unlinkSync(path.join(folder, name)); fs.rmdirSync(folder); });
const user = () => ({ id: 'owner', fullName: 'Test Member', email: 'member@example.invalid', college: 'College', course: 'CS', skills: [{ skill: { name: 'JavaScript' } }], interests: [{ interest: { name: 'Design' } }], communityMemberships: [], privacySettings: null, notificationPreferences: null, appearanceSettings: null, avatar: null, coverImage: null });
const invoke = async (handler: RequestHandler, request: Record<string, unknown> = {}) => {
  const response = { json: vi.fn(), status: vi.fn() };
  response.status.mockReturnValue(response);
  const next = vi.fn();
  await handler({ auth: { sub: 'viewer' }, body: {}, params: {}, query: {}, ...request } as never, response as never, next);
  return { response, error: next.mock.calls[0]?.[0], payload: response.json.mock.calls[0]?.[0] };
};
beforeEach(() => {
  vi.resetAllMocks();
  db.$transaction.mockImplementation(async value => typeof value === 'function' ? value(db) : Promise.all(value));
});
describe('profile settings controllers', () => {
  it('returns complete defaults for an account with no saved settings', async () => {
    db.user.findUnique.mockResolvedValue(user());
    const { payload, error } = await invoke(getSettings);
    expect(error).toBeUndefined(); expect(payload.data).toEqual(settingsDefaults);
  });
  it.each([null, {}, { appearanceSettings: null }, { privacySettings: { profileVisibility: 'PRIVATE' } }, { userId: 'other', appearanceSettings: settingsDefaults.appearanceSettings }])('rejects malformed settings before writing %j', async body => {
    const { error } = await invoke(updateSettings, { body });
    expect(error).toBeDefined(); expect(db.user.update).not.toHaveBeenCalled();
  });
  it('only updates the authenticated account and returns all preference sections', async () => {
    db.user.update.mockResolvedValue({ ...user(), appearanceSettings: settingsDefaults.appearanceSettings });
    const { payload, error } = await invoke(updateSettings, { body: { appearanceSettings: settingsDefaults.appearanceSettings } });
    expect(error).toBeUndefined();
    expect(db.user.update.mock.calls[0][0].where).toEqual({ id: 'viewer' });
    expect(payload.data.notificationPreferences.messages).toBe(true);
  });
  it('paginates beyond the former 100-user cutoff and retains string skill names', async () => {
    db.user.findMany.mockResolvedValue([user()]); db.user.count.mockResolvedValue(145);
    const { payload, error } = await invoke(listUsers, { query: { page: '6', limit: '20', skill: 'JavaScript' } });
    expect(error).toBeUndefined(); expect(payload.data[0].skills).toEqual(['JavaScript']);
    expect(payload.pagination).toEqual({ page: 6, limit: 20, total: 145, totalPages: 8 });
    expect(db.user.findMany.mock.calls[0][0]).toMatchObject({ skip: 100, take: 20 });
    expect(db.user.count.mock.calls[0][0].where).toEqual(db.user.findMany.mock.calls[0][0].where);
  });
  it('hides private profiles from other users but shows owners their full details', async () => {
    db.user.findUnique.mockResolvedValue({ ...user(), privacySettings: { profileVisibility: 'PRIVATE', showCollege: false } });
    expect((await invoke(getUser, { params: { id: 'owner' } })).error).toMatchObject({ code: 'USER_NOT_FOUND' });
    const own = await invoke(getUser, { auth: { sub: 'owner' }, params: { id: 'owner' } });
    expect(own.payload.data.college).toBe('College'); expect(own.payload.data.email).toBe('member@example.invalid');
  });
});
describe('cover upload cleanup', () => {
  const upload = (name: string, bytes: Buffer, mimetype = 'image/png') => {
    const file = path.join(folder, name); fs.writeFileSync(file, bytes);
    return { path: file, filename: name, mimetype };
  };
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  it('removes invalid images without changing the existing profile', async () => {
    const file = upload('invalid.png', Buffer.from('<script>not an image</script>'));
    const { error } = await invoke(updateCover, { file });
    expect(error).toMatchObject({ code: 'INVALID_COVER' });
    expect(fs.existsSync(file.path)).toBe(false); expect(db.user.update).not.toHaveBeenCalled();
  });
  it('rejects a valid image header served under the wrong image MIME type', async () => {
    const file = upload('mismatch.jpg', png, 'image/jpeg');
    expect((await invoke(updateCover, { file })).error).toMatchObject({ code: 'INVALID_COVER' });
    expect(fs.existsSync(file.path)).toBe(false);
  });
  it('removes the new upload after a database failure', async () => {
    const file = upload('failed.png', png); db.user.findUnique.mockResolvedValue({ avatar: null, coverImage: null });
    db.user.update.mockRejectedValue(new Error('Database unavailable'));
    expect((await invoke(updateCover, { file })).error.message).toBe('Database unavailable');
    expect(fs.existsSync(file.path)).toBe(false);
  });
  it('keeps a valid upload after saving its URL', async () => {
    const file = upload('valid.png', png); db.user.findUnique.mockResolvedValue({ avatar: null, coverImage: null });
    db.user.update.mockResolvedValue({ ...user(), coverImage: '/uploads/covers/valid.png' });
    const { payload, error } = await invoke(updateCover, { file });
    expect(error).toBeUndefined(); expect(payload.data.coverImage).toBe('/uploads/covers/valid.png');
    expect(fs.existsSync(file.path)).toBe(true);
  });
  it('clears the cover without treating external image URLs as local paths', async () => {
    db.user.findUnique.mockResolvedValue({ coverImage: 'https://example.invalid/cover.png' }); db.user.update.mockResolvedValue(user());
    const { payload, error } = await invoke(removeCover);
    expect(error).toBeUndefined(); expect(payload.data.coverImage).toBeNull();
    expect(db.user.update.mock.calls[0][0].data).toEqual({ coverImage: null });
  });
});
