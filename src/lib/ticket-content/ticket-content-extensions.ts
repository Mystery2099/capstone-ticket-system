/**
 * The editor's formatting set. Only what the toolbar offers is allowed, so pasted content
 * from Word, email or a web page is reduced to formatting a message can keep once it's saved.
 */
import type { Extensions } from '@tiptap/core';
import HardBreak from '@tiptap/extension-hard-break';
import { Placeholder } from '@tiptap/extensions';
import { Markdown } from '@tiptap/markdown';
import StarterKit from '@tiptap/starter-kit';
import { isAllowedLinkTarget } from './ticket-content-policy';

/** Ctrl/Cmd+Enter sends the message, so only Shift+Enter starts a new line in a paragraph. */
const ShiftEnterHardBreak = HardBreak.extend({
	addKeyboardShortcuts() {
		return { 'Shift-Enter': () => this.editor.commands.setHardBreak() };
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
		Placeholder.configure({ placeholder: () => readPlaceholderText() }),
		Markdown
	];
}
