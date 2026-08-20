import rateLimit from 'express-rate-limit';

const jsonError = { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' } };

export const apiRateLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: 'draft-8', legacyHeaders: false, message: jsonError });
export const authRateLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false, message: jsonError });
