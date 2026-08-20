import type { RequestHandler } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import multer from 'multer';
import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/app-error.js';
import { asyncHandler } from '../utils/async-handler.js';
import { profileInclude, profileUser } from '../utils/user.js';
import { updateProfileSchema, userQuerySchema } from '../validators/user.validator.js';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const avatarDirectory = path.join(backendRoot, 'uploads', 'avatars');
fs.mkdirSync(avatarDirectory, { recursive: true });
const allowedAvatarTypes = new Map([['image/jpeg', '.jpg'], ['image/png', '.png'], ['image/webp', '.webp']]);
const avatarStorage = multer.diskStorage({
  destination: avatarDirectory,
  filename: (_req, file, callback) => callback(null, `${Date.now()}-${crypto.randomBytes(16).toString('hex')}${allowedAvatarTypes.get(file.mimetype) || ''}`)
});
export const uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => callback(null, allowedAvatarTypes.has(file.mimetype))
}).single('avatar');

export const updateAvatar: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError(400, 'INVALID_AVATAR', 'Choose a JPEG, PNG, or WebP image up to 5 MB.');
  const header = Buffer.alloc(12); const handle = await fs.promises.open(req.file.path, 'r');
  try { await handle.read(header, 0, header.length, 0); } finally { await handle.close(); }
  const isJpeg = header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
  const isPng = header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isWebp = header.subarray(0, 4).toString() === 'RIFF' && header.subarray(8, 12).toString() === 'WEBP';
  if (!isJpeg && !isPng && !isWebp) { await fs.promises.unlink(req.file.path); throw new AppError(400, 'INVALID_AVATAR', 'The uploaded file is not a valid JPEG, PNG, or WebP image.'); }
  const avatar = `/uploads/avatars/${req.file.filename}`;
  const previous = await prisma.user.findUnique({ where: { id: req.auth!.sub }, select: { avatar: true } });
  const user = await prisma.user.update({ where: { id: req.auth!.sub }, data: { avatar }, include: profileInclude });
  if (previous?.avatar?.startsWith('/uploads/avatars/') && previous.avatar !== avatar) {
    const oldName = path.basename(previous.avatar); const oldPath = path.join(avatarDirectory, oldName);
    if (oldPath.startsWith(`${avatarDirectory}${path.sep}`)) void fs.promises.unlink(oldPath).catch(() => undefined);
  }
  res.json({ success: true, data: profileUser(user, true) });
});

export const listUsers: RequestHandler = asyncHandler(async (req, res) => { const { query } = userQuerySchema.parse({ query: req.query }); const college = typeof query.college === 'string' ? query.college : undefined; const course = typeof query.course === 'string' ? query.course : undefined; const year = typeof query.year === 'string' ? query.year : undefined; const q = typeof query.q === 'string' ? query.q : undefined; const where = { college, course, year, ...(q ? { OR: [{ fullName: { contains: q, mode: 'insensitive' as const } }, { email: { contains: q, mode: 'insensitive' as const } }, { college: { contains: q, mode: 'insensitive' as const } }, { course: { contains: q, mode: 'insensitive' as const } }] } : {}) }; const [users, total] = await prisma.$transaction([prisma.user.findMany({ where, include: profileInclude, skip: (query.page - 1) * query.limit, take: query.limit, orderBy: { createdAt: 'desc' } }), prisma.user.count({ where })]); res.json({ success: true, data: users.map((user) => profileUser(user)), pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } }); });
export const getUser: RequestHandler = asyncHandler(async (req, res) => { const id = typeof req.params.id === 'string' ? req.params.id : req.params.id?.[0]; if (!id) throw new AppError(400, 'VALIDATION_ERROR', 'A user ID is required.'); const user = await prisma.user.findUnique({ where: { id }, include: profileInclude }); if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found.'); res.json({ success: true, data: profileUser(user) }); });
export const updateMe: RequestHandler = asyncHandler(async (req, res) => {
  const { body } = updateProfileSchema.parse({ body: req.body });
  const { skills, interests, ...profile } = body;
  const user = await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: req.auth!.sub }, data: profile });
    if (skills !== undefined) {
      await tx.userSkill.deleteMany({ where: { userId: req.auth!.sub } });
      for (const name of [...new Set(skills)]) {
        const skill = await tx.skill.upsert({ where: { name }, update: {}, create: { name } });
        await tx.userSkill.create({ data: { userId: req.auth!.sub, skillId: skill.id } });
      }
    }
    if (interests !== undefined) {
      await tx.userInterest.deleteMany({ where: { userId: req.auth!.sub } });
      for (const name of [...new Set(interests)]) {
        const interest = await tx.interest.upsert({ where: { name }, update: {}, create: { name } });
        await tx.userInterest.create({ data: { userId: req.auth!.sub, interestId: interest.id } });
      }
    }
    return tx.user.findUniqueOrThrow({ where: { id: req.auth!.sub }, include: profileInclude });
  });
  res.json({ success: true, data: profileUser(user, true) });
});
