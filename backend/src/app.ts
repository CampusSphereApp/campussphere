import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from './config/env.js';
import { isFrontendOrigin } from './config/frontend-origins.js';
import { AppError } from './utils/app-error.js';
import { errorHandler } from './middleware/error-handler.js';
import { notFound } from './middleware/not-found.js';
import { apiRateLimit } from './middleware/rate-limiters.js';
import { apiRouter } from './routes/index.js';

export const app = express();
app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  credentials: true,
  origin(origin, callback) {
    if (isFrontendOrigin(origin)) return callback(null, true);
    return callback(new AppError(403, 'ORIGIN_NOT_ALLOWED', 'This origin is not allowed.'));
  }
}));
app.use(express.json({ limit: '1mb' }));
const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
app.use('/uploads', express.static(path.join(backendRoot, 'uploads'), { fallthrough: false, maxAge: env.NODE_ENV === 'production' ? '1d' : 0 }));
app.use('/api', apiRateLimit, apiRouter);
app.use(notFound);
app.use(errorHandler);
