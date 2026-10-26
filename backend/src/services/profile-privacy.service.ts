import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { privacyOf } from '../utils/settings.js';

// New settings are complete objects; unset settings retain the default campus visibility.
const unsetPrivacy = { privacySettings: { equals: Prisma.AnyNull } };
export const settingVisibleWhere = (key: string): Prisma.UserWhereInput => ({
  OR: [unsetPrivacy, { privacySettings: { path: [key], equals: Prisma.AnyNull } }, { privacySettings: { path: [key], equals: true } }]
});
export const visibleProfilesWhere = (viewerId: string): Prisma.UserWhereInput => ({
  OR: [
    { id: viewerId }, unsetPrivacy,
    { privacySettings: { path: ['profileVisibility'], equals: Prisma.AnyNull } },
    { privacySettings: { path: ['profileVisibility'], equals: 'CAMPUS' } },
    { AND: [
      { privacySettings: { path: ['profileVisibility'], equals: 'CONNECTIONS' } },
      { OR: [
        { sentConnections: { some: { recipientId: viewerId, status: 'ACCEPTED' } } },
        { receivedConnections: { some: { requesterId: viewerId, status: 'ACCEPTED' } } }
      ] }
    ] }
  ]
});
export const visibleActivityWhere = (viewerId: string): Prisma.PostWhereInput => ({
  OR: [{ authorId: viewerId }, { author: { AND: [visibleProfilesWhere(viewerId), settingVisibleWhere('showActivity')] } }]
});
export const canViewProfile = async (user: { id: string; privacySettings: unknown }, viewerId: string) => {
  if (user.id === viewerId) return true;
  const privacy = privacyOf(user.privacySettings);
  if (privacy.profileVisibility === 'CAMPUS') return true;
  if (privacy.profileVisibility === 'PRIVATE') return false;
  return Boolean(await prisma.connection.findFirst({ where: {
    status: 'ACCEPTED', OR: [
      { requesterId: viewerId, recipientId: user.id },
      { requesterId: user.id, recipientId: viewerId }
    ]
  }, select: { id: true } }));
};

// Accept projections as well as full users, and never return the underlying preference JSON.
export const redactProfileFields = <T extends { id: string; privacySettings?: unknown }>(user: T, viewerId?: string): Omit<T, 'privacySettings'> => {
  const { privacySettings, ...data } = user;
  if (user.id === viewerId) return data;
  const privacy = privacyOf(privacySettings);
  const masked: Record<string, unknown> = data;
  if (!privacy.showCollege && 'college' in masked) masked.college = null;
  if (!privacy.showCourseYear) { if ('course' in masked) masked.course = null; if ('year' in masked) masked.year = null; }
  if (!privacy.showSkillsInterests) { if ('skills' in masked) masked.skills = []; if ('interests' in masked) masked.interests = []; }
  if (!privacy.showActivity && 'communities' in masked) masked.communities = [];
  return masked as Omit<T, 'privacySettings'>;
};
