# Markdown feasibility

> The clarified requirement is rich-text editing without visible Markdown syntax.
> See [the updated needs and library assessment](formatted-content-assessment.md)
> for the current recommendation. This document retains the initial source-editor
> feasibility findings.

Assessed 2026-11-03. This is an implementation proposal based on the current code
and upstream documentation, not an implemented feature or runtime benchmark.

## Recommendation

Use **markdown-it** for ticket descriptions, comments, and internal notes. Keep the
existing textareas and add an optional Write/Preview control and short formatting
help. Store Markdown source in the existing text fields and render it through one
shared component. Keep subjects, names, categories, and activity labels plain text.

**TanStack Markdown is also a strong shortlist candidate.** Its framework-neutral
HTML entry fits the same design. Keep markdown-it as the default recommendation
for its rule controls and CommonMark focus; compare TanStack against representative
ticket text before making the final dependency choice.

This is a small, feasible extension to the current design. A rich text editor would
introduce selection handling, clipboard conversion, editor state, and Markdown
round-trip questions that the current ticket workflow does not require.

## Existing integration points

- `src/routes/app/tickets/[[id]]/CommentMessage.svelte` renders descriptions, public
  comments, internal notes, and optimistic replies. Its escaped `{body}` currently
  lives inside a paragraph with `whitespace-pre-wrap`.
- `TicketComposeForm.svelte` binds its description textarea to `draft.description`;
  `TicketReplyForm.svelte` binds its textarea to the Superforms body field.
- `src/lib/drafts.svelte.ts` persists new-ticket draft strings in local storage.
  Markdown source fits that representation without changing draft serialization.
- `src/lib/validation.ts` trims source and limits descriptions to 4,000 characters
  and replies to 10,000. Keep those limits on source, including formatting syntax.
- `src/lib/server/ticket-schema.ts` already stores description and comment body as
  text. Rendering Markdown alone requires no database migration.
- [Search](search.md) includes descriptions and visible comments. Keeping source
  preserves existing queries, though Markdown punctuation remains searchable and
  a URL or formatting delimiter can match text that is not visibly displayed.

## Library assessment

Effort below is a project-specific judgment about integration and maintenance,
not a measured comparison of speed or bundle size.

| Candidate                 | Feasibility here                                                    | Main cost                                                                 | Assessment                                            |
| ------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------- |
| markdown-it               | High; a shared string-to-HTML renderer fits all message surfaces    | Own a narrow rendering policy and HTML boundary                           | Recommended                                           |
| TanStack Markdown         | High via its framework-neutral HTML entry; no Svelte adapter needed | Validate syntax differences and enforce the restricted ticket feature set | Strong alternative; worth a focused integration spike |
| Marked plus sanitizer     | High; also works in browser and server JavaScript                   | Configure and maintain sanitization in both environments                  | Viable alternative                                    |
| unified / remark / rehype | High; suited to structured content transformations                  | More pipeline stages and plugin configuration                             | Use if content transformations become a requirement   |
| svelte-exmarkdown         | Promising; dynamic Svelte rendering and custom components           | Verify installed Svelte compatibility, SSR, and plugin safety             | Prefer if messages need interactive Svelte components |
| MDsveX                    | Poor fit for stored ticket messages                                 | Build-time preprocessing rather than ordinary runtime rendering           | Consider separately for developer-authored help pages |

