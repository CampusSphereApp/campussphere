import { Router } from 'express';
import { ConnectionStatus } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { authenticate } from '../middleware/authenticate.js';
import { asyncHandler } from '../utils/async-handler.js';
import { AppError } from '../utils/app-error.js';

export const notificationRouter = Router();
notificationRouter.use(authenticate);
const present = async (item: any, userId: string) => {
  const data = (item.data || {}) as Record<string, unknown>;
  if (item.type === 'CONNECTION_REQUEST' && typeof data.connectionId === 'string') {
    const connection = await prisma.connection.findUnique({ where: { id: data.connectionId }, select: { requesterId: true, recipientId: true, status: true } });
    const actionable = Boolean(connection && connection.recipientId === userId && connection.status === ConnectionStatus.PENDING);
    return { ...item, actionable, resolved: !actionable, target: connection ? { kind: 'profile', userId: connection.requesterId } : null };
  }
  if (typeof data.conversationId === 'string') return { ...item, actionable: false, resolved: false, target: { kind: 'message', conversationId: data.conversationId } };
  if (typeof data.communityId === 'string') return { ...item, actionable: false, resolved: false, target: { kind: 'community', communityId: data.communityId } };
  if (typeof data.eventId === 'string') return { ...item, actionable: false, resolved: false, target: { kind: 'event', eventId: data.eventId } };
  if (typeof data.postId === 'string') return { ...item, actionable: false, resolved: false, target: { kind: 'social' } };
  const projectId = typeof data.projectId === 'string' ? data.projectId : null, opportunityId = typeof data.opportunityId === 'string' ? data.opportunityId : null;
  return { ...item, actionable: false, resolved: false, target: opportunityId ? { kind: 'opportunity', opportunityId } : projectId ? { kind: 'project', projectId } : null };
};
notificationRouter.get('/', asyncHandler(async (req, res) => { const items = await prisma.notification.findMany({ where: { userId: req.auth!.sub }, orderBy: { createdAt: 'desc' }, take: 50 }); res.json({ success: true, data: await Promise.all(items.map((item) => present(item, req.auth!.sub)) ) }); }));
notificationRouter.get('/unread-count', asyncHandler(async (req, res) => { const count = await prisma.notification.count({ where: { userId: req.auth!.sub, read: false } }); res.json({ success: true, data: { count } }); }));
notificationRouter.patch('/read-all', asyncHandler(async (req, res) => { await prisma.notification.updateMany({ where: { userId: req.auth!.sub, read: false }, data: { read: true } }); res.status(204).send(); }));
notificationRouter.patch('/:id/read', asyncHandler(async (req, res) => { const result = await prisma.notification.updateMany({ where: { id: String(req.params.id), userId: req.auth!.sub }, data: { read: true } }); if (!result.count) throw new AppError(404, 'NOTIFICATION_NOT_FOUND', 'Notification not found.'); res.status(204).send(); }));
notificationRouter.delete('/:id', asyncHandler(async (req, res) => { const result = await prisma.notification.deleteMany({ where: { id: String(req.params.id), userId: req.auth!.sub } }); if (!result.count) throw new AppError(404, 'NOTIFICATION_NOT_FOUND', 'Notification not found.'); res.status(204).send(); }));
