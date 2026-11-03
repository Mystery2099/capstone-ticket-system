# Rich text versus Markdown: needs and feasibility

Assessed 2026-11-03. Recommendation only; no application implementation.
This supersedes the editor recommendation in [Markdown feasibility](markdown-feasibility.md).

## Problem and scope

The user reports that Professor Enke expects Markdown or rich-text support.
The application serves a small support team and nontechnical requesters, using
an intentionally familiar email-like workspace. Formatting should help people
explain problems and read instructions without requiring them to learn notation.

The feature covers descriptions, public replies and internal notes. It must keep
existing validation, source-length limits, drafts, recovery, permission filtering,
optimistic sending and navigation protection. It must not grow into a document
editor, attachment system or collaboration feature.

Editing experience and storage format are separate decisions:

- **Markdown source editing:** users see delimiters such as `**bold**`, optionally
  inserted by toolbar buttons, and use preview to see final formatting.
- **Rich-text editing:** users apply formatting directly and see the result in
  the composer. The editor maintains a document model internally.
- **Markdown storage:** either editing experience can produce a Markdown string
  for PostgreSQL and existing draft storage. A rich-text document model does not
  require storing editor-specific JSON.

## Experience feasibility

| Option                                     | Nontechnical usability                                    | Engineering cost                                                       | Fit with stated needs                          |
| ------------------------------------------ | --------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------- |
| Existing textarea plus toolbar and preview | Buttons help, but Markdown syntax remains visible         | Small renderer; significant selection, undo, shortcut and toolbar work | Fails the explicit hidden-syntax requirement   |
| Packaged source editor such as Carta       | More polished source editing and less custom editing code | Relatively direct string/form integration, plus rendering policy       | Still fails hidden-syntax requirement          |
| Restricted rich-text composer              | Familiar direct formatting; no source mode required       | Editor lifecycle, form bridge and Markdown conversion must be owned    | Best fit if conversion is reliable             |
| Full document-style WYSIWYG editor         | Direct formatting, but unnecessary controls and concepts  | Larger surface, schema and maintenance burden                          | More functionality than this application needs |

Choose restricted rich text as the product direction. This is not an instruction
to replace the forms or timeline. A bounded editor component should adapt the new
input surface to the existing string-based architecture.

Success means a requester can select text, apply bold, create a list, insert a
link, undo a mistake and submit without encountering Markdown syntax. An agent
must also be able to paste technical text, create a code block, switch to an
internal note and recover unsent work. All of those operations must work with
keyboard and touch input. Preview is optional confirmation of the final layout,
not a compulsory second step for understanding what was written.

The biggest additional cost of rich text is synchronizing its document model with
the existing draft and form values reliably. The biggest cost of source editing
is imposed on the user. Given the explicit audience and hidden-syntax requirement,
the rich-text integration cost is justified, provided the supported feature set
stays narrow.

## Decision and needs

The leading implementation candidate is a **restricted Tiptap rich-text composer**, retaining Markdown strings
for drafts and persistence, with **markdown-it for read-only rendering**. Users
should see formatting while writing, not Markdown delimiters. A preview can show
the final message layout but should not be required to understand formatting.

This direction balances the clarified priorities: an email-like experience for nontechnical
users, a small feature set, and manageable application code. The choice is
conditional on a focused Markdown round-trip check: Tiptap's official Markdown
extension is currently documented as beta. Do not implement a custom serializer
to work around substantial failures. Milkdown is the next candidate if that check
fails; reverting to a visible source editor would miss the usability requirement.

The experience recommendation is firmer than the library recommendation. Tiptap
and Milkdown have not yet been integrated or tested in this application. Select
the library after a small, separately authorized editor spike; do not take this
assessment as proof that either is ready to ship.

