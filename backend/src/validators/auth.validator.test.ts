import { describe, expect, it } from 'vitest';
import { registerSchema } from './auth.validator.js';

const validRegistration = {
  fullName: 'Campus Student',
  email: 'student@gmail.com',
  password: 'ValidSchemaTestPassword123!',
  college: 'Northstar University',
  course: 'Computer Science',
  year: 'THIRD',
  interests: ['Technology', 'Design']
};

describe('registration validation', () => {
  it('accepts the exact frontend registration payload', () => {
    expect(registerSchema.parse({ body: validRegistration }).body).toMatchObject(validRegistration);
  });

  it('rejects a short password with a useful validation message', () => {
    const result = registerSchema.safeParse({ body: { ...validRegistration, password: 'short' } });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].message).toContain('at least 8 characters');
  });
});
