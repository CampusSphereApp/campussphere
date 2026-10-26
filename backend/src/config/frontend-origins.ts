import { env } from './env.js';

export const frontendOrigins = [...new Set([
  new URL(env.FRONTEND_URL).origin,
  ...(env.NODE_ENV === 'production' ? [] : ['http://localhost:5500', 'http://127.0.0.1:5500'])
])];
export const isFrontendOrigin = (origin: string | undefined) => !origin || frontendOrigins.includes(origin);
