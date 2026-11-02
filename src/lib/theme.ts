/**
 * The appearance preference, remembered per browser. src/app.html repeats the resolve and
 * apply steps inline so the theme is set before first paint; keep the two in sync.
 */

export type ThemePreference = 'system' | 'light' | 'dark';

export const THEME_STORAGE_KEY = 'ticket-theme';

const DARK_MODE_QUERY = '(prefers-color-scheme: dark)';

export function readThemePreference(): ThemePreference {
	return (localStorage.getItem(THEME_STORAGE_KEY) as ThemePreference | null) || 'system';
}

/** Saves the preference and applies it to the page. */
export function saveThemePreference(themePreference: ThemePreference): void {
	localStorage.setItem(THEME_STORAGE_KEY, themePreference);
	applyThemePreference(themePreference);
}

export function applyThemePreference(themePreference: ThemePreference): void {
	const resolvedTheme =
		themePreference === 'system'
			? matchMedia(DARK_MODE_QUERY).matches
				? 'dark'
				: 'light'
			: themePreference;
	document.documentElement.dataset.theme = resolvedTheme;
}

/**
 * Applies the stored preference now and again whenever the system theme changes.
 *
 * @returns a function that stops listening
 */
export function watchThemePreference(): () => void {
	const applyStoredThemePreference = () => applyThemePreference(readThemePreference());
	applyStoredThemePreference();
	const darkModeQuery = matchMedia(DARK_MODE_QUERY);
	darkModeQuery.addEventListener('change', applyStoredThemePreference);
	return () => darkModeQuery.removeEventListener('change', applyStoredThemePreference);
}
