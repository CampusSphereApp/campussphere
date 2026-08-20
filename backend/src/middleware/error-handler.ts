import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import multer from 'multer';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { AppError } from '../utils/app-error.js';

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof multer.MulterError) {
    const tooLarge = error.code === 'LIMIT_FILE_SIZE';
    return res.status(tooLarge ? 413 : 400).json({ success: false, error: { code: 'INVALID_AVATAR', message: tooLarge ? 'Profile photos must be 5 MB or smaller.' : 'The profile photo upload is invalid.' } });
  }
  if (error instanceof ZodError) {
    const issue = error.issues[0];
    const field = String(issue?.path.at(-1) || 'request').replace(/([A-Z])/g, ' $1').toLowerCase();
    const message = issue ? `${field.charAt(0).toUpperCase()}${field.slice(1)}: ${issue.message}` : 'Invalid request.';
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message, details: env.NODE_ENV === 'development' ? error.flatten() : undefined } });
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    return res.status(409).json({ success: false, error: { code: 'CONFLICT', message: 'A record with these values already exists.' } });
  }
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({ success: false, error: { code: error.code, message: error.message, details: error.details } });
  }
  logger.error(error, 'Unhandled API error');
  return res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: env.NODE_ENV === 'production' ? 'An unexpected error occurred.' : (error as Error).message } });
};
