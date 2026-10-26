import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/app-error.js';
import { privacyOf } from '../utils/settings.js';

type DbClient = PrismaClient | Prisma.TransactionClient;
export const assertCanMessage = async (senderId: string, recipientId: string, db: DbClient = prisma) => {
  if (senderId === recipientId) throw new AppError(400, 'SELF_CONVERSATION', 'You cannot message yourself.');
  const recipient = await db.user.findUnique({ where: { id: recipientId }, select: { privacySettings: true } });
  if (!recipient) throw new AppError(404, 'USER_NOT_FOUND', 'User not found.');
  const relationship = await db.connection.findFirst({ where: {
    status: { in: ['ACCEPTED', 'BLOCKED'] }, OR: [
      { requesterId: senderId, recipientId }, { requesterId: recipientId, recipientId: senderId }
    ]
  }, select: { status: true } });
  if (relationship?.status === 'BLOCKED') throw new AppError(403, 'MESSAGING_RESTRICTED', 'Messaging this member is unavailable.');
  if (relationship?.status === 'ACCEPTED') return;
  if (privacyOf(recipient.privacySettings).messagesFrom === 'CONNECTIONS') {
    throw new AppError(403, 'MESSAGING_RESTRICTED', 'This member only accepts messages from connections.');
  }
  const collaboration = await db.opportunityApplication.findFirst({ where: { status: 'ACCEPTED', OR: [
    { applicantId: senderId, opportunity: { createdBy: recipientId } },
    { applicantId: recipientId, opportunity: { createdBy: senderId } }
  ] }, select: { id: true } });
  if (!collaboration) throw new AppError(403, 'RELATIONSHIP_REQUIRED', 'Messaging requires an accepted connection or collaboration.');
};
