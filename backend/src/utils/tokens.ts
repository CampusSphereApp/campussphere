import jwt, { type JwtPayload } from 'jsonwebtoken';
import type { Response } from 'express';
import { env } from '../config/env.js';

type TokenUser = { id: string; email: string };
export const createAccessToken = (user: TokenUser) => jwt.sign({ email: user.email }, env.JWT_SECRET, { subject: user.id, expiresIn: '15m' });
export const createRefreshToken = (user: TokenUser) => jwt.sign({ email: user.email }, env.JWT_REFRESH_SECRET, { subject: user.id, expiresIn: '7d' });
export const verifyAccessToken = (token: string) => jwt.verify(token, env.JWT_SECRET) as JwtPayload & { sub: string; email: string };
export const verifyRefreshToken = (token: string) => jwt.verify(token, env.JWT_REFRESH_SECRET) as JwtPayload & { sub: string; email: string };
export const setRefreshCookie = (res: Response, token: string) => res.cookie('refreshToken', token, { httpOnly: true, secure: env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000, path: '/api/v1/auth' });
export const clearRefreshCookie = (res: Response) => res.clearCookie('refreshToken', { httpOnly: true, secure: env.NODE_ENV === 'production', sameSite: 'lax', path: '/api/v1/auth' });
export const readCookie = (cookieHeader: string | undefined, name: string) => cookieHeader?.split(';').map(value => value.trim()).find(value => value.startsWith(`${name}=`))?.slice(name.length + 1);
