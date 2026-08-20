import type { JwtPayload } from 'jsonwebtoken';

declare global {
  namespace Express {
    interface Request {
      auth?: JwtPayload & { sub: string; email: string };
    }
  }
}

export {};
