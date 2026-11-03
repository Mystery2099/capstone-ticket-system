import { describe, expect, it } from 'vitest';
import { convertPlainTextToMarkdown } from '../src/lib/ticket-content/ticket-content-format';
import {
	renderTicketContent,
	stripMarkdownSyntax
} from '../src/lib/ticket-content/ticket-content-renderer';
import { escapeLineStarts } from '../src/lib/ticket-content/ticket-markdown-line-starts';

describe('ticket Markdown preservation', () => {
	it('converts legacy draft trailing newlines without adding literal backslashes', () => {
		for (const trailingNewlines of ['\n', '\n\n', '\n\n\n', '\r\n']) {
			expect(
				renderTicketContent(convertPlainTextToMarkdown(`first\nsecond${trailingNewlines}`))
			).toBe('<p>first<br>\nsecond</p>\n');
		}
	});

	it('preserves code indentation inside list fences and resumes escaping after the fence', () => {
		for (const listPrefix of ['- ', '1. ', '  - ', '- - ']) {
			const codeBlock = `${listPrefix}\`\`\`\n  \tindent\n  \`\`\``;
			expect(escapeLineStarts(`${codeBlock}\n\ttyped`)).toBe(`${codeBlock}\n&#9;typed`);
		}
		const quotedCodeBlock = '> - ```\n>   \tindent\n>   ```';
		expect(escapeLineStarts(`${quotedCodeBlock}\n\ttyped`)).toBe(`${quotedCodeBlock}\n&#9;typed`);
	});

	it('distinguishes escaped backticks from code and preserves pasted placeholder characters', () => {
		expect(stripMarkdownSyntax('Run \\`find\\` literally.')).toBe('Run `find` literally.');
		expect(stripMarkdownSyntax('Run `find` literally.')).toBe('Run find literally.');
		expect(stripMarkdownSyntax('`\\*literal*`')).toBe('\\*literal*');
		const pastedText = '\uE0000\uE001 \uE0020\uE003 \uE000escape0\uE000';
		expect(stripMarkdownSyntax(`${pastedText} **bold** \`code\` \\*`)).toBe(
			`${pastedText} bold code *`
		);
	});
});
