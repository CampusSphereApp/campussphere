import type { JwtPayload } from 'jsonwebtoken';
import type { UserRole } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      auth?: JwtPayload & { sub: string; email: string };
      userRole?: UserRole;
    }
  }
}

export {};
