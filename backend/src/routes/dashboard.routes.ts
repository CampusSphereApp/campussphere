import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { authenticate, authorizeRoles } from '../middleware/authenticate.js';
import { asyncHandler } from '../utils/async-handler.js';

export const dashboardRouter = Router();
dashboardRouter.get('/', authenticate, authorizeRoles(UserRole.STUDENT), asyncHandler(async (req, res) => {
  const now = new Date();
  const [user, events, projects, communities, unreadNotifications, recentActivity] = await Promise.all([
    prisma.user.findUnique({ where: { id: req.auth!.sub }, select: { id: true, fullName: true, avatar: true, college: true, course: true } }),
    prisma.event.findMany({ where: { endDate: { gte: now } }, take: 5, orderBy: { startDate: 'asc' }, include: { _count: { select: { participants: true } } } }),
    prisma.project.findMany({ where: { status: 'RECRUITING' }, take: 5, include: { roles: true } }),
    prisma.community.findMany({ take: 5, include: { _count: { select: { members: true } } } }),
    prisma.notification.count({ where: { userId: req.auth!.sub, read: false } }),
    prisma.post.findMany({ take: 8, orderBy: { createdAt: 'desc' }, include: { author: { select: { id: true, fullName: true, avatar: true } } } }),
  ]);
  res.json({ success: true, data: { user, upcomingEvents: events, recommendedProjects: projects, recommendedCommunities: communities, unreadNotifications, recentActivity } });
}));
