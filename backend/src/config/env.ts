import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  FRONTEND_URL: z.string().url(),
  GOOGLE_CLIENT_ID: z.string().min(1),
  DEV_ROLE_ASSIGNMENT_KEY: z.string().min(32).optional().or(z.literal(''))
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  throw new Error('Environment configuration is invalid. Copy .env.example to .env and set valid values.');
}

export const env = parsed.data;
