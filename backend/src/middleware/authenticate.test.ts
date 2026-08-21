import { beforeEach, describe, expect, it, vi } from 'vitest';

const findUnique = vi.fn();
vi.mock('../config/prisma.js', () => ({ prisma: { user: { findUnique } } }));

const { authorizeRoles } = await import('./authenticate.js');

describe('role authorization', () => {
  beforeEach(() => findUnique.mockReset());

  it('allows a matching backend user role', async () => {
    findUnique.mockResolvedValue({ role: 'TEACHER' });
    const request = { auth: { sub: 'teacher-id', email: 'teacher@example.invalid' } };
    const next = vi.fn();
    await authorizeRoles('TEACHER')(request as never, {} as never, next);
    expect(request).toMatchObject({ userRole: 'TEACHER' });
    expect(next).toHaveBeenCalledWith();
  });

  it('rejects a student from teacher-only functionality', async () => {
    findUnique.mockResolvedValue({ role: 'STUDENT' });
    const next = vi.fn();
    await authorizeRoles('TEACHER')({ auth: { sub: 'student-id', email: 'student@example.invalid' } } as never, {} as never, next);
    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 403, code: 'ROLE_REQUIRED' });
  });
});
