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
