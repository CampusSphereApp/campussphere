import { describe, expect, it } from 'vitest';
import { createAccessToken, createRefreshToken, readCookie, verifyAccessToken, verifyRefreshToken } from './tokens.js';

const user = { id: 'user_123', email: 'student@campussphere.dev' };

describe('authentication token utilities', () => {
  it('creates verifiable access and refresh tokens for the intended user', () => {
    expect(verifyAccessToken(createAccessToken(user))).toMatchObject({ sub: user.id, email: user.email });
    expect(verifyRefreshToken(createRefreshToken(user))).toMatchObject({ sub: user.id, email: user.email });
  });

  it('reads a named cookie without exposing adjacent cookies', () => {
    expect(readCookie('theme=dark; refreshToken=secure-value; visit=1', 'refreshToken')).toBe('secure-value');
    expect(readCookie(undefined, 'refreshToken')).toBeUndefined();
  });
});