| Need                                                      | Priority    | Project implication                                                                        |
| --------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------ |
| Format without seeing Markdown                            | Required    | Eliminates plain textareas and Carta's source editor as the default UX                     |
| Bold, italic, links, lists, code, quotes, modest headings | Required    | Restrict editor schema and toolbar to these features                                       |
| Familiar compact composer                                 | Required    | Persistent toolbar; no slash commands, document panels, or floating-menu-only controls     |
| Draft recovery and reliable submission                    | Required    | Existing draft/Superforms strings remain authoritative at application boundaries           |
| Safe public replies and private notes                     | Required    | One rendering policy; existing server authorization remains responsible for visibility     |
| Preserve historical plain text                            | Required    | Content format must be known rather than guessed from punctuation                          |
| Mobile and keyboard use                                   | Required    | Accessible labels, visible focus, touch targets, ordinary Tab navigation, scoped shortcuts |
| Images, tables, attachments, collaboration                | Excluded    | Omit editor extensions and prevent pasted content from adding them                         |
| Markdown source mode                                      | Unnecessary | Do not expose it to ordinary users                                                         |

## Feasibility of storing rich text as Markdown

**High feasibility for the requested formatting subset, with moderate integration
effort.** This would store a portable representation of the formatted message,
not an arbitrary rich-text document with every editor feature preserved.

The proposed flow is:

1. The user edits formatted content in a rich-text composer.
2. The editor's supported serializer produces a Markdown string.
3. That string updates the existing draft/form field and is submitted normally.
4. The server validates and stores it in the existing PostgreSQL text column.
5. Saved messages are rendered through the restricted Markdown renderer.
6. Draft recovery imports Markdown back into the rich-text editor. If editing
   saved messages is added later, it uses the same import path.

Users never need to see or manipulate the serialized Markdown. In-memory editor
JSON is an implementation detail, not a second persisted source of truth.

### What can be preserved

Bold, italic, links, bulleted/numbered lists, inline code, fenced code blocks,
blockquotes and headings all have Markdown representations. Those are the
requested features, making Markdown a plausible canonical format here. Supported
nesting, list starts, line breaks and mixed inline formatting still need to be
verified with the actual serializer and viewer combination.

Fonts, arbitrary sizes/colors, underline, text alignment, precise spacing,
page layout and complex embedded content do not have a portable representation
in the chosen Markdown subset. Keep those controls out of the editor and normalize
pasted Word/email/web content to the supported schema. Do not silently offer
formatting that disappears after saving. Raw HTML escape hatches would undermine
the simplicity and security of this storage choice.

The fidelity target is **equivalent supported content after saving and reloading**,
not identical Markdown bytes or pixel-identical editor/viewer layout. Different
list markers and emphasis delimiters can represent the same content. Conversely,
losing a deliberate line break, code indentation, link target or list nesting is a
real failure. Repeated save/load cycles must not progressively change the message.

### Project-specific benefits and costs

The existing database fields, draft serialization, Superforms field names and
server input types can remain strings. Markdown also avoids coupling persisted
messages to an editor's JSON schema. It does not remove dependency on a documented
Markdown dialect and renderer policy.

The bridge must update `draft.description` and `$replyFields.body` reliably,
including toolbar actions, undo, paste and IME composition. Serialize on document
changes without resetting the editor from that value on each update. Flush any
pending work before submission or leaving the page. Draft restoration preserves
content, not necessarily selection or undo history.

Existing limits apply to serialized source: a displayed word formatted as bold
uses more stored characters than the same plain word. Keep the 4,000/10,000 limits
unless deliberately changing that contract, and explain the counter appropriately.
Markdown-only punctuation or an empty editor paragraph must not accidentally pass
the required-message check; consider visible-content validation in addition to
the existing nonblank-string validation. The server must remain authoritative.

Choose one explicit newline policy for editor export and viewing. Do not assume
that the earlier source-editor recommendation of `breaks: true` is automatically
correct for serialized rich text: the serializer may distinguish paragraph breaks,
hard breaks and soft wraps differently. Verify editor and viewer together before
fixing this setting.

### Risks and adoption gate

