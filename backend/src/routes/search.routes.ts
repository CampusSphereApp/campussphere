import { Router } from 'express';
import { prisma } from '../config/prisma.js';
import { authenticate } from '../middleware/authenticate.js';
import { asyncHandler } from '../utils/async-handler.js';
import { AppError } from '../utils/app-error.js';
import { redactProfileFields, visibleProfilesWhere } from '../services/profile-privacy.service.js';

export const searchRouter = Router();
searchRouter.get('/', authenticate, asyncHandler(async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (q.length < 2 || q.length > 100) throw new AppError(400, 'VALIDATION_ERROR', 'Query must contain between 2 and 100 characters.');
  const c = { contains: q, mode: 'insensitive' as const };
  const [users, communities, events, projects, opportunities] = await Promise.all([
    prisma.user.findMany({ where: { fullName: c, AND: [visibleProfilesWhere(req.auth!.sub)] }, take: 5, select: { id: true, fullName: true, avatar: true, course: true, privacySettings: true } }),
    prisma.community.findMany({ where: { name: c }, take: 5 }),
    prisma.event.findMany({ where: { title: c }, take: 5 }),
    prisma.project.findMany({ where: { title: c, visibility: 'PUBLIC' }, take: 5 }),
    prisma.opportunity.findMany({ where: { title: c, status: { not: 'ARCHIVED' } }, take: 5 })
  ]);
  res.json({ success: true, data: { users: users.map(user => redactProfileFields(user, req.auth!.sub)), communities, events, projects, opportunities } });
}));
