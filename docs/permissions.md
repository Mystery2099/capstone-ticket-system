# Role permissions

Administrators manage roles at **Administration → Roles**. Migrations seed
Requester, Agent, and Administrator. Roles can be created, copied, renamed, and
assigned capabilities; account forms list saved roles.

Administrator cannot be renamed, edited, or deleted, and its administration
capability cannot be granted to custom roles. Deleting a role that has users
requires a non-administrator replacement; reassignment, session revocation,
deletion, and the audit event commit in one transaction. Reassigned users sign in again.

## Implementation

- `application_role` stores stable IDs, display names, and permission arrays.
  Renaming never changes an ID. Assignment and deletion lock role rows.
- `src/lib/permissions.ts` defines capabilities, labels, and built-in defaults.
- `hooks.server.ts` loads grants on every request; UI and server both call
  `hasPermission(user, permission)` with the hydrated user. There is no global
  cache, so edits apply on the next request. Users without loaded grants fail closed.
- Ticket visibility and internal-note access are separate capabilities. Without
  note access, the server filters comments, activity, snippets, counts, and search.
- Without `setTicketStatus`, new tickets can only be Open. Resolved and Closed set
  their matching timestamp.
- Every signed-in user can create their own tickets and reply publicly on
  accessible tickets that are not Closed.

See [workflow rules](roles-and-workflow.md) and [authentication](auth-integration.md).
