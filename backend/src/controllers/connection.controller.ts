import type { RequestHandler } from 'express';
import { ConnectionStatus, NotificationType, type Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/app-error.js';
import { asyncHandler } from '../utils/async-handler.js';
import { publicUser } from '../utils/user.js';
import { createPreferredNotification } from '../services/notification-preference.service.js';

const connectionInclude = { requester: true, recipient: true } as const;
type ConnectionWithUsers = Prisma.ConnectionGetPayload<{ include: typeof connectionInclude }>;
const serialize = (connection: ConnectionWithUsers) => ({ id: connection.id, status: connection.status, createdAt: connection.createdAt, updatedAt: connection.updatedAt, requester: publicUser(connection.requester), recipient: publicUser(connection.recipient) });
const parameter = (value: string | string[] | undefined, label: string) => {
  const result = typeof value === 'string' ? value : value?.[0];
  if (!result) throw new AppError(400, 'VALIDATION_ERROR', `A ${label} is required.`);
  return result;
};
const pairWhere = (userId: string, otherUserId: string) => ({ OR: [{ requesterId: userId, recipientId: otherUserId }, { requesterId: otherUserId, recipientId: userId }] });

export const getConnectionStatus: RequestHandler = asyncHandler(async (req, res) => {
  const otherUserId = parameter(req.params.userId, 'user ID');
  if (otherUserId === req.auth!.sub) return res.json({ success: true, data: { state: 'SELF', connection: null } });
  const connection = await prisma.connection.findFirst({ where: pairWhere(req.auth!.sub, otherUserId), include: connectionInclude });
  if (!connection || connection.status === ConnectionStatus.REJECTED) return res.json({ success: true, data: { state: 'NONE', connection: null } });
  const state = connection.status === ConnectionStatus.ACCEPTED ? 'CONNECTED' : connection.requesterId === req.auth!.sub ? 'PENDING_SENT' : 'PENDING_RECEIVED';
  res.json({ success: true, data: { state, connection: serialize(connection) } });
});

export const sendConnection: RequestHandler = asyncHandler(async (req, res) => {
  const recipientId = parameter(req.params.userId, 'recipient ID');
  if (recipientId === req.auth!.sub) throw new AppError(400, 'INVALID_CONNECTION', 'You cannot connect with yourself.');
  const recipient = await prisma.user.findUnique({ where: { id: recipientId } });
  if (!recipient) throw new AppError(404, 'USER_NOT_FOUND', 'User not found.');
  const connection = await prisma.$transaction(async (tx) => {
    const existing = await tx.connection.findFirst({ where: pairWhere(req.auth!.sub, recipientId) });
    if (existing?.status === ConnectionStatus.ACCEPTED) throw new AppError(409, 'ALREADY_CONNECTED', 'You are already connected.');
    if (existing?.status === ConnectionStatus.PENDING) throw new AppError(409, 'CONNECTION_PENDING', 'A connection request is already pending.');
    if (existing?.status === ConnectionStatus.BLOCKED) throw new AppError(403, 'CONNECTION_BLOCKED', 'This connection is unavailable.');
    if (existing?.status === ConnectionStatus.REJECTED) await tx.connection.delete({ where: { id: existing.id } });
    const created = await tx.connection.create({ data: { requesterId: req.auth!.sub, recipientId }, include: connectionInclude });
    await createPreferredNotification(recipientId, 'connections', { userId: recipientId, type: NotificationType.CONNECTION_REQUEST, title: 'New connection request', message: `${created.requester.fullName} wants to connect with you.`, data: { connectionId: created.id } }, tx);
    return created;
  });
  res.status(201).json({ success: true, data: serialize(connection) });
});

const resolve = (status: ConnectionStatus): RequestHandler => asyncHandler(async (req, res) => {
  const id = parameter(req.params.connectionId, 'connection ID');
  const connection = await prisma.connection.findUnique({ where: { id }, include: connectionInclude });
  if (!connection) throw new AppError(404, 'CONNECTION_NOT_FOUND', 'Connection request not found.');
  if (connection.recipientId !== req.auth!.sub) throw new AppError(403, 'FORBIDDEN', 'Only the recipient can resolve this request.');
  if (connection.status !== ConnectionStatus.PENDING) throw new AppError(409, 'CONNECTION_RESOLVED', 'This connection request has already been resolved.');
  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.connection.update({ where: { id }, data: { status }, include: connectionInclude });
    if (status === ConnectionStatus.ACCEPTED) await createPreferredNotification(result.requesterId, 'connections', { userId: result.requesterId, type: NotificationType.CONNECTION_ACCEPTED, title: 'Connection accepted', message: `${result.recipient.fullName} accepted your connection request.`, data: { connectionId: result.id } }, tx);
    return result;
  });
  res.json({ success: true, data: serialize(updated) });
});

export const acceptConnection = resolve(ConnectionStatus.ACCEPTED);
export const rejectConnection = resolve(ConnectionStatus.REJECTED);
export const listConnections: RequestHandler = asyncHandler(async (req, res) => {
  const connections = await prisma.connection.findMany({ where: { status: ConnectionStatus.ACCEPTED, OR: [{ requesterId: req.auth!.sub }, { recipientId: req.auth!.sub }] }, include: connectionInclude, orderBy: { updatedAt: 'desc' } });
  res.json({ success: true, data: connections.map(serialize) });
});
export const listRequests: RequestHandler = asyncHandler(async (req, res) => {
  const requests = await prisma.connection.findMany({ where: { recipientId: req.auth!.sub, status: ConnectionStatus.PENDING }, include: connectionInclude, orderBy: { createdAt: 'desc' } });
  res.json({ success: true, data: requests.map(serialize) });
});
export const listSent: RequestHandler = asyncHandler(async (req, res) => {
  const requests = await prisma.connection.findMany({ where: { requesterId: req.auth!.sub, status: ConnectionStatus.PENDING }, include: connectionInclude, orderBy: { createdAt: 'desc' } });
  res.json({ success: true, data: requests.map(serialize) });
});
export const listPending: RequestHandler = asyncHandler(async (req, res) => {
  const pending = await prisma.connection.findMany({ where: { status: ConnectionStatus.PENDING, OR: [{ requesterId: req.auth!.sub }, { recipientId: req.auth!.sub }] }, include: connectionInclude, orderBy: { createdAt: 'desc' } });
  const data = pending.map(serialize);
  res.json({ success: true, data: { incoming: data.filter((connection) => connection.recipient.id === req.auth!.sub), outgoing: data.filter((connection) => connection.requester.id === req.auth!.sub) } });
});
export const removeConnection: RequestHandler = asyncHandler(async (req, res) => {
  const id = parameter(req.params.connectionId, 'connection ID');
  let connection = await prisma.connection.findFirst({ where: { id, OR: [{ requesterId: req.auth!.sub }, { recipientId: req.auth!.sub }] } });
  if (!connection) connection = await prisma.connection.findFirst({ where: pairWhere(req.auth!.sub, id) });
  if (!connection) throw new AppError(404, 'CONNECTION_NOT_FOUND', 'Connection not found.');
  if (connection.status === ConnectionStatus.PENDING && connection.requesterId !== req.auth!.sub) throw new AppError(403, 'FORBIDDEN', 'Use reject to decline an incoming request.');
  await prisma.connection.delete({ where: { id: connection.id } });
  res.status(204).send();
});
