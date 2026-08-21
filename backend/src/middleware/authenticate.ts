import type { RequestHandler } from 'express';
import type { UserRole } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/app-error.js';
import { verifyAccessToken } from '../utils/tokens.js';

export const authenticate: RequestHandler = (req, _res, next) => {
  const token = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : undefined;
  if (!token) return next(new AppError(401, 'AUTH_REQUIRED', 'Authentication is required.'));
  try { req.auth = verifyAccessToken(token); return next(); } catch { return next(new AppError(401, 'INVALID_TOKEN', 'Your access token is invalid or expired.')); }
};

export const authorizeRoles = (...roles: UserRole[]): RequestHandler => async (req, _res, next) => {
  if (!req.auth) return next(new AppError(401, 'AUTH_REQUIRED', 'Authentication is required.'));
  try {
    const user = await prisma.user.findUnique({ where: { id: req.auth.sub }, select: { role: true } });
    if (!user) return next(new AppError(401, 'AUTH_REQUIRED', 'Your account is unavailable.'));
    if (!roles.includes(user.role)) return next(new AppError(403, 'ROLE_REQUIRED', 'You do not have access to this workspace.'));
    req.userRole = user.role;
    return next();
  } catch (error) { return next(error); }
};
