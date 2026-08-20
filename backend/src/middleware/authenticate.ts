import type { RequestHandler } from 'express';
import { AppError } from '../utils/app-error.js';
import { verifyAccessToken } from '../utils/tokens.js';

export const authenticate: RequestHandler = (req, _res, next) => {
  const token = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : undefined;
  if (!token) return next(new AppError(401, 'AUTH_REQUIRED', 'Authentication is required.'));
  try { req.auth = verifyAccessToken(token); return next(); } catch { return next(new AppError(401, 'INVALID_TOKEN', 'Your access token is invalid or expired.')); }
};
