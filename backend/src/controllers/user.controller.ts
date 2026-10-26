import type { RequestHandler } from 'express';
import type { Prisma } from '@prisma/client';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import multer from 'multer';
import { isSupportedImageHeader } from '../utils/image-signature.js';
import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/app-error.js';
import { asyncHandler } from '../utils/async-handler.js';
import { profileInclude, profileUser } from '../utils/user.js';
import { updateProfileSchema, updateSettingsSchema, userQuerySchema } from '../validators/user.validator.js';
import { settingsOf } from '../utils/settings.js';
import { canViewProfile, redactProfileFields, settingVisibleWhere, visibleProfilesWhere } from '../services/profile-privacy.service.js';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const avatarDirectory = path.join(backendRoot, 'uploads', 'avatars');
const coverDirectory = path.join(backendRoot, 'uploads', 'covers');
fs.mkdirSync(avatarDirectory, { recursive: true });
fs.mkdirSync(coverDirectory, { recursive: true });
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
const coverStorage = multer.diskStorage({ destination: coverDirectory, filename: (_req, file, callback) => callback(null, `${Date.now()}-${crypto.randomBytes(16).toString('hex')}${allowedAvatarTypes.get(file.mimetype) || ''}`) });
export const uploadCover = multer({ storage: coverStorage, limits: { fileSize: 8 * 1024 * 1024, files: 1 }, fileFilter: (_req, file, callback) => callback(null, allowedAvatarTypes.has(file.mimetype)) }).single('cover');
const validImage = async (file: Express.Multer.File) => {
  const header = Buffer.alloc(12);
  const handle = await fs.promises.open(file.path, 'r');
  try {
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    return isSupportedImageHeader(header.subarray(0, bytesRead), file.mimetype);
  } finally { await handle.close(); }
};

const deleteManagedImage = async (url: string | null | undefined, kind: 'avatars' | 'covers') => {
  if (!url?.startsWith(`/uploads/${kind}/`)) return;
  const directory = kind === 'avatars' ? avatarDirectory : coverDirectory;
  await fs.promises.unlink(path.join(directory, path.basename(url))).catch(() => undefined);
};

const updateImage = (kind: 'avatar' | 'cover'): RequestHandler => asyncHandler(async (req, res) => {
  const code = kind === 'avatar' ? 'INVALID_AVATAR' : 'INVALID_COVER';
  if (!req.file) throw new AppError(400, code, `Choose a JPEG, PNG, or WebP image up to ${kind === 'avatar' ? 5 : 8} MB.`);
  const file = req.file;
  const field = kind === 'avatar' ? 'avatar' : 'coverImage';
  const directory = kind === 'avatar' ? 'avatars' : 'covers';
  const url = `/uploads/${directory}/${file.filename}`;
  let previous: { avatar: string | null; coverImage: string | null } | null;
  let user;
  try {
    if (!await validImage(file)) throw new AppError(400, code, 'The uploaded file does not match its JPEG, PNG, or WebP image type.');
    previous = await prisma.user.findUnique({ where: { id: req.auth!.sub }, select: { avatar: true, coverImage: true } });
    if (!previous) throw new AppError(404, 'USER_NOT_FOUND', 'User not found.');
    user = await prisma.user.update({ where: { id: req.auth!.sub }, data: { [field]: url }, include: profileInclude });
  } catch (error) {
    await fs.promises.unlink(file.path).catch(() => undefined);
    throw error;
  }
  if (previous[field] !== url) await deleteManagedImage(previous[field], directory);
  res.json({ success: true, data: profileUser(user, true) });
});

export const updateAvatar = updateImage('avatar');
export const updateCover = updateImage('cover');
export const removeCover: RequestHandler = asyncHandler(async (req, res) => {
  const previous = await prisma.user.findUnique({ where: { id: req.auth!.sub }, select: { coverImage: true } });
  if (!previous) throw new AppError(404, 'USER_NOT_FOUND', 'User not found.');
  const user = await prisma.user.update({ where: { id: req.auth!.sub }, data: { coverImage: null }, include: profileInclude });
  await deleteManagedImage(previous.coverImage, 'covers');
  res.json({ success: true, data: profileUser(user, true) });
});

export const getSettings: RequestHandler = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.auth!.sub }, select: { notificationPreferences: true, privacySettings: true, appearanceSettings: true } });
  if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found.');
  res.json({ success: true, data: settingsOf(user) });
});

export const updateSettings: RequestHandler = asyncHandler(async (req, res) => {
  const data = updateSettingsSchema.parse(req.body);
  const saved = await prisma.user.update({ where: { id: req.auth!.sub }, data, select: { notificationPreferences: true, privacySettings: true, appearanceSettings: true } });
  res.json({ success: true, data: settingsOf(saved) });
});

export const listUsers: RequestHandler = asyncHandler(async (req, res) => {
  const { query } = userQuerySchema.parse({ query: req.query });
  const visibleField = (key: string): Prisma.UserWhereInput => ({ OR: [{ id: req.auth!.sub }, settingVisibleWhere(key)] });
  const where: Prisma.UserWhereInput = { AND: [
    visibleProfilesWhere(req.auth!.sub),
    ...(query.role ? [{ role: query.role }] : []),
    ...(query.college ? [{ AND: [{ college: query.college }, visibleField('showCollege')] }] : []),
    ...(query.course ? [{ AND: [{ course: query.course }, visibleField('showCourseYear')] }] : []),
    ...(query.year ? [{ AND: [{ year: query.year }, visibleField('showCourseYear')] }] : []),
    ...(query.skill ? [{ AND: [
      { skills: { some: { skill: { name: { contains: query.skill, mode: 'insensitive' as const } } } } }, visibleField('showSkillsInterests')
    ] }] : []),
    ...(query.q ? [{ OR: [
      { fullName: { contains: query.q, mode: 'insensitive' as const } },
      { AND: [{ college: { contains: query.q, mode: 'insensitive' as const } }, visibleField('showCollege')] },
      { AND: [{ course: { contains: query.q, mode: 'insensitive' as const } }, visibleField('showCourseYear')] },
      { AND: [{ skills: { some: { skill: { name: { contains: query.q, mode: 'insensitive' as const } } } } }, visibleField('showSkillsInterests')] },
      { AND: [{ interests: { some: { interest: { name: { contains: query.q, mode: 'insensitive' as const } } } } }, visibleField('showSkillsInterests')] }
    ] }] : [])
  ] };
  const [users, total] = await prisma.$transaction([
    prisma.user.findMany({ where, include: profileInclude, skip: (query.page - 1) * query.limit, take: query.limit, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }] }),
    prisma.user.count({ where })
  ]);
  res.json({ success: true, data: users.map(user => redactProfileFields({ ...profileUser(user, user.id === req.auth!.sub), privacySettings: user.privacySettings }, req.auth!.sub)), pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } });
});

export const getUser: RequestHandler = asyncHandler(async (req, res) => {
  const id = typeof req.params.id === 'string' ? req.params.id : req.params.id?.[0];
  if (!id) throw new AppError(400, 'VALIDATION_ERROR', 'A user ID is required.');
  const user = await prisma.user.findUnique({ where: { id }, include: profileInclude });
  if (!user || !await canViewProfile(user, req.auth!.sub)) throw new AppError(404, 'USER_NOT_FOUND', 'User not found.');
  const data = id === req.auth!.sub ? profileUser(user, true) : redactProfileFields({ ...profileUser(user), privacySettings: user.privacySettings });
  res.json({ success: true, data });
});

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
