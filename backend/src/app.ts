import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from './config/env.js';
import { errorHandler } from './middleware/error-handler.js';
import { notFound } from './middleware/not-found.js';
import { apiRateLimit } from './middleware/rate-limiters.js';
import { apiRouter } from './routes/index.js';

export const app = express();
app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
const allowedOrigins = new Set([env.FRONTEND_URL, 'http://localhost:5500', 'http://127.0.0.1:5500']);
app.use(cors({
  credentials: true,
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error('CORS origin is not allowed.'));
  }
}));
app.use(express.json({ limit: '1mb' }));
const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
app.use('/uploads', express.static(path.join(backendRoot, 'uploads'), { fallthrough: false, maxAge: env.NODE_ENV === 'production' ? '1d' : 0 }));
app.use('/api', apiRateLimit, apiRouter);
app.use(notFound);
app.use(errorHandler);
