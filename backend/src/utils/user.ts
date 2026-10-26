import type { Prisma, User } from '@prisma/client';
import { redactProfileFields } from '../services/profile-privacy.service.js';
export const publicUser = (user: User, owner = false) => redactProfileFields({ id: user.id, fullName: user.fullName, role: user.role, avatar: user.avatar, coverImage: user.coverImage, bio: user.bio, college: user.college, course: user.course, year: user.year, location: user.location, createdAt: user.createdAt, updatedAt: user.updatedAt, privacySettings: user.privacySettings }, owner ? user.id : undefined);

export const profileInclude = {
  skills: { include: { skill: true } },
  interests: { include: { interest: true } },
  communityMemberships: { select: { role: true, joinedAt: true, community: { select: { id: true, name: true, category: true, description: true, image: true, banner: true, _count: { select: { members: true } } } } } }
} satisfies Prisma.UserInclude;

type ProfileUser = Prisma.UserGetPayload<{ include: typeof profileInclude }>;
export const profileUser = (user: ProfileUser, includeEmail = false) => redactProfileFields({
  ...publicUser(user, includeEmail),
  ...(includeEmail ? { email: user.email } : {}),
  skills: user.skills.map(({ skill }) => skill.name),
  interests: user.interests.map(({ interest }) => interest.name),
  communities: user.communityMemberships.map(({ community, role, joinedAt }) => ({ ...community, role, joinedAt })),
  privacySettings: user.privacySettings
}, includeEmail ? user.id : undefined);
