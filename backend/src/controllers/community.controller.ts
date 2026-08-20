import type { RequestHandler } from 'express';
import { CommunityRole } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/app-error.js';
import { asyncHandler } from '../utils/async-handler.js';

const boundedNumber = (value: unknown, fallback: number) => Math.max(1, Math.min(Number(value) || fallback, 50));
const fields = (userId: string) => ({ id: true, name: true, description: true, category: true, image: true, banner: true, createdAt: true, owner: { select: { id: true, fullName: true, avatar: true, college: true, course: true } }, members: { where: { userId }, select: { role: true } }, _count: { select: { members: true, posts: true } } });
const present = (community: any) => ({ ...community, joined: community.members.length > 0, membershipRole: community.members[0]?.role ?? null, members: undefined });

export const listCommunities: RequestHandler = asyncHandler(async (req, res) => {
  const limit = boundedNumber(req.query.limit, 20); const page = boundedNumber(req.query.page, 1); const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const where = q ? { OR: [{ name: { contains: q, mode: 'insensitive' as const } }, { category: { contains: q, mode: 'insensitive' as const } }, { description: { contains: q, mode: 'insensitive' as const } }] } : {};
  const [data, total] = await prisma.$transaction([prisma.community.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' }, select: fields(req.auth!.sub) }), prisma.community.count({ where })]);
  res.json({ success: true, data: data.map(present), pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
});

export const getCommunity: RequestHandler = asyncHandler(async (req, res) => {
  const item = await prisma.community.findUnique({ where: { id: String(req.params.id) }, select: fields(req.auth!.sub) });
  if (!item) throw new AppError(404, 'COMMUNITY_NOT_FOUND', 'Community not found.');
  res.json({ success: true, data: present(item) });
});

export const createCommunity: RequestHandler = asyncHandler(async (req, res) => {
  const body = req.body as Record<string, unknown>; const name = typeof body.name === 'string' ? body.name.trim() : ''; const description = typeof body.description === 'string' ? body.description.trim() : ''; const category = typeof body.category === 'string' ? body.category.trim() : ''; const image = typeof body.image === 'string' && body.image.trim() ? body.image.trim() : null; const banner = typeof body.banner === 'string' && body.banner.trim() ? body.banner.trim() : null;
  if (name.length < 2 || name.length > 100) throw new AppError(400, 'VALIDATION_ERROR', 'Community name must be between 2 and 100 characters.');
  if (description.length < 10 || description.length > 2000) throw new AppError(400, 'VALIDATION_ERROR', 'Description must be between 10 and 2000 characters.');
  if (category.length < 2 || category.length > 50) throw new AppError(400, 'VALIDATION_ERROR', 'Category must be between 2 and 50 characters.');
  const item = await prisma.$transaction(async (tx) => { const created = await tx.community.create({ data: { name, description, category, image, banner, ownerId: req.auth!.sub } }); await tx.communityMember.create({ data: { communityId: created.id, userId: req.auth!.sub, role: CommunityRole.OWNER } }); return created; });
  res.status(201).json({ success: true, data: { ...item, joined: true, membershipRole: CommunityRole.OWNER } });
});

export const joinCommunity: RequestHandler = asyncHandler(async (req, res) => {
  const communityId = String(req.params.id); const [community, existing] = await Promise.all([prisma.community.findUnique({ where: { id: communityId }, select: { id: true } }), prisma.communityMember.findUnique({ where: { communityId_userId: { communityId, userId: req.auth!.sub } } })]);
  if (!community) throw new AppError(404, 'COMMUNITY_NOT_FOUND', 'Community not found.'); if (existing) throw new AppError(409, 'ALREADY_MEMBER', 'You have already joined this community.');
  await prisma.communityMember.create({ data: { communityId, userId: req.auth!.sub } }); res.status(201).json({ success: true, data: { communityId, joined: true, membershipRole: CommunityRole.MEMBER } });
});

export const leaveCommunity: RequestHandler = asyncHandler(async (req, res) => {
  const communityId = String(req.params.id); const member = await prisma.communityMember.findUnique({ where: { communityId_userId: { communityId, userId: req.auth!.sub } } });
  if (!member) throw new AppError(404, 'MEMBERSHIP_NOT_FOUND', 'You are not a member.'); if (member.role === CommunityRole.OWNER) throw new AppError(409, 'OWNER_CANNOT_LEAVE', 'Community owners cannot leave their community.');
  await prisma.communityMember.delete({ where: { communityId_userId: { communityId, userId: req.auth!.sub } } }); res.status(204).send();
});

export const members: RequestHandler = asyncHandler(async (req, res) => {
  const communityId = String(req.params.id); const exists = await prisma.community.findUnique({ where: { id: communityId }, select: { id: true } }); if (!exists) throw new AppError(404, 'COMMUNITY_NOT_FOUND', 'Community not found.');
  const data = await prisma.communityMember.findMany({ where: { communityId }, orderBy: { joinedAt: 'asc' }, select: { role: true, joinedAt: true, user: { select: { id: true, fullName: true, avatar: true, college: true, course: true, year: true, skills: true } } } });
  res.json({ success: true, data });
});
