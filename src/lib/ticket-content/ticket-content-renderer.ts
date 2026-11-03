/**
 * Turns a stored message into safe HTML. Saved messages, optimistic messages and drafts all
 * go through here, so a message looks the same everywhere. Runs on the server and in the
 * browser, and never needs the editor.
 *
 * Raw HTML is escaped, images are never loaded, and links only work for web and email
 * addresses. Older messages were written as plain text. Line breaks are kept, so they still
 * read the way they were typed.
 */
import MarkdownIt from 'markdown-it';
import { isAllowedLinkTarget } from './ticket-content-policy';

/** Message headings sit below the page's own headings, so # becomes an h3 and so on. */
const HEADING_LEVEL_OFFSET = 2;
const DEEPEST_HEADING_LEVEL = 6;

function createTicketMarkdownRenderer() {
	const markdownRenderer = new MarkdownIt('default', {
		html: false,
		breaks: true,
		linkify: false,
		typographer: false
	});
	// Tables have no toolbar button, and images would load remote content.
	markdownRenderer.disable(['image', 'table']);
	markdownRenderer.validateLink = (linkTarget) => isAllowedLinkTarget(linkTarget);

	const rules = markdownRenderer.renderer.rules;
	rules.link_open = (tokens, index, options, environment, renderer) => {
		tokens[index].attrSet('target', '_blank');
		tokens[index].attrSet('rel', 'noopener noreferrer nofollow');
		return renderer.renderToken(tokens, index, options);
	};
	const renderShiftedHeading: NonNullable<typeof rules.heading_open> = (
		tokens,
		index,
		options,
		environment,
		renderer
	) => {
		const headingToken = tokens[index];
		const sourceLevel = Number(headingToken.tag.slice(1));
		headingToken.tag = `h${Math.min(sourceLevel + HEADING_LEVEL_OFFSET, DEEPEST_HEADING_LEVEL)}`;
		return renderer.renderToken(tokens, index, options);
	};
	rules.heading_open = renderShiftedHeading;
	rules.heading_close = renderShiftedHeading;
	return markdownRenderer;
}

const ticketMarkdownRenderer = createTicketMarkdownRenderer();

/** The safe HTML for one message. */
export function renderTicketContent(storedContent: string): string {
	return ticketMarkdownRenderer.render(storedContent);
}

/** A message's words without any formatting, such as for a one-line draft preview. */
export function extractPlainText(storedContent: string): string {
	const plainTextParts: string[] = [];
	for (const blockToken of ticketMarkdownRenderer.parse(storedContent, {})) {
		if (blockToken.type === 'inline') {
			for (const inlineToken of blockToken.children ?? [])
				if (inlineToken.type === 'text' || inlineToken.type === 'code_inline')
					plainTextParts.push(inlineToken.content);
				else if (inlineToken.type === 'softbreak' || inlineToken.type === 'hardbreak')
					plainTextParts.push(' ');
			plainTextParts.push(' ');
		} else if (blockToken.type === 'fence' || blockToken.type === 'code_block') {
			plainTextParts.push(blockToken.content, ' ');
		}
	}
	return plainTextParts.join('').replace(/\s+/g, ' ').trim();
}

/** Backslash escapes that keep typed punctuation literal, such as \\*, for any ASCII punctuation. */
const MARKDOWN_ESCAPE_PATTERN = /\\([!-/:-@[-`{-~])/g;
/** Heading, quote and list markers at the start of a line. */
const MARKDOWN_LINE_MARKER_PATTERN =
	/^[ \t]{0,3}(?:#{1,6}[ \t]+|>[ \t]?|[-*+][ \t]+|\d+[.)][ \t]+)/gm;
const MARKDOWN_LINK_PATTERN = /\[([^\]]*)\]\([^)]*\)/g;
const MARKDOWN_EMPHASIS_PATTERN = /\*\*|__|~~|```|`/g;
/** The character references used for typed leading spaces and tabs. */
const INDENTATION_REFERENCE_PATTERN = /&#(?:32|9);/g;
/** A fenced code block, possibly cut off by the end of the excerpt. Group 2 is its code. */
const FENCED_CODE_PATTERN =
	/(^|\n)[ \t]*(?:`{3,}|~{3,})[^\n]*\n([\s\S]*?)(?:\n[ \t]*(?:`{3,}|~{3,})[ \t]*(?=\n|$)|$)/g;
/** An inline code span: a run of backticks, the code, and a matching run. Group 2 is its code. */
const INLINE_CODE_PATTERN = /(`+)([\s\S]*?[^`])\1(?!`)/g;

/**
 * Removes Markdown symbols from a fragment of a message, such as a search excerpt. A
 * fragment can start or end mid-formatting, so it can't be parsed like a whole message.
 * Single * and _ are left alone, since they're as likely to be part of a word or a path.
 */
export function stripMarkdownSyntax(markdownFragment: string): string {
	// Choose a delimiter absent from this fragment so pasted private-use text stays literal.
	let placeholderDelimiter = '\uE000';
	while (markdownFragment.includes(placeholderDelimiter)) placeholderDelimiter += '\uE000';
	const buildEscapedCharacterPlaceholder = (escapeIndex: number) =>
		`${placeholderDelimiter}escape${escapeIndex}${placeholderDelimiter}`;
	const buildCodePlaceholder = (codeIndex: number) =>
		`${placeholderDelimiter}code${codeIndex}${placeholderDelimiter}`;
	const escapedCharacterPlaceholderPattern = new RegExp(
		`${placeholderDelimiter}escape(\\d+)${placeholderDelimiter}`,
		'g'
	);
	const codePlaceholderPattern = new RegExp(
		`${placeholderDelimiter}code(\\d+)${placeholderDelimiter}`,
		'g'
	);
	// Code is content, symbols and all, so it's set aside first and put back exactly as written.
	const codeTexts: string[] = [];
	const setAsideCode = (codeText: string) => {
		codeTexts.push(codeText);
		return buildCodePlaceholder(codeTexts.length - 1);
	};
	// Escaped characters are typed punctuation, so they're set aside before symbols are removed.
	// Each is numbered, so removing a link's address, escapes and all, can't shift the rest.
	const escapedCharacters: string[] = [];
	return markdownFragment
		.replace(
			FENCED_CODE_PATTERN,
			(codeBlock, lineStart: string, codeText: string) => lineStart + setAsideCode(codeText)
		)
		.replace(INLINE_CODE_PATTERN, (codeSpan, backticks: string, codeText: string) =>
			setAsideCode(codeText)
		)
		.replace(MARKDOWN_ESCAPE_PATTERN, (escapeSequence, escapedCharacter: string) => {
			escapedCharacters.push(escapedCharacter);
			return buildEscapedCharacterPlaceholder(escapedCharacters.length - 1);
		})
		.replace(MARKDOWN_LINK_PATTERN, '$1')
		.replace(MARKDOWN_LINE_MARKER_PATTERN, '')
		.replace(MARKDOWN_EMPHASIS_PATTERN, '')
		.replace(INDENTATION_REFERENCE_PATTERN, (characterReference) =>
			characterReference === '&#9;' ? '\t' : ' '
		)
		.replace(
			escapedCharacterPlaceholderPattern,
			(placeholder, escapeIndex: string) => escapedCharacters[Number(escapeIndex)] ?? ''
		)
		.replace(
			codePlaceholderPattern,
			(placeholder, codeIndex: string) => codeTexts[Number(codeIndex)] ?? ''
		);
}
