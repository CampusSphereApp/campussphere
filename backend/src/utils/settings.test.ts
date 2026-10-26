import { describe, expect, it } from 'vitest';
import { settingsDefaults, settingsOf } from './settings.js';
import { updateSettingsSchema } from '../validators/user.validator.js';

describe('account settings', () => {
  it('starts new accounts on the same light orange theme as the rest of the site', () => {
    expect(settingsOf({ notificationPreferences: null, privacySettings: null, appearanceSettings: null })).toEqual(settingsDefaults);
  });
  it('fills missing legacy settings without losing explicitly disabled preferences', () => {
    const settings = settingsOf({ notificationPreferences: { messages: false }, privacySettings: { showCollege: false }, appearanceSettings: { theme: 'dark' } });
    expect(settings.notificationPreferences.messages).toBe(false);
    expect(settings.notificationPreferences.connections).toBe(true);
    expect(settings.privacySettings.showCollege).toBe(false);
    expect(settings.privacySettings.profileVisibility).toBe('CAMPUS');
    expect(settings.appearanceSettings).toEqual({ theme: 'dark', accent: 'orange', density: 'comfortable' });
  });
  it.each([null, [], {}, { unknown: true }, { appearanceSettings: null }, { appearanceSettings: { theme: 'invalid', accent: 'orange', density: 'comfortable' } }, { notificationPreferences: { messages: 'false' } }])('rejects malformed settings %j', body => {
    expect(updateSettingsSchema.safeParse(body).success).toBe(false);
  });
  it('updates one complete section without requiring the other sections', () => {
    expect(updateSettingsSchema.parse({ appearanceSettings: settingsDefaults.appearanceSettings })).toEqual({ appearanceSettings: settingsDefaults.appearanceSettings });
  });
  it('can still load the previous saved accent values', () => {
    expect(settingsOf({ notificationPreferences: null, privacySettings: null, appearanceSettings: { accent: 'purple' } }).appearanceSettings.accent).toBe('purple');
  });
});
