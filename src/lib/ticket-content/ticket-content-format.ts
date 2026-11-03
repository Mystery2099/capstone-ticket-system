/**
 * How a stored description or comment is written. Messages saved before rich text existed
 * are plain text and show exactly as typed. Everything written since is Markdown.
 */
export const TicketContentFormat = {
	PLAIN: 'plain',
	MARKDOWN: 'markdown'
} as const;
export type TicketContentFormat = (typeof TicketContentFormat)[keyof typeof TicketContentFormat];

/** Every ASCII punctuation character, which Markdown lets a backslash turn into plain text. */
const MARKDOWN_PUNCTUATION_PATTERN = /[!-/:-@[-`{-~]/g;

/**
 * Rewrites plain text as Markdown that shows exactly the same characters, such as a draft
 * written before rich text existed. Punctuation is escaped so nothing becomes formatting,
 * single line breaks are kept, and leading spaces stay spaces instead of making a code block.
 */
export function convertPlainTextToMarkdown(plainText: string): string {
	return plainText
		.replace(/\r\n?/g, '\n')
		.split('\n')
		.map((line) =>
			line
				.replace(MARKDOWN_PUNCTUATION_PATTERN, (punctuation) => `\\${punctuation}`)
				.replace(/^ +/, (indentation) => '&#32;'.repeat(indentation.length))
		)
		.join('\\\n')
		.replace(/\\\n\\\n/g, '\n\n');
}
