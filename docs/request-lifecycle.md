# Capstone Ticket System: Request and Data Flow

**Status:** Proposed SvelteKit implementation flow.

## System context

The browser never talks directly to PostgreSQL. It sends requests to the SvelteKit application, which checks the session and permissions, validates data, and runs database operations. The same general flow applies to desktop and mobile because both use the same application.

[View Mermaid diagram](diagrams/system-context.mmd)

## Creating a ticket

[View Mermaid diagram](diagrams/create-ticket-sequence.mmd)

We should return useful validation errors without inserting partial tickets. Recording creation in the audit history is the current proposal, and doing it in the same transaction means a failed insert doesn't leave an orphaned event.

## Viewing conversations without leaking internal notes

[View Mermaid diagram](diagrams/internal-notes-visibility.mmd)

Filtering private notes has to happen in the server query, before the data gets serialized to the browser. The same rule applies to snippets, counts, event details, search results, and direct comment endpoints if we ever create them. A user shouldn't be able to retrieve an internal note by altering the URL or manipulating a form.

## Status changes and audit records

For a status update, the server checks whether the user is allowed to perform that specific transition and then updates the ticket and inserts its event inside one transaction. A requester is allowed to move their own Resolved ticket back to Open, but they're not allowed to submit arbitrary status values. Agents and administrators have the broader workflow permissions described in `roles-and-workflow.md`.

[View Mermaid diagram](diagrams/status-update-transaction.mmd)

The diagrams are intentionally at the application level, not a promise about particular functions or ORM methods. We'll choose the exact Drizzle transaction calls after reviewing the schema and implementing the server actions.
