# Capstone Ticket System: Request and Data Flow

**Status:** Implemented SvelteKit request flow; hosted deployment checks remain separate.

## System context

The browser never talks directly to PostgreSQL. It sends requests to the SvelteKit application, which checks the session and permissions, validates data, and runs database operations. The same general flow applies to desktop and mobile because both use the same application.

[View Mermaid diagram](diagrams/system-context.mmd)

## Creating a ticket

[View Mermaid diagram](diagrams/create-ticket-sequence.mmd)

Ticket creation and replies use Superforms for submission state, delayed loading feedback, validation errors, and duplicate-submit prevention. New-ticket drafts remain in the browser draft store and are removed only after successful creation. Replies retain their text until success; the optimistic message derives from the pending form state. Failed requests leave the text available for retry.

Server actions return Superforms field errors and friendly domain failures. The ticket service checks permissions before input errors and writes tickets/comments with their activity events in one transaction. Metadata updates keep their existing optimistic field handling.

## Viewing conversations without leaking internal notes

[View Mermaid diagram](diagrams/internal-notes-visibility.mmd)

Filtering private notes has to happen in the server query, before the data gets serialized to the browser. The same rule applies to snippets, counts, event details, search results, and direct comment endpoints if we ever create them. A user shouldn't be able to retrieve an internal note by altering the URL or manipulating a form.

## Status changes and audit records

For a status update, the server checks whether the user is allowed to perform that specific transition and then updates the ticket and inserts its event inside one transaction. A requester is allowed to move their own Resolved ticket back to Open, but they're not allowed to submit arbitrary status values. Agents and administrators have the broader workflow permissions described in `roles-and-workflow.md`.

[View Mermaid diagram](diagrams/status-update-transaction.mmd)

The diagrams describe the application flow. The implementation uses Drizzle transactions and row locks for ticket mutations, with server-side filtering before conversation data is serialized.
