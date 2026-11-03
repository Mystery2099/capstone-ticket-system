/**
 * How a stored description or comment is written. Messages saved before rich text existed
 * are plain text and show exactly as typed. Everything written since is Markdown.
 */
export const TicketContentFormat = {
	PLAIN: 'plain',
	MARKDOWN: 'markdown'
} as const;
export type TicketContentFormat = (typeof TicketContentFormat)[keyof typeof TicketContentFormat];
