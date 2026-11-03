/**
 * Every keyboard shortcut the app offers, in one place. Components register their own
 * callbacks with these keys, and hints and tooltips are written from them, so changing a
 * shortcut here changes both what it does and what the app says it does.
 *
 * Keys use TanStack Hotkeys syntax. Mod is Cmd on a Mac and Ctrl everywhere else.
 */
import type { HotkeyChord } from '@tanstack/svelte-hotkeys';

export type HotkeyDefinition = {
	hotkey: HotkeyChord;
	description: string;
};

/** Shortcuts that work across the app or across a whole form. */
export const AppHotkeys = {
	FOCUS_SEARCH: { hotkey: '/', description: 'Search tickets' },
	TOGGLE_SIDEBAR: { hotkey: 'Mod+B', description: 'Show or hide the sidebar' },
	SUBMIT_FORM: { hotkey: 'Mod+Enter', description: 'Send or create' },
	CLOSE_FORM: { hotkey: 'Escape', description: 'Close the form' }
} as const satisfies Record<string, HotkeyDefinition>;

/**
 * Shortcuts inside the rich-text editor. Tiptap binds the formatting keys itself, so these
 * match its defaults and are used for tooltips. Changing one also means rebinding it on its
 * Tiptap extension. NEW_LINE is bound by the editor's own extension, which reads it from here.
 */
export const EditorHotkeys = {
	BOLD: 'Mod+B',
	ITALIC: 'Mod+I',
	STRIKETHROUGH: 'Mod+Shift+S',
	HEADING: 'Mod+Alt+1',
	BULLETED_LIST: 'Mod+Shift+8',
	NUMBERED_LIST: 'Mod+Shift+7',
	QUOTE: 'Mod+Shift+B',
	INLINE_CODE: 'Mod+E',
	CODE_BLOCK: 'Mod+Alt+C',
	UNDO: 'Mod+Z',
	REDO: 'Mod+Shift+Z',
	NEW_LINE: 'Shift+Enter'
} as const satisfies Record<string, HotkeyChord>;

/** Hint labels for keys whose names read poorly. Mod covers both platforms, as hints are rendered on the server. */
const KEY_HINT_LABELS: Record<string, string> = {
	Mod: 'Ctrl/Cmd',
	Escape: 'Esc'
};

/** The shortcut as people read it, for example 'Ctrl/Cmd+Enter'. */
export function formatHotkeyHint(hotkey: HotkeyChord): string {
	return hotkey
		.split('+')
		.map((keyName) => KEY_HINT_LABELS[keyName] ?? keyName)
		.join('+');
}

/** The shortcut in Tiptap's syntax, for example 'Mod-Enter'. */
export function toTiptapShortcut(hotkey: HotkeyChord): string {
	return hotkey.replaceAll('+', '-');
}
