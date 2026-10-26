import { appearanceSettingsSchema, notificationPreferencesSchema, privacySettingsSchema } from '../validators/user.validator.js';

export const settingsDefaults = {
  notificationPreferences: { messages: true, connections: true, socialActivity: true, communities: true, events: true, opportunities: true },
  privacySettings: { profileVisibility: 'CAMPUS', messagesFrom: 'EVERYONE', showCollege: true, showCourseYear: true, showSkillsInterests: true, showActivity: true },
  appearanceSettings: { theme: 'light', accent: 'orange', density: 'comfortable' }
} as const;

const savedObject = (value: unknown) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
export const privacyOf = (value: unknown) => ({
  ...settingsDefaults.privacySettings,
  ...privacySettingsSchema.partial().parse(savedObject(value))
});
export const settingsOf = (user: { notificationPreferences: unknown; privacySettings: unknown; appearanceSettings: unknown }) => ({
  notificationPreferences: { ...settingsDefaults.notificationPreferences, ...notificationPreferencesSchema.partial().parse(savedObject(user.notificationPreferences)) },
  privacySettings: privacyOf(user.privacySettings),
  appearanceSettings: { ...settingsDefaults.appearanceSettings, ...appearanceSettingsSchema.partial().parse(savedObject(user.appearanceSettings)) }
});
