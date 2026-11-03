# Architecture

One SvelteKit application serves desktop and mobile browsers. Server routes and
actions validate sessions, permissions, and input before accessing PostgreSQL.
The browser never connects directly to the database.

| Layer                                       | Responsibility                                     |
| ------------------------------------------- | -------------------------------------------------- |
| Svelte 5, Tailwind 4, shadcn-svelte/Bits UI | Responsive ticket workspace                        |
| Tiptap, markdown-it                         | [Formatted messages](formatted-messages.md)        |
| SvelteKit server routes/actions             | Validation, authorization, workflows, transactions |
| Better Auth                                 | Passwords, sessions, MFA, auth tables              |
| Drizzle ORM / Kit                           | Queries, schema, tracked migrations                |
| PostgreSQL                                  | Persistence, constraints, indexes                  |

## Request flow

1. The server loads the session, current account state, and saved permissions on
   every request, so disabled accounts and stale sessions cannot retain access.
2. The action checks access and validates input.
3. The service writes the change and its audit event in one transaction, using row
   locks for ticket mutations.
4. The server returns only data the user may see. Internal notes are filtered
   before serialization, including snippets, counts, search results, and activity.

Ticket creation and replies use Superforms. Drafts and reply text survive a failed
submission; successful creation removes the draft. Metadata edits are optimistic.
Keyboard shortcuts are defined once in `src/lib/hotkeys.ts`; `?` lists them.

Diagrams: [architecture](diagrams/system-architecture.mmd),
[creation](diagrams/create-ticket-sequence.mmd),
[note visibility](diagrams/internal-notes-visibility.mmd), and
[status transactions](diagrams/status-update-transaction.mmd). See also
[authentication](auth-integration.md) and [database design](database-design.md).
