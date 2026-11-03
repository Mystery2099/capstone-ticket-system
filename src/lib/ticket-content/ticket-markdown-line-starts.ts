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
const CODE_FENCE_PATTERN = /^(`{3,}|~{3,})/;
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
	/** The fence that opened the code block being copied, or null outside code. */
	let openCodeFence: string | null = null;
	return markdownLines
		.map((line, lineIndex) => {
			const { quotePrefix, lineContent } = splitQuotePrefix(line, Number.MAX_SAFE_INTEGER);
			const unindentedContent = lineContent.replace(INDENTATION_PATTERN, '');
			const fenceMatch = CODE_FENCE_PATTERN.exec(unindentedContent);
			if (openCodeFence) {
				// Code is copied exactly. A fence at least as long, with the same symbol, closes it.
				if (
					fenceMatch &&
					fenceMatch[1][0] === openCodeFence[0] &&
					fenceMatch[1].length >= openCodeFence.length
				)
					openCodeFence = null;
				return line;
			}
			const previousLine = lineIndex > 0 ? markdownLines[lineIndex - 1] : '';
			if (!previousLine.endsWith(HARD_BREAK_SUFFIX)) {
				// Only a fence that starts a block opens code. One typed after a line break is text.
				if (fenceMatch) {
					openCodeFence = fenceMatch[1];
					return line;
				}
				return quotePrefix + encodeTypedIndentation(lineContent);
			}
			// A line continuing a quoted paragraph repeats the quote's prefix, which stays as is.
			const previousQuoteDepth = splitQuotePrefix(previousLine, Number.MAX_SAFE_INTEGER).quoteDepth;
			const continuedLine = splitQuotePrefix(line, previousQuoteDepth);
			const indentation = INDENTATION_PATTERN.exec(continuedLine.lineContent)?.[0] ?? '';
			const lineText = continuedLine.lineContent.slice(indentation.length);
			return (
				continuedLine.quotePrefix +
				encodeTypedIndentation(indentation + escapeLeadingMarker(lineText))
			);
		})
		.join('\n');
}
