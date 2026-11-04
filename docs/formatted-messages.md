# Formatted messages

Descriptions, public replies, and internal notes use a restricted Tiptap rich-text
composer. People format text directly and never see Markdown; the editor stores
Markdown in the existing text columns. Supported formatting: bold, italic,
strikethrough, links, bulleted/numbered lists, quotes, inline code, code blocks,
and one heading level. Images, tables, attachments, and raw HTML are excluded,
and pasted content is reduced to that set.

| File (`src/lib/ticket-content/`)   | Role                                                          |
| ---------------------------------- | ------------------------------------------------------------- |
| `ticket-content-extensions.ts`     | Editor schema, link rules, Shift+Enter and Ctrl/Cmd+Enter     |
| `ticket-content-editor-factory.ts` | Builds the editor; loaded only by composers                   |
| `ticket-markdown-line-starts.ts`   | Escapes typed text that would otherwise become formatting     |
| `ticket-content-renderer.ts`       | markdown-it rendering, plain-text extraction, excerpt cleanup |
| `ticket-content-policy.ts`         | Allowed link targets (`http`, `https`, `mailto`)              |
| `ticket-content-format.ts`         | `plain`/`markdown` format and legacy draft conversion         |

`TicketContentEditor.svelte` bridges the editor to drafts and Superforms fields;
`TicketContent.svelte` renders saved, optimistic, and draft messages through the
same renderer. Rendering escapes HTML, never loads images, shifts headings below
the page headings, and opens allowed links with `rel="noopener noreferrer nofollow"`.

Migration `0005_right_marvex` adds `ticket.description_format` and
`ticket_comment.body_format`. Existing rows are `plain` and display as typed;
new rows default to `markdown`. Length limits (4,000 for descriptions, 10,000
for replies) apply to the stored Markdown. Search excerpts strip Markdown syntax.
Internal-note visibility is still enforced by server queries, not the renderer.
