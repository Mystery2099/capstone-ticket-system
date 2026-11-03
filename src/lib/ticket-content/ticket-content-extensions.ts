/**
 * The editor's formatting set. Only what the toolbar offers is allowed, so pasted content
 * from Word, email or a web page is reduced to formatting a message can keep once it's saved.
 */
import { Extension, type Extensions } from '@tiptap/core';
import HardBreak from '@tiptap/extension-hard-break';
import { Placeholder } from '@tiptap/extensions';
import { Markdown } from '@tiptap/markdown';
import StarterKit from '@tiptap/starter-kit';
import { AppHotkeys, EditorHotkeys, toTiptapShortcut } from '$lib/hotkeys';
import { isAllowedLinkTarget } from './ticket-content-policy';

/** Ctrl/Cmd+Enter sends the message, so only Shift+Enter starts a new line in a paragraph. */
const ShiftEnterHardBreak = HardBreak.extend({
	addKeyboardShortcuts() {
		return {
			[toTiptapShortcut(EditorHotkeys.NEW_LINE)]: () => this.editor.commands.setHardBreak()
		};
	}
});

/**
 * Ctrl/Cmd+Enter belongs to the form, which sends the message. Tiptap would also use it to
 * leave a code block, adding an empty line to the end of the message just before it's sent.
 * Claiming it here stops that, and the form's own shortcut still runs.
 */
const SubmitShortcutGuard = Extension.create({
	name: 'submitShortcutGuard',
	priority: 1000,
	addKeyboardShortcuts() {
		return { [toTiptapShortcut(AppHotkeys.SUBMIT_FORM.hotkey)]: () => true };
	}
});

/** @param readPlaceholderText read on every redraw, so the hint can follow the chosen tab */
export function createTicketContentExtensions(readPlaceholderText: () => string): Extensions {
	return [
		StarterKit.configure({
			heading: { levels: [1] },
			hardBreak: false,
			horizontalRule: false,
			underline: false,
			link: {
				openOnClick: false,
				autolink: true,
				linkOnPaste: true,
				defaultProtocol: 'https',
				isAllowedUri: (linkTarget) => isAllowedLinkTarget(linkTarget),
				HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' }
			}
		}),
		ShiftEnterHardBreak,
		SubmitShortcutGuard,
		Placeholder.configure({ placeholder: () => readPlaceholderText() }),
		Markdown
	];
}
