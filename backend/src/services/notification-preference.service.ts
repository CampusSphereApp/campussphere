import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../config/prisma.js';

export type NotificationCategory = 'messages' | 'connections' | 'socialActivity' | 'communities' | 'events' | 'opportunities';
type DbClient = PrismaClient | Prisma.TransactionClient;
const enabled = (preferences: unknown, category: NotificationCategory) =>
  !preferences || typeof preferences !== 'object' || (preferences as Record<string, unknown>)[category] !== false;

export const shouldNotify = async (userId: string, category: NotificationCategory, db: DbClient = prisma) => {
  const user = await db.user.findUnique({ where: { id: userId }, select: { notificationPreferences: true } });
  return Boolean(user && enabled(user.notificationPreferences, category));
};

export const createPreferredNotification = async (userId: string, category: NotificationCategory, data: Prisma.NotificationUncheckedCreateInput, db: DbClient = prisma) => {
  if (data.userId !== userId) throw new Error('Notification recipient does not match preference owner.');
  if (!await shouldNotify(userId, category, db)) return null;
  return db.notification.create({ data });
};

export const createPreferredNotifications = async (userIds: string[], category: NotificationCategory, data: Omit<Prisma.NotificationCreateManyInput, 'userId'>, db: DbClient = prisma) => {
  if (!userIds.length) return { count: 0 };
  const users = await db.user.findMany({ where: { id: { in: [...new Set(userIds)] } }, select: { id: true, notificationPreferences: true } });
  const recipients = users.filter(user => enabled(user.notificationPreferences, category));
  if (!recipients.length) return { count: 0 };
  return db.notification.createMany({ data: recipients.map(user => ({ ...data, userId: user.id })) });
};
