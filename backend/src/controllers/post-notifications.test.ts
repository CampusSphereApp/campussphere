import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RequestHandler } from 'express';
const db = vi.hoisted(() => ({
  post: { findUnique: vi.fn(), create: vi.fn() }, postLike: { createMany: vi.fn() }, comment: { create: vi.fn() },
  communityMember: { findUnique: vi.fn(), findMany: vi.fn() },
  user: { findUnique: vi.fn(), findMany: vi.fn() }, notification: { create: vi.fn(), createMany: vi.fn() }, $transaction: vi.fn()
}));
vi.mock('../config/prisma.js', () => ({ prisma: db }));
import { comment, createPost, likePost } from './post.controller.js';
const invoke = async (handler: RequestHandler, body: Record<string, unknown> = {}) => {
  const response = { status: vi.fn(), send: vi.fn(), json: vi.fn() }; response.status.mockReturnValue(response);
  const next = vi.fn(); await handler({ auth: { sub: 'viewer' }, params: { id: 'post' }, body } as never, response as never, next);
  return next.mock.calls[0]?.[0];
};
beforeEach(() => {
  vi.resetAllMocks(); db.$transaction.mockImplementation(fn => fn(db));
  db.post.findUnique.mockResolvedValue({ id: 'post', authorId: 'owner' });
  db.user.findUnique.mockResolvedValue({ notificationPreferences: null });
});
describe('social and community notifications', () => {
  it('notifies a post owner only when a new like is created', async () => {
    db.postLike.createMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    expect(await invoke(likePost)).toBeUndefined(); expect(await invoke(likePost)).toBeUndefined();
    expect(db.notification.create).toHaveBeenCalledTimes(1);
  });
  it('keeps a like when its owner has disabled social notifications', async () => {
    db.postLike.createMany.mockResolvedValue({ count: 1 }); db.user.findUnique.mockResolvedValue({ notificationPreferences: { socialActivity: false } });
    expect(await invoke(likePost)).toBeUndefined(); expect(db.postLike.createMany).toHaveBeenCalled(); expect(db.notification.create).not.toHaveBeenCalled();
  });
  it('does not send notifications for likes on the viewer own posts', async () => {
    db.post.findUnique.mockResolvedValue({ id: 'post', authorId: 'viewer' }); db.postLike.createMany.mockResolvedValue({ count: 1 });
    expect(await invoke(likePost)).toBeUndefined(); expect(db.notification.create).not.toHaveBeenCalled();
  });
  it('persists comments and notifies their recipient in one transaction', async () => {
    db.comment.create.mockResolvedValue({ id: 'comment', content: 'A useful comment' });
    expect(await invoke(comment, { content: 'A useful comment' })).toBeUndefined();
    expect(db.notification.create.mock.calls[0][0].data).toMatchObject({ userId: 'owner', data: { postId: 'post', commentId: 'comment' } });
  });
  it('requires community membership before posting or notifying members', async () => {
    db.communityMember.findUnique.mockResolvedValue(null);
    expect(await invoke(createPost, { communityId: 'club', content: 'A club discussion' })).toMatchObject({ code: 'FORBIDDEN' });
    expect(db.post.create).not.toHaveBeenCalled(); expect(db.notification.createMany).not.toHaveBeenCalled();
  });
  it('sends community notifications only to existing members with notifications enabled', async () => {
    db.communityMember.findUnique.mockResolvedValue({ userId: 'viewer' });
    db.post.create.mockResolvedValue({ id: 'post', community: { name: 'Club' } });
    db.communityMember.findMany.mockResolvedValue([{ userId: 'member-1' }, { userId: 'member-2' }]);
    db.user.findMany.mockResolvedValue([{ id: 'member-1', notificationPreferences: null }, { id: 'member-2', notificationPreferences: { communities: false } }]);
    expect(await invoke(createPost, { communityId: 'club', content: 'A club discussion' })).toBeUndefined();
    expect(db.notification.createMany.mock.calls[0][0].data).toHaveLength(1);
    expect(db.notification.createMany.mock.calls[0][0].data[0].userId).toBe('member-1');
  });
});
