import { app } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { prisma } from './config/prisma.js';
import { startRealtime } from './realtime.js';

const server = app.listen(env.PORT, () => logger.info({ port: env.PORT }, 'CampusSphere API listening'));
startRealtime(server);
const shutdown = async (signal: string) => { logger.info({ signal }, 'Shutting down'); server.close(async () => { await prisma.$disconnect(); process.exit(0); }); };
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
