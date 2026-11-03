/**
 * Builds the rich-text editor. Composers load this module on demand, so reading a ticket
 * never downloads the editor.
 */
import { Editor } from '@tiptap/core';
import { createTicketContentExtensions } from './ticket-content-extensions';

export type TicketContentEditorOptions = {
	mountElement: HTMLElement;
	initialValue: string;
	isEditable: boolean;
	label: string;
	readPlaceholderText: () => string;
	onTransaction: () => void;
	onValueChange: (changedValue: string) => void;
};

/** A fenced code block, whose lines are kept exactly as written. */
const FENCED_CODE_BLOCK_PATTERN = /(^|\n)(```|~~~)[^\n]*\n[\s\S]*?\n\2[ \t]*(?=\n|$)/g;
/**
 * A line break inside a paragraph, then a line starting with something Markdown would read as
 * a heading, quote, list, rule, heading underline or code fence. Bold or code that merely
 * starts the line is left alone. Groups: the break and indentation, then the marker's first
 * symbol to escape, or the digits of a numbered-list marker whose dot gets escaped instead.
 */
const LINE_START_MARKER_PATTERN = new RegExp(
	'( {2}\\n[ \\t]*)' +
		'(?:' +
		[
			'(#)(?=#{0,5}(?:[ \\t]|$))',
			'(>)',
			'([-+*])(?=[ \\t]|$)',
			'([-=])(?=[-=]*[ \\t]*(?:\\n|$))',
			'([*_])(?=(?:[ \\t]*\\6){2,}[ \\t]*(?:\\n|$))',
			'([`~])(?=\\7{2})'
		].join('|') +
		'|(\\d{1,9})(?=[.)](?:[ \\t]|$))' +
		')',
	'gm'
);

/**
 * Tiptap writes a line break as two spaces and a newline, but doesn't escape what follows. A
 * line typed after Shift+Enter that starts with "# " or "1. " would then be saved as a
 * heading or list, though the editor showed plain text.
 */
function escapeLineStartsAfterLineBreaks(markdown: string): string {
	const escapeMarkers = (markdownOutsideCode: string) =>
		markdownOutsideCode.replace(
			LINE_START_MARKER_PATTERN,
			(lineStart, lineBreak: string, ...markerGroups: (string | undefined)[]) => {
				const [heading, quote, bullet, underline, rule, fence, listNumber] = markerGroups;
				const markerSymbol = heading ?? quote ?? bullet ?? underline ?? rule ?? fence;
				return markerSymbol ? `${lineBreak}\\${markerSymbol}` : `${lineBreak}${listNumber}\\`;
			}
		);
	let escapedMarkdown = '';
	let copiedUpTo = 0;
	for (const codeBlockMatch of markdown.matchAll(FENCED_CODE_BLOCK_PATTERN)) {
		escapedMarkdown += escapeMarkers(markdown.slice(copiedUpTo, codeBlockMatch.index));
		escapedMarkdown += codeBlockMatch[0];
		copiedUpTo = codeBlockMatch.index + codeBlockMatch[0].length;
	}
	return escapedMarkdown + escapeMarkers(markdown.slice(copiedUpTo));
}

/** The Markdown to save. A box with nothing but blank lines counts as empty. */
export function readTicketContentValue(editor: Editor): string {
	if (!editor.state.doc.textContent.trim()) return '';
	return escapeLineStartsAfterLineBreaks(editor.getMarkdown());
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
