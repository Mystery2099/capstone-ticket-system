/**
 * The appearance preferences, remembered per browser. src/app.html repeats the resolve and
 * apply steps inline so the theme is set before first paint, including on the login page;
 * keep the two in sync.
 *
 * There are two independent choices. The theme preference picks light or dark (or follows
 * the system) and sets data-theme, which drives the dark: variant and color-scheme. The
 * palette preference picks the Plum & Apricot colors (default) or the plain classic ones and
 * sets data-palette.
 */

export type ThemePreference = 'system' | 'light' | 'dark';
export type PalettePreference = 'plum' | 'classic';

const THEME_PREFERENCES: readonly ThemePreference[] = ['system', 'light', 'dark'];

export const THEME_STORAGE_KEY = 'ticket-theme';
export const PALETTE_STORAGE_KEY = 'ticket-palette';

const DARK_MODE_QUERY = '(prefers-color-scheme: dark)';

export function readThemePreference(): ThemePreference {
	const storedThemePreference = localStorage.getItem(THEME_STORAGE_KEY);
	return THEME_PREFERENCES.includes(storedThemePreference as ThemePreference)
		? (storedThemePreference as ThemePreference)
		: 'system';
}

export function readPalettePreference(): PalettePreference {
	return localStorage.getItem(PALETTE_STORAGE_KEY) === 'classic' ? 'classic' : 'plum';
}

/** Saves the theme preference and applies it to the page. */
export function saveThemePreference(themePreference: ThemePreference): void {
	localStorage.setItem(THEME_STORAGE_KEY, themePreference);
	applyThemePreference(themePreference);
}

/** Saves the palette preference and applies it to the page. */
export function savePalettePreference(palettePreference: PalettePreference): void {
	localStorage.setItem(PALETTE_STORAGE_KEY, palettePreference);
	applyPalettePreference(palettePreference);
}

export function applyThemePreference(themePreference: ThemePreference): void {
	const isDarkMode =
		themePreference === 'system'
			? matchMedia(DARK_MODE_QUERY).matches
			: themePreference === 'dark';
	document.documentElement.dataset.theme = isDarkMode ? 'dark' : 'light';
}

export function applyPalettePreference(palettePreference: PalettePreference): void {
	const rootElement = document.documentElement;
	if (palettePreference === 'classic') {
		rootElement.dataset.palette = 'classic';
	} else {
		delete rootElement.dataset.palette;
	}
}

/**
 * Applies the stored preferences now, and the theme again whenever the system theme changes.
 *
 * @returns a function that stops listening
 */
export function watchThemePreference(): () => void {
	const applyStoredThemePreference = () => applyThemePreference(readThemePreference());
	applyStoredThemePreference();
	applyPalettePreference(readPalettePreference());
	const darkModeQuery = matchMedia(DARK_MODE_QUERY);
	darkModeQuery.addEventListener('change', applyStoredThemePreference);
	return () => darkModeQuery.removeEventListener('change', applyStoredThemePreference);
}
