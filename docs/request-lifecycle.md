# Request flow

1. The browser sends a request to SvelteKit.
2. The server loads the session, current account state, and saved permissions.
3. The action checks access and validates input.
4. The service writes the change and its audit event in one transaction, using row
   locks for ticket mutations.
5. The server returns only data the user may see, including filtered conversations,
   snippets, counts, search results, and activity.

Ticket creation and replies use Superforms for validation, loading state, and
submission handling. Drafts and reply text remain available after failure;
successful creation removes the draft. Metadata edits use optimistic field updates.

See [workflow rules](roles-and-workflow.md) and the diagrams for
[creation](diagrams/create-ticket-sequence.mmd),
[note visibility](diagrams/internal-notes-visibility.mmd), and
[status transactions](diagrams/status-update-transaction.mmd).
