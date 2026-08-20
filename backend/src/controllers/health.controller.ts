import type { RequestHandler } from 'express';
import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { asyncHandler } from '../utils/async-handler.js';

export const healthCheck: RequestHandler = asyncHandler(async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.status(200).json({ success: true, data: { status: 'ok', environment: env.NODE_ENV, database: 'connected', timestamp: new Date().toISOString() } });
});
