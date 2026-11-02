# Role permissions

Role capabilities live in `src/lib/permissions.ts`. Both server checks and UI
controls call `hasPermission(role, permission)`. To change what a role may do,
edit its entry in `ROLE_PERMISSIONS`; add a named capability when a new operation
needs independent control. Missing and unknown roles receive no capabilities.

Agents and administrators share support capabilities: viewing all tickets,
creating tickets for others, assigning and receiving tickets, setting priority,
status and category, and reading/writing internal notes. Administrators additionally
manage accounts/categories and reopen closed tickets. Requesters may reopen their
own resolved tickets. Signed-in users can create their own tickets and post public
replies on accessible tickets that are not closed.

Ticket visibility and internal-note access are separate capabilities. Removing
internal-note access filters comments, activity, snippets, counts and search matches
on the server. Hiding a control alone never grants or revokes server permission.

Status selection during creation uses `setTicketStatus`. Without it, the server
only accepts Open. Selected Resolved or Closed statuses receive the matching
timestamp, and the creation event records initial status and priority. Drafts
preserve the selection; older drafts default to Open and Normal priority.

Permissions do not bypass record rules: disabled accounts cannot access the app,
closed tickets stay read-only until reopened, assignees must be enabled and able
to receive assignments, and categories must be active. Administration still
requires MFA. Protections for the last enabled administrator and an administrator's
own access remain in the account-management service.

This is application code configuration, not a runtime permissions editor.
