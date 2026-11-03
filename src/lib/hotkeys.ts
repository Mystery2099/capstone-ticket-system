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
	CLOSE_FORM: { hotkey: 'Escape', description: 'Close the form' },
	SHOW_SHORTCUTS: { hotkey: '?', description: 'Show keyboard shortcuts' }
} as const satisfies Record<string, HotkeyDefinition>;

/**
 * Shortcuts inside the rich-text editor. Tiptap binds the formatting keys itself, so these
 * match its defaults and are used for tooltips. Changing one also means rebinding it on its
 * Tiptap extension. NEW_LINE is bound by the editor's own extension, which reads it from here.
 */
export const EditorHotkeys = {
	BOLD: { hotkey: 'Mod+B', description: 'Bold' },
	ITALIC: { hotkey: 'Mod+I', description: 'Italic' },
	STRIKETHROUGH: { hotkey: 'Mod+Shift+S', description: 'Strikethrough' },
	HEADING: { hotkey: 'Mod+Alt+1', description: 'Heading' },
	BULLETED_LIST: { hotkey: 'Mod+Shift+8', description: 'Bulleted list' },
	NUMBERED_LIST: { hotkey: 'Mod+Shift+7', description: 'Numbered list' },
	QUOTE: { hotkey: 'Mod+Shift+B', description: 'Quote' },
	INLINE_CODE: { hotkey: 'Mod+E', description: 'Inline code' },
	CODE_BLOCK: { hotkey: 'Mod+Alt+C', description: 'Code block' },
	UNDO: { hotkey: 'Mod+Z', description: 'Undo' },
	REDO: { hotkey: 'Mod+Shift+Z', description: 'Redo' },
	NEW_LINE: { hotkey: 'Shift+Enter', description: 'New line without a new paragraph' }
} as const satisfies Record<string, HotkeyDefinition>;

export type HotkeyGroup = {
	title: string;
	hotkeys: readonly HotkeyDefinition[];
};

/** Every shortcut, grouped the way the keyboard shortcuts dialog lists them. */
export const HOTKEY_GROUPS: readonly HotkeyGroup[] = [
	{ title: 'General', hotkeys: Object.values(AppHotkeys) },
	{ title: 'Text editor', hotkeys: Object.values(EditorHotkeys) }
];

/** Hint labels for keys whose names read poorly. Mod covers both platforms, as hints are rendered on the server. */
const KEY_HINT_LABELS: Record<string, string> = {
	Mod: 'Ctrl/Cmd',
	Escape: 'Esc'
};

/** Each key of the shortcut as people read it, for example ['Ctrl/Cmd', 'Enter']. */
export function getHotkeyKeyLabels(hotkey: HotkeyChord): string[] {
	return hotkey.split('+').map((keyName) => KEY_HINT_LABELS[keyName] ?? keyName);
}

/** The shortcut as people read it, for example 'Ctrl/Cmd+Enter'. */
export function formatHotkeyHint(hotkey: HotkeyChord): string {
	return getHotkeyKeyLabels(hotkey).join('+');
}

/** The shortcut in Tiptap's syntax, for example 'Mod-Enter'. */
export function toTiptapShortcut(hotkey: HotkeyChord): string {
	return hotkey.replaceAll('+', '-');
}
