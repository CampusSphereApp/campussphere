import type { Prisma, User } from '@prisma/client';
export const publicUser = (user: User) => ({ id: user.id, fullName: user.fullName, avatar: user.avatar, bio: user.bio, college: user.college, course: user.course, year: user.year, location: user.location, createdAt: user.createdAt, updatedAt: user.updatedAt });

export const profileInclude = {
  skills: { include: { skill: true } },
  interests: { include: { interest: true } }
} satisfies Prisma.UserInclude;

type ProfileUser = Prisma.UserGetPayload<{ include: typeof profileInclude }>;
export const profileUser = (user: ProfileUser, includeEmail = false) => ({
  ...publicUser(user),
  ...(includeEmail ? { email: user.email } : {}),
  skills: user.skills.map(({ skill }) => skill.name),
  interests: user.interests.map(({ interest }) => interest.name)
});