**markdown-it:** upstream documents raw HTML being disabled by default and built-in
blocking of dangerous link protocols. Its rule controls allow a restrained initial
feature set. Those properties reduce the amount of custom security machinery for
this use case, provided custom renderers and plugins do not reintroduce unsafe
HTML. See the [project](https://github.com/markdown-it/markdown-it) and
[safety documentation](https://github.com/markdown-it/markdown-it/blob/master/docs/safety.md).

**TanStack Markdown (`@tanstack/markdown`):** current documentation presents a v1
synchronous parser/renderer with no runtime dependencies. The supported syntax
contract deliberately differs from full CommonMark/GFM, so treat it as a real
alternative rather than a drop-in replacement. See the
[overview](https://tanstack.com/markdown/latest/docs/overview).

For this SvelteKit app, import `renderHtml` from `@tanstack/markdown/html` inside
the proposed `renderMarkdown` wrapper. The HTML/parser entry has no framework peer
dependency and supports server and browser runtimes. Documented framework adapters
target React and Octane; neither is needed for this integration. Existing TanStack
hotkey/virtualization dependencies do not make the Markdown integration automatic.
See [installation](https://tanstack.com/markdown/latest/docs/installation).

Its defaults escape raw HTML and screen executable URLs, but it is not a general
sanitizer. Keep `allowHtml` disabled. Its `urlTransform` callback can return `null`
for images and `defaultUrl` for links, preserving built-in link screening while
preventing remote images. Callback replacements, highlighter HTML, extensions,
and directly supplied ASTs are trusted boundaries. Accept source strings rather
than user-supplied AST JSON. See
[security](https://tanstack.com/markdown/latest/docs/core-concepts/security).

Feasibility is high for rendering and preview; remaining work is policy and syntax
validation. Check literal logs, nested lists, line breaks, escaped angle brackets,
and links against the proposed ticket behavior. Verify how to suppress tables and
other unwanted syntax without regex preprocessing. If that requires appreciable
custom AST handling, markdown-it's rule controls remain the simpler choice. Use
the same renderer tests, SSR check, and production build described below. No
project-specific bundle or performance advantage has been measured, and this
assessment has not installed or executed TanStack Markdown.

**Marked:** upstream explicitly states that output is not sanitized. It recommends
filtering untrusted output. A sanitizer must be part of the rendering boundary;
browser-only sanitization would leave server-rendered output exposed. Check the
chosen sanitizer's Node requirements before adoption. See [Marked documentation](https://marked.js.org/).

**remark:** its AST and plugin ecosystem are valuable for extracting text, rewriting
links, or future ticket-reference syntax. An HTML pipeline would typically combine
parsing, Markdown-to-HTML conversion, sanitization, and serialization. The extra
configuration is difficult to justify for basic ticket formatting today. See
[remark](https://github.com/remarkjs/remark) and
[rehype-sanitize](https://github.com/rehypejs/rehype-sanitize).

**Svelte options:** svelte-exmarkdown documents dynamic rendering and GFM plugins.
Its component model is useful if a future message embeds custom UI, but that need
is not present in the current message body. MDsveX describes itself as a Svelte
Markdown preprocessor; user messages should never be compiled as executable
Svelte. See [svelte-exmarkdown](https://github.com/ssssota/svelte-exmarkdown) and
[MDsveX](https://github.com/pngwn/MDsveX).

## Proposed implementation

1. Add `src/lib/markdown.ts` with a single configured parser and a
   `renderMarkdown(source: string): string` function. Instantiate the parser once,
   outside reactive rendering. Use the same deterministic policy for SSR, browser
   preview, and optimistic messages; no DOM-dependent plugins.
2. Add `src/lib/components/MarkdownContent.svelte`. Derive output from source and
   confine HTML insertion to this component. Callers pass source, never arbitrary
   HTML. Replace the body paragraph in `CommentMessage.svelte` with this component;
   Markdown block elements must not be nested inside a paragraph.
3. Keep the textarea as the submitted form control. Add optional preview without
   destroying its value or removing its named field from submission. Preview must
   preserve validation, focus behavior, character limits, draft persistence, and
   Ctrl/Cmd+Enter. In the reply form, Write/Preview must be separate from the
   existing Comment/Internal note choice.
4. Add narrowly scoped styles for paragraphs, lists, quotes, links, and code.
   Tailwind's reset means parser output needs explicit typography. Remove inherited
   `white-space: pre-wrap` from rendered markup; preserve whitespace inside code,
   allow code blocks to scroll, and wrap long links within the reading pane.

Start with emphasis, lists, blockquotes, inline/fenced code, and explicit links.
Disable raw HTML and images explicitly. Disable tables initially to avoid wide
conversation content; add them later with an overflow wrapper if needed. Consider
`breaks: true` to keep ordinary single line breaks visible, and keep automatic
typographic substitutions off so technical text is not rewritten. Defer syntax
highlighting, task-list plugins, embeds, and automatic ticket mentions.

Keep the parser's link validation intact. If the application needs a stricter
protocol allowlist, compose it with the built-in validation rather than replacing
it permissively. Disabling images also avoids loading remote tracking resources
when a ticket is opened. Keep links in the current tab initially; new-tab links
would need an explicit `rel` policy. Review any future plugin or custom renderer
as a change to the HTML trust boundary. An allowlist sanitizer can provide defense
in depth, especially if that boundary expands.

Render only content already authorized by server queries. Markdown preview must
never fetch hidden notes or render arbitrary remote resources. Existing internal
note filtering remains the access-control boundary.

## Compatibility and rollout

No schema change is necessary if every stored body is deliberately interpreted as
Markdown. That does change historical display: `*words*`, `# lines`, indented logs,
and numbered instructions can acquire formatting. Preserving line breaks alone
does not prevent this.

For a disposable demo dataset, accepting that change is reasonable after reviewing
representative messages. For retained user content, prefer an explicit persisted
content format: old records remain plain text, new records use Markdown. This
would require a separately designed migration and carrying the format through
loaders and message props. Avoid guessing the format from punctuation or timestamps.

Do not persist generated HTML. Keeping source makes future rendering-policy fixes
effective for historical messages without rewriting their contents. Search can
remain source-based initially; visible-text indexing is a separate enhancement.

## Minimum validation before shipping

Keep verification focused:

- One renderer test file covering ordinary formatting, literal HTML, dangerous and
  encoded link schemes, disabled images, and escaped fenced code.
- Check SSR and client preview produce the same output for representative inputs.
- Manually create a formatted ticket and reply, send an internal note, reload,
  restore a ticket draft, and submit while Preview is selected. Check a narrow
  viewport, keyboard navigation, and a long code block.
- Run the existing type check and production build. Recheck the existing internal
  note access behavior if loaders or serialization change.

Before selecting a dependency version, verify its current Node/TypeScript support
and run this small integration check. This assessment does not establish exact
bundle impact, parsing latency, or installed-version compatibility. The source
limits make a simple synchronous renderer a reasonable starting point; measure
before adding workers, highlighting, or additional processing layers.

Source: GPT 6.1 Sol
