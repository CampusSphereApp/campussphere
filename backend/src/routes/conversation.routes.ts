import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { authenticate } from '../middleware/authenticate.js';
import { asyncHandler } from '../utils/async-handler.js';
import { AppError } from '../utils/app-error.js';
import { assertCanMessage } from '../services/messaging-policy.service.js';
import { createPreferredNotifications } from '../services/notification-preference.service.js';
import { io } from '../realtime.js';

export const conversationRouter = Router();
conversationRouter.use(authenticate);
const member = async (id: string, userId: string) => {
  const membership = await prisma.conversationMember.findUnique({ where: { conversationId_userId: { conversationId: id, userId } } });
  if (!membership) throw new AppError(403, 'FORBIDDEN', 'You are not a conversation member.');
};
conversationRouter.get('/', asyncHandler(async (req, res) => {
  const data = await prisma.conversation.findMany({ where: { members: { some: { userId: req.auth!.sub } } }, include: {
    members: { include: { user: { select: { id: true, fullName: true, avatar: true } } } },
    messages: { take: 1, orderBy: { createdAt: 'desc' }, include: { sender: { select: { id: true, fullName: true } } } },
    _count: { select: { messages: { where: { senderId: { not: req.auth!.sub }, readAt: null } } } }
  }, orderBy: { updatedAt: 'desc' } });
  res.json({ success: true, data });
}));
conversationRouter.get('/unread-count', asyncHandler(async (req, res) => {
  const count = await prisma.message.count({ where: { conversation: { members: { some: { userId: req.auth!.sub } } }, senderId: { not: req.auth!.sub }, readAt: null } });
  res.json({ success: true, data: { count } });
}));
conversationRouter.post('/direct/:userId', asyncHandler(async (req, res) => {
  const peer = String(req.params.userId);
  await assertCanMessage(req.auth!.sub, peer);
  const found = await prisma.conversation.findFirst({ where: {
    AND: [{ members: { some: { userId: req.auth!.sub } } }, { members: { some: { userId: peer } } }],
    members: { every: { userId: { in: [req.auth!.sub, peer] } } }
  }, include: { members: true } });
  const data = found || await prisma.conversation.create({ data: { members: { create: [{ userId: req.auth!.sub }, { userId: peer }] } }, include: { members: true } });
  res.status(found ? 200 : 201).json({ success: true, data });
}));
conversationRouter.get('/:id/messages', asyncHandler(async (req, res) => {
  const id = String(req.params.id);
  await member(id, req.auth!.sub);
  const limit = z.coerce.number().int().min(1).max(50).default(20).parse(req.query.limit);
  const data = await prisma.message.findMany({ where: { conversationId: id }, take: limit, orderBy: { createdAt: 'desc' }, include: { sender: { select: { id: true, fullName: true, avatar: true } } } });
  await prisma.message.updateMany({ where: { conversationId: id, senderId: { not: req.auth!.sub }, readAt: null }, data: { readAt: new Date() } });
  res.json({ success: true, data: data.reverse() });
}));
conversationRouter.post('/:id/messages', asyncHandler(async (req, res) => {
  const id = String(req.params.id);
  const { content } = z.object({ content: z.string().trim().min(1).max(5000) }).parse(req.body);
  await member(id, req.auth!.sub);
  const recipients = await prisma.conversationMember.findMany({ where: { conversationId: id, userId: { not: req.auth!.sub } }, select: { userId: true } });
  const data = await prisma.$transaction(async tx => {
    for (const recipient of recipients) await assertCanMessage(req.auth!.sub, recipient.userId, tx);
    const message = await tx.message.create({ data: { conversationId: id, senderId: req.auth!.sub, content }, include: { sender: { select: { id: true, fullName: true, avatar: true } } } });
    await tx.conversation.update({ where: { id }, data: { updatedAt: new Date() } });
    await createPreferredNotifications(recipients.map(recipient => recipient.userId), 'messages', {
      type: 'MESSAGE', title: 'New message', message: `${message.sender.fullName} sent you a message.`, data: { conversationId: id }
    }, tx);
    return message;
  });
  // A socket can belong to both rooms. A union emits the message only once.
  io?.to([`conversation:${id}`, ...recipients.map(recipient => `user:${recipient.userId}`)]).emit('message:new', data);
  res.status(201).json({ success: true, data });
}));
