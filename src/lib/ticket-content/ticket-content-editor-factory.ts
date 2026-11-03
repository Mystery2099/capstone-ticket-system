/**
 * Builds the rich-text editor. Composers load this module on demand, so reading a ticket
 * never downloads the editor.
 */
import { Editor } from '@tiptap/core';
import { createTicketContentExtensions } from './ticket-content-extensions';
import { escapeLineStarts } from './ticket-markdown-line-starts';

export type TicketContentEditorOptions = {
	mountElement: HTMLElement;
	initialValue: string;
	isEditable: boolean;
	label: string;
	readPlaceholderText: () => string;
	onTransaction: () => void;
	onValueChange: (changedValue: string) => void;
};

/** The Markdown to save. A box with nothing but blank lines counts as empty. */
export function readTicketContentValue(editor: Editor): string {
	if (!editor.state.doc.textContent.trim()) return '';
	return escapeLineStarts(editor.getMarkdown());
}

export function createTicketContentEditor(editorOptions: TicketContentEditorOptions): Editor {
	return new Editor({
		element: editorOptions.mountElement,
		extensions: createTicketContentExtensions(editorOptions.readPlaceholderText),
		content: editorOptions.initialValue,
		contentType: 'markdown',
		editable: editorOptions.isEditable,
		editorProps: {
			attributes: {
				role: 'textbox',
				'aria-multiline': 'true',
				'aria-label': editorOptions.label,
				class: 'ticket-content ticket-content-editor flex-1'
			}
		},
		onTransaction: editorOptions.onTransaction,
		onUpdate: ({ editor }) => editorOptions.onValueChange(readTicketContentValue(editor))
	});
}
