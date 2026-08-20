import { z } from 'zod';
const interestSchema = z.string().trim().min(2).max(50);
export const registerSchema = z.object({ body: z.object({
  fullName: z.string().trim().min(2, 'Full name must contain at least 2 characters.').max(100),
  email: z.string().trim().email('Enter a valid email address.').max(255).toLowerCase(),
  password: z.string().min(8, 'Password must contain at least 8 characters.').max(128),
  college: z.string().trim().min(2, 'Select your college or university.').max(150),
  course: z.string().trim().min(2, 'Enter your course.').max(150),
  year: z.enum(['FIRST', 'SECOND', 'THIRD', 'FOURTH', 'POSTGRADUATE'], { message: 'Select a valid year of study.' }),
  interests: z.array(interestSchema).max(10, 'Choose up to 10 interests.').default([])
}) });
export const loginSchema = z.object({ body: z.object({ email: z.string().trim().email().toLowerCase(), password: z.string().min(1).max(128) }) });
export const googleCredentialSchema = z.object({ body: z.object({ credential: z.string().trim().min(100).max(5000) }).strict() });
