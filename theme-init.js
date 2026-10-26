(function () {
  const THEME_KEY = 'campussphere_theme';
  const ACCENT_KEY = 'campussphere_accent';
  const DENSITY_KEY = 'campussphere_density';
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const validTheme = value => ['light', 'dark', 'system'].includes(value) ? value : 'light';
  const validDensity = value => ['compact', 'comfortable'].includes(value) ? value : 'comfortable';

  const resolve = preference => preference === 'system' ? (media.matches ? 'dark' : 'light') : preference;
  const apply = (appearance = {}, persist = false) => {
    const theme = validTheme(appearance.theme || localStorage.getItem(THEME_KEY));
    const accent = appearance.accent || localStorage.getItem(ACCENT_KEY) || 'purple';
    const density = validDensity(appearance.density || localStorage.getItem(DENSITY_KEY));
    document.documentElement.dataset.theme = resolve(theme);
    document.documentElement.dataset.themePreference = theme;
    document.documentElement.dataset.accent = accent;
    document.documentElement.dataset.density = density;
    if (persist) {
      localStorage.setItem(THEME_KEY, theme);
      localStorage.setItem(ACCENT_KEY, accent);
      localStorage.setItem(DENSITY_KEY, density);
    }
    return { theme, accent, density };
  };

  media.addEventListener('change', () => {
    if (validTheme(localStorage.getItem(THEME_KEY)) === 'system') apply();
  });
  window.CampusSphereTheme = Object.freeze({ apply, resolve, preference: () => validTheme(localStorage.getItem(THEME_KEY)) });
  apply();
})();