Tiptap documents Markdown import/export, including `getMarkdown()` and Markdown
content loading. Its official extension is currently beta, so feasibility of the
format is stronger than proof of this particular implementation. See
[basic usage](https://tiptap.dev/docs/editor/markdown/getting-started/basic-usage)
and [current extension status](https://tiptap.dev/docs/editor/markdown).

Before adopting it, verify a small round-trip corpus: each supported feature,
mixed/nested formatting, literal Markdown punctuation typed by a nontechnical
user, backticks inside code, pasted multiline logs, intentional line breaks,
empty content, Unicode and near-limit messages. Check both recovered drafts and
saved-message rendering. These tests have not yet been performed for the editor.

Markdown storage is not sanitization. Continue to disable raw HTML and remote
images, enforce link policy, and render optimistic messages through the same
boundary as saved messages. Authorization for internal notes stays independent.

Existing plain-text rows remain an explicit rollout issue. No text-column type
change is required, but preserving their display requires a format distinction or
a carefully verified data conversion. A small format flag migration remains the
recommended route if real historical content must be preserved.

**Storage recommendation:** use Markdown for this deliberately limited rich-text
feature if the editor round-trip gate passes. If future requirements expand to
arbitrary document styling, reconsider an editor document format instead of
inventing nonstandard Markdown or adding embedded HTML. Do not persist both JSON
and Markdown as competing canonical versions simply to bypass conversion concerns.

## Candidate comparison

| Approach                                                  | Editing experience                                                           | Integration cost here                                                               | Maintenance judgment                                                                                    |
| --------------------------------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Tiptap + official Markdown extension + markdown-it viewer | Direct rich text; application supplies a small toolbar using editor commands | Moderate: lifecycle, string synchronization, hidden form field, conversion contract | Recommended direction; constrain schema and verify beta conversion                                      |
| Milkdown, optionally Crepe                                | WYSIWYG Markdown framework                                                   | Moderate: Svelte lifecycle wrapper, toolbar/theming and form bridge                 | Strong alternative when Markdown-native editing is decisive; evaluate core before adopting all of Crepe |
| Carta editor/viewer + sanitizer                           | Markdown source with toolbar, shortcuts and preview                          | Lower form disruption; string binding and textarea attributes                       | Best source-editor option, but does not satisfy hidden-syntax requirement                               |
| Textarea + markdown-it                                    | Source editing; toolbar/preview must be built                                | Low renderer effort, meaningful editor effort                                       | Best standalone renderer; not a complete UX solution                                                    |
| Textarea + TanStack Markdown                              | Same source-editor limitation                                                | Similar wrapper; additional syntax policy work                                      | Viable renderer, weaker fit for the chosen ticket contract                                              |
| Textarea + Svelte Markdown                                | Same source-editor limitation; Svelte component rendering                    | Policy wrapper and custom toolbar                                                   | Useful for custom rendered components, unnecessary for these static message bodies                      |
| Textarea + Marked + sanitizer                             | Same source-editor limitation                                                | Own editor and sanitizer configuration                                              | Viable, no compelling advantage over markdown-it for this app                                           |

MDsveX remains inappropriate for runtime ticket content. A general remark pipeline
is feasible but does not itself provide an editor or reduce the integration work.

## Maintenance, compatibility and dependency evidence

The registry and installed manifests were checked on the assessment date:

- Carta 4.11.5, published October 7, explicitly peers on Svelte 5. Its installed
  implementation forwards textarea properties and provides bound string values.
- Svelte Markdown 2.2.0, published October 28, explicitly peers on Svelte 5. Its
  installed manifest has runtime dependencies on Marked, htmlparser2,
  github-slugger, and a memory-cache package. Do not interpret its site's
  zero-dependency headline as the installed dependency graph.
- TanStack Markdown 1.2.0, published November 2, has framework-neutral HTML output
  and bundled TypeScript declarations. React/Octane adapters are unnecessary here.
- markdown-it 15.0.3, published October 16, has bundled TypeScript declarations.
  Older advice to automatically add `@types/markdown-it` should not be applied to
  this tested version. Its parser dependencies are more extensive than TanStack's.
- Marked 18.1.3 was published November 2. Sanitization remains a separate concern.
- Tiptap core and Markdown 3.32.2 were published October 30; official documentation
  includes a Svelte integration and Svelte 5 example. Markdown support is beta.
- Milkdown core/Crepe 7.23.0 were published October 27. Milkdown is based on
  ProseMirror and remark. Crepe's manifest includes additional UI, CodeMirror,
  math, and Vue dependencies; it should not be assumed to be the smallest editor.

Recent publication establishes activity, not long-term support or accessibility.
Sources: the corresponding package metadata at the
[npm registry](https://registry.npmjs.org/),
[Tiptap Svelte guide](https://tiptap.dev/docs/editor/getting-started/install/svelte),
[Tiptap Markdown documentation](https://tiptap.dev/docs/editor/markdown), and
[Milkdown repository](https://github.com/Milkdown/milkdown).

Tiptap introduces an editor document model internally. That does not require JSON
storage in PostgreSQL. Editor updates can serialize into the existing string
fields. Its costs are client initialization and a more substantial editor bundle;
load it only for composers. Saved messages should not instantiate editor instances.

Carta includes unified/remark/rehype and Shiki dependencies plus its editor
behavior. It is not just a textarea helper. Its string binding, history and
customizable toolbar are real advantages over hand-building source editing.
Its preview/viewer require a sanitizer and consistent server/client configuration.
See [Carta setup](https://beartocode.github.io/carta/getting-started) and
[core configuration](https://beartocode.github.io/carta/api/core).

No application bundle or mobile latency benchmark was performed. Tarball size,
dependency count, and upstream streaming benchmarks are not equivalent to this
application's incremental download or input latency. For these bounded messages,
editor loading and interaction correctness matter more than selecting the fastest
parser from an unrelated benchmark.

## markdown-it versus TanStack Markdown

An isolated Node spike installed markdown-it 15.0.3 and TanStack Markdown 1.2.0
outside this repository. It exercised synthetic ticket prose, lists, quotes,
code, paths, raw HTML, images and URLs. This was not a browser security audit,
Svelte integration test or performance benchmark.

markdown-it used `html: false`, `breaks: true`, `linkify: false`,
`typographer: false`, with image, table and strikethrough rules disabled. TanStack
used `allowHtml: false`, `frontmatter: false`, `headingIds: false`, and
`urlTransform` returning `null` for images and the built-in result for links.

| Case                                                    | markdown-it result                                                               | TanStack result                                                      | Relevance                                                                                |
| ------------------------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Bold, italic, ordered lists, quotes, inline/fenced code | Supported                                                                        | Supported                                                            | Both cover core reading requirements                                                     |
| Single newline inside paragraph                         | Explicit break with configured option                                            | Text newline, normally collapsed by HTML layout                      | markdown-it makes a message-style line policy easier                                     |
| Four-space-indented log                                 | Code block                                                                       | Paragraph                                                            | Existing technical snippets can differ                                                   |
| Leading frontmatter-like block                          | Displayed as Markdown blocks                                                     | Hidden in default configuration; displayed with frontmatter disabled | TanStack defaults need deliberate adjustment for tickets                                 |
| Table input                                             | Literal pipe text with rule disabled                                             | Table                                                                | markdown-it offers direct syntax controls                                                |
| Markdown image                                          | No image request; disabled image syntax can become an exclamation mark plus link | No image request; label retained with URL policy                     | Both can meet privacy requirement, fallback appearance differs                           |
| Raw HTML tags                                           | Escaped                                                                          | Escaped                                                              | Both can reject raw HTML without compiling user content                                  |
| Direct javascript URL                                   | Not an active link                                                               | Link wrapper removed                                                 | Both screened the tested direct scheme                                                   |
| Custom application URL scheme                           | Accepted by default                                                              | Rejected by default                                                  | markdown-it needs an application allowlist if only ordinary web/mail links are permitted |
| Task-list syntax                                        | Ordinary list text                                                               | Disabled checkbox                                                    | Built-in feature scope differs                                                           |

Encoded URL handling differed too: for `jav&#x61;script:`, markdown-it rejected
the decoded scheme, while TanStack emitted an escaped entity sequence in the
attribute. That observation alone does not establish an executable URL or an XSS
vulnerability. Apply the same application URL policy and verify browser behavior
rather than judging safety by substring inspection.

TanStack's deterministic AST and focused entry points are attractive. Its public
options do not provide markdown-it's general rule-disable interface or an
equivalent `breaks` switch. Transforms or rendering changes can bridge those gaps,
but that is extra policy code. It deliberately targets a documented syntax profile
rather than full CommonMark/GFM. See
[syntax profile](https://tanstack.com/markdown/latest/docs/core-concepts/syntax-profile),
[parser options](https://tanstack.com/markdown/latest/docs/reference/parser), and
[markdown-it documentation](https://markdown-it.github.io/markdown-it/).

For rich-text-generated Markdown, parser differences are less important than they
are for arbitrary source editing: we control the serializer. Nevertheless,
markdown-it's controls make it my preferred read-only renderer. Render a fixed
supported subset and test it against Tiptap's output, especially hard breaks and
nested lists. The editor can normalize Markdown syntax; preserving source bytes
is not a requirement for new rich-text messages, preserving meaning is.

## Security and usability

Use the same message renderer for final preview, descriptions, replies, notes,
and optimistic messages. Disable raw HTML and images. Restrict links to an explicit
policy, preserving the parser's built-in screening. Do not install custom HTML
plugins or highlighters initially. Prefix or omit heading IDs across messages,
and map headings to appropriate levels under the page's existing heading.
Treat clipboard HTML and link-entry dialogs as input paths too; an editor schema
is not a replacement for safe saved-message rendering.

Marked explicitly does not sanitize generated HTML; pairing it with DOMPurify
requires a server-side DOM solution for SSR, while sanitize-html supplies a
different dependency/configuration tradeoff. Neither removes the need for an
editor. See [Marked](https://marked.js.org/).

Svelte Markdown supports custom components and built-in URL/attribute controls,
but its security documentation identifies remaining raw-HTML risks. Block all
raw HTML and independently block Markdown image nodes; HTML-tag filtering alone
is not an image policy. Its custom-component advantages are not needed here.
See [component API](https://markdown.svelte.page/docs/api/svelte-markdown) and
[security](https://markdown.svelte.page/docs/advanced/security).

For accessibility, use labeled toolbar buttons and a visible label/error
association on the editor surface. Provide keyboard commands scoped to the active
composer, keep Tab usable for navigation, and avoid stealing browser shortcuts.
Toolbar commands must preserve selection and undo. On mobile, avoid split panes
and hover-only controls; verify touch selection, the soft keyboard, long code and
link dialogs. None of the assessed editors has been accessibility-tested in this
application. Library claims are not acceptance evidence.

## Implementation outline for review

1. Introduce one `TicketContentEditor.svelte`: restricted Tiptap schema, fixed
   toolbar, link dialog, accessible content surface, string value bridge and named
   hidden form control. Internal JSON stays private to the wrapper. Mount/destroy
   the editor with the component, not on every keystroke.
2. Bind compose output to `draft.description`, and reply output to
   `$replyFields.body`. Preserve the existing parent ownership and reset rules.
   Do not push every serialized update back through `setContent`: that can reset
   selection, undo and composition. Flush pending serialization before submit or
   navigation. Keep editor and toolbar read-only while sending.
3. Keep existing 4,000/10,000 source-character limits and server-side Zod checks.
   A rich-text editor has no native `maxlength` equivalent. Count serialized
   Markdown and show validation when formatting pushes it over the limit; never
   silently truncate serialization. Whitespace-only editor documents must map to
   the existing empty/required behavior.
4. Add `ticket-content.ts` for the supported rendering policy and
   `TicketContent.svelte` for escaped plain text or safe rendered Markdown.
   Replace only the body region in `CommentMessage.svelte`; use a block container.
   An optional final-layout preview calls that same renderer.
5. Preserve existing form-scoped Mod+Enter/Escape behavior and navigation warning.
   Define Escape precedence for the link dialog before closing a composer. The
   inspected reply form does not use the compose-hotkey attachment, so confirm
   desired reply shortcuts explicitly rather than assuming they already exist.
6. Keep `ticket-commands.ts` responsible for validation, access and persistence.
   Never trust submitted HTML or editor JSON. Carry an explicit content format
   through records/loaders if historical plain-text preservation is required.

The current text columns need no type change for Markdown. However, automatically
interpreting every old value as Markdown changes historical display. Prefer a
small content-format migration that marks existing rows plain text and new rows
Markdown. Keeping columns as text and adding a format flag are compatible choices.
Do not infer format from a date or punctuation. An alternative data conversion
would also be a migration and requires its own fidelity checks.

Before implementation approval, the main risk to accept is the beta Markdown
bridge. A later integration spike should verify serialize/reload equivalence for
the supported formatting, literal punctuation and pasted logs; draft recovery;
limit/empty validation; failed submission; undo; IME; desktop/mobile focus; and
public/internal-note switching. Test the rendering boundary with hostile inputs.
If Tiptap conversion is unreliable, assess Milkdown's Markdown-native path rather
than accumulating conversion patches. No such editor integration has been tested
or implemented as part of this research.
