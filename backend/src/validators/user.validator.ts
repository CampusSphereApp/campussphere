import { z } from 'zod';
export const notificationPreferencesSchema = z.object({ messages: z.boolean(), connections: z.boolean(), socialActivity: z.boolean(), communities: z.boolean(), events: z.boolean(), opportunities: z.boolean() }).strict();
export const privacySettingsSchema = z.object({ profileVisibility: z.enum(['CAMPUS','CONNECTIONS','PRIVATE']), messagesFrom: z.enum(['EVERYONE','CONNECTIONS']), showCollege: z.boolean(), showCourseYear: z.boolean(), showSkillsInterests: z.boolean(), showActivity: z.boolean() }).strict();
export const appearanceSettingsSchema = z.object({ theme: z.enum(['system','light','dark']), accent: z.enum(['orange','purple','blue','teal','rose']), density: z.enum(['comfortable','compact']) }).strict();
export const userQuerySchema = z.object({ query: z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(50).default(20), college: z.string().trim().max(150).optional(), course: z.string().trim().max(150).optional(), year: z.enum(['FIRST', 'SECOND', 'THIRD', 'FOURTH', 'POSTGRADUATE']).optional(), role: z.enum(['STUDENT','TEACHER','COLLEGE_ADMIN','ADMIN']).optional(), skill: z.string().trim().max(60).optional(), q: z.string().trim().max(100).optional() }) });
const profileList = z.array(z.string().trim().min(1).max(50)).max(20);
export const updateProfileSchema = z.object({ body: z.object({ fullName: z.string().trim().min(2).max(100).optional(), avatar: z.string().url().max(500).nullable().optional(), bio: z.string().trim().max(500).nullable().optional(), college: z.string().trim().max(150).nullable().optional(), course: z.string().trim().max(150).nullable().optional(), year: z.enum(['FIRST', 'SECOND', 'THIRD', 'FOURTH', 'POSTGRADUATE']).nullable().optional(), location: z.string().trim().max(150).nullable().optional(), skills: profileList.optional(), interests: profileList.optional() }).strict() });

export const updateSettingsSchema = z.object({
  notificationPreferences: notificationPreferencesSchema.optional(),
  privacySettings: privacySettingsSchema.optional(),
  appearanceSettings: appearanceSettingsSchema.optional()
}).strict().refine(value => Object.keys(value).length > 0, 'Provide notification, privacy, or appearance settings.');
