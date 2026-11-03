/**
 * Tiptap writes a line break (Shift+Enter) as two spaces and a newline, but doesn't escape what
 * follows. A line that starts with "# " or "1. " would then be saved as a heading or list,
 * though the editor showed plain text. A typed tab at the start of a line would likewise make
 * a code block. This module fixes up the editor's Markdown before it's saved.
 */

/** A line ending in two spaces is followed by a line break, not a new paragraph. */
const HARD_BREAK_SUFFIX = '  ';
/** A quote's own prefix, repeated once per level of quoting, with any indentation. */
const QUOTE_PREFIX_PATTERN = /^(?:[ \t]*>[ \t]?)/;
const INDENTATION_PATTERN = /^[ \t]*/;
/** List markers that can contain a fence on the same line. */
const LIST_ITEM_PREFIX_PATTERN = /^[ \t]*(?:[-+*]|\d{1,9}[.)])[ \t]+/;
const CODE_FENCE_PATTERN = /^(`{3,}|~{3,})/;
/** A fence alone on its line, which is the only kind that can close a code block. */
const CLOSING_CODE_FENCE_PATTERN = /^(`{3,}|~{3,})[ \t]*$/;
/** Markers whose first symbol is escaped: heading, quote, bullet, heading underline, rule. */
const ESCAPED_FIRST_SYMBOL_PATTERNS = [
	/^#{1,6}(?=[ \t]|$)/,
	/^>/,
	/^[-+*](?=[ \t]|$)/,
	/^[-=]+[ \t]*$/,
	/^([*_])(?:[ \t]*\1){2,}[ \t]*$/,
	CODE_FENCE_PATTERN
];
/** A numbered-list marker, whose dot or bracket is escaped so the number stays visible. */
const LIST_NUMBER_PATTERN = /^(\d{1,9})([.)])(?=[ \t]|$)/;
/** Leading spaces Tiptap uses for nested lists, then indentation starting with a typed tab. */
const LEADING_TAB_PATTERN = /^( *)(\t[ \t]*)/;

type QuotedLine = { quotePrefix: string; quoteDepth: number; lineContent: string };
/** An open code block: the fence that opened it, and how many quote levels it sits in. */
type OpenCodeBlock = { openingFence: string; quoteDepth: number; indentationWidth: number };

/** How far a closing fence may sit right of its opening fence and still close the block. */
const MAXIMUM_CLOSING_FENCE_EXTRA_INDENTATION = 3;
const TAB_WIDTH = 4;

/** The width of leading spaces and tabs, with a tab counting as four columns. */
function measureIndentation(text: string): number {
	const indentation = INDENTATION_PATTERN.exec(text)?.[0] ?? '';
	return [...indentation].reduce(
		(indentationWidth, character) => indentationWidth + (character === '\t' ? TAB_WIDTH : 1),
		0
	);
}

/** Splits off a line's quote prefix, up to the given number of levels. */
function splitQuotePrefix(line: string, maximumQuoteDepth: number): QuotedLine {
	let quotePrefix = '';
	let quoteDepth = 0;
	let lineContent = line;
	while (quoteDepth < maximumQuoteDepth) {
		const prefixMatch = QUOTE_PREFIX_PATTERN.exec(lineContent);
		if (!prefixMatch) break;
		quotePrefix += prefixMatch[0];
		lineContent = lineContent.slice(prefixMatch[0].length);
		quoteDepth++;
	}
	return { quotePrefix, quoteDepth, lineContent };
}

/** Escapes a block marker at the start of text that should read as plain text. */
function escapeLeadingMarker(lineText: string): string {
	if (ESCAPED_FIRST_SYMBOL_PATTERNS.some((markerPattern) => markerPattern.test(lineText)))
		return `\\${lineText}`;
	return lineText.replace(LIST_NUMBER_PATTERN, '$1\\$2');
}

/** Writes typed leading tabs, and the spaces after them, as character references. */
function encodeTypedIndentation(lineContent: string): string {
	return lineContent.replace(
		LEADING_TAB_PATTERN,
		(lineIndentation, structuralSpaces: string, typedIndentation: string) =>
			structuralSpaces +
			[...typedIndentation].map((character) => (character === '\t' ? '&#9;' : '&#32;')).join('')
	);
}

/** Returns the editor's Markdown with line starts after line breaks, and typed tabs, escaped. */
export function escapeLineStarts(markdown: string): string {
	const markdownLines = markdown.split('\n');
	/** The code block being copied, or null outside code. */
	let openCodeBlock: OpenCodeBlock | null = null;
	/**
	 * How many quote levels the current paragraph sits in. It's set by the paragraph's first
	 * line, since a later line's ">" may be text that was escaped on the line before.
	 */
	let paragraphQuoteDepth = 0;
	return markdownLines
		.map((line, lineIndex) => {
			if (openCodeBlock) {
				// Code is copied exactly. Only a fence at the block's own quote level and indentation
				// closes it, so code containing a quoted or indented fence, such as "> ```", stays code.
				const blockLine = splitQuotePrefix(line, openCodeBlock.quoteDepth);
				const closingFenceMatch = CLOSING_CODE_FENCE_PATTERN.exec(
					blockLine.lineContent.replace(INDENTATION_PATTERN, '')
				);
				if (
					blockLine.quoteDepth === openCodeBlock.quoteDepth &&
					measureIndentation(blockLine.lineContent) <=
						openCodeBlock.indentationWidth + MAXIMUM_CLOSING_FENCE_EXTRA_INDENTATION &&
					closingFenceMatch &&
					closingFenceMatch[1][0] === openCodeBlock.openingFence[0] &&
					closingFenceMatch[1].length >= openCodeBlock.openingFence.length
				)
					openCodeBlock = null;
				return line;
			}
			const { quotePrefix, quoteDepth, lineContent } = splitQuotePrefix(
				line,
				Number.MAX_SAFE_INTEGER
			);
			let fenceContent = lineContent;
			let listPrefixLength = 0;
			let listPrefixMatch = LIST_ITEM_PREFIX_PATTERN.exec(fenceContent);
			while (listPrefixMatch) {
				listPrefixLength += listPrefixMatch[0].length;
				fenceContent = fenceContent.slice(listPrefixMatch[0].length);
				listPrefixMatch = LIST_ITEM_PREFIX_PATTERN.exec(fenceContent);
			}
			const fenceMatch = CODE_FENCE_PATTERN.exec(fenceContent.replace(INDENTATION_PATTERN, ''));
			const previousLine = lineIndex > 0 ? markdownLines[lineIndex - 1] : '';
			if (!previousLine.endsWith(HARD_BREAK_SUFFIX)) {
				paragraphQuoteDepth = quoteDepth;
				// Only a fence that starts a block opens code. One typed after a line break is text.
				if (fenceMatch) {
					openCodeBlock = {
						openingFence: fenceMatch[1],
						quoteDepth,
						indentationWidth: listPrefixLength + measureIndentation(fenceContent)
					};
					return line;
				}
				return quotePrefix + encodeTypedIndentation(lineContent);
			}
			// A line continuing a quoted paragraph repeats the quote's prefix, which stays as is.
			const continuedLine = splitQuotePrefix(line, paragraphQuoteDepth);
			const indentation = INDENTATION_PATTERN.exec(continuedLine.lineContent)?.[0] ?? '';
			const lineText = continuedLine.lineContent.slice(indentation.length);
			return (
				continuedLine.quotePrefix +
				encodeTypedIndentation(indentation + escapeLeadingMarker(lineText))
			);
		})
		.join('\n');
}
