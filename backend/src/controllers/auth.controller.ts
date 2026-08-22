import bcrypt from 'bcryptjs';
import type { RequestHandler } from 'express';
import crypto from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/app-error.js';
import { asyncHandler } from '../utils/async-handler.js';
import { clearRefreshCookie, createAccessToken, createRefreshToken, readCookie, setRefreshCookie, verifyRefreshToken } from '../utils/tokens.js';
import { profileInclude, profileUser, publicUser } from '../utils/user.js';
import { googleCredentialSchema, loginSchema, registerSchema } from '../validators/auth.validator.js';

const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);

const authenticateResponse = async (user: { id: string; email: string }, res: Parameters<RequestHandler>[1]) => {
  const refreshToken = createRefreshToken(user);
  await prisma.user.update({ where: { id: user.id }, data: { refreshTokenHash: await bcrypt.hash(refreshToken, 12) } });
  setRefreshCookie(res, refreshToken);
  return createAccessToken(user);
};
export const register: RequestHandler = asyncHandler(async (req, res) => {
  const { body } = registerSchema.parse({ body: req.body });
  const exists = await prisma.user.findUnique({ where: { email: body.email } });
  if (exists) throw new AppError(409, 'EMAIL_IN_USE', 'An account with this email already exists.');
  const { password, interests, ...profile } = body;
  const user = await prisma.user.create({ data: {
    ...profile,
    // Public signup is intentionally limited to student accounts. Staff roles are
    // assigned only through the institution/admin workflow.
    role: 'STUDENT',
    passwordHash: await bcrypt.hash(password, 12),
    interests: interests.length ? { create: interests.map((name) => ({ interest: { connectOrCreate: { where: { name }, create: { name } } } })) } : undefined
  } });
  const accessToken = await authenticateResponse(user, res);
  res.status(201).json({ success: true, data: { user: publicUser(user), accessToken } });
});
export const login: RequestHandler = asyncHandler(async (req, res) => {
  const { body } = loginSchema.parse({ body: req.body });
  const user = await prisma.user.findUnique({ where: { email: body.email } });
  if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
  const accessToken = await authenticateResponse(user, res);
  res.json({ success: true, data: { user: publicUser(user), accessToken } });
});
export const googleConfig: RequestHandler = (_req, res) => { res.json({ success: true, data: { clientId: env.GOOGLE_CLIENT_ID } }); };
export const googleLogin: RequestHandler = asyncHandler(async (req, res) => {
  const { body } = googleCredentialSchema.parse({ body: req.body });
  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: body.credential, audience: env.GOOGLE_CLIENT_ID });
    payload = ticket.getPayload();
  } catch {
    throw new AppError(401, 'INVALID_GOOGLE_CREDENTIAL', 'Google could not verify this sign-in. Please try again.');
  }
  if (!payload?.sub || !payload.email || payload.email_verified !== true) throw new AppError(401, 'UNVERIFIED_GOOGLE_ACCOUNT', 'A verified Google email address is required.');
  const email = payload.email.toLowerCase();
  const [googleUser, emailUser] = await Promise.all([
    prisma.user.findUnique({ where: { googleSub: payload.sub } }),
    prisma.user.findUnique({ where: { email } })
  ]);
  if (googleUser && emailUser && googleUser.id !== emailUser.id) {
    throw new AppError(409, 'GOOGLE_ACCOUNT_CONFLICT', 'This Google account and email belong to different CampusSphere accounts.');
  }
  let user = googleUser || emailUser;
  if (user) {
    if (user.googleSub && user.googleSub !== payload.sub) throw new AppError(409, 'GOOGLE_ACCOUNT_CONFLICT', 'This email is linked to a different Google account.');
    user = await prisma.user.update({ where: { id: user.id }, data: { googleSub: payload.sub, avatar: user.avatar || payload.picture || undefined } });
  } else {
    user = await prisma.user.create({ data: { fullName: payload.name?.trim() || email.split('@')[0], email, googleSub: payload.sub, avatar: payload.picture || null, passwordHash: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12) } });
  }
  const accessToken = await authenticateResponse(user, res);
  res.json({ success: true, data: { user: publicUser(user), accessToken } });
});
export const logout: RequestHandler = asyncHandler(async (req, res) => {
  const token = readCookie(req.headers.cookie, 'refreshToken');
  if (token) { try { const payload = verifyRefreshToken(token); await prisma.user.updateMany({ where: { id: payload.sub, refreshTokenHash: { not: null } }, data: { refreshTokenHash: null } }); } catch { /* clear cookie regardless */ } }
  clearRefreshCookie(res); res.status(204).send();
});
export const refresh: RequestHandler = asyncHandler(async (req, res) => {
  const token = readCookie(req.headers.cookie, 'refreshToken');
  if (!token) throw new AppError(401, 'AUTH_REQUIRED', 'Refresh token is required.');
  let payload; try { payload = verifyRefreshToken(token); } catch { throw new AppError(401, 'INVALID_TOKEN', 'Your refresh token is invalid or expired.'); }
  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || !user.refreshTokenHash || !(await bcrypt.compare(token, user.refreshTokenHash))) throw new AppError(401, 'INVALID_TOKEN', 'Your refresh token is invalid.');
  const accessToken = await authenticateResponse(user, res);
  res.json({ success: true, data: { accessToken } });
});
export const me: RequestHandler = asyncHandler(async (req, res) => { const user = await prisma.user.findUnique({ where: { id: req.auth!.sub }, include: profileInclude }); if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found.'); res.json({ success: true, data: profileUser(user, true) }); });
