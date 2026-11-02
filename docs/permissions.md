# Role permissions

Administrators manage roles at **Administration → Roles**. The migration seeds
Requester, Agent, and Administrator. Roles can be created from scratch or copied,
renamed, and assigned capabilities. User account forms list saved roles.

Administrator cannot be renamed, edited, or deleted. Its administration capability
is reserved and cannot be granted to custom roles. Deleting another role requires
a non-administrator replacement when it has users; reassignment, session revocation,
deletion, and the audit event commit in one transaction. Empty roles need no
replacement. Reassigned users sign in again.

## Implementation

`application_role` stores stable role IDs, display names, and permission arrays.
User role IDs reference it through a foreign key and indexed column. Renaming a
role never changes its ID. Role assignment and deletion lock role records.

`src/lib/permissions.ts` defines capability names, labels, and built-in defaults.
Requests load saved grants in `hooks.server.ts` and pass the hydrated user to
`hasPermission(user, permission)`. UI and server use the same checks. There is no
process-global permission cache: edits take effect on the next request. Subjects
without loaded grants fail closed. Bare role-name checks describe built-in defaults
and must not be used to authorize runtime requests.

Ticket visibility and internal-note access are separate capabilities. Removing
internal-note access filters comments, activity, snippets, counts and search matches
on the server. Hiding a control alone never changes server permission.

Status selection during creation uses `setTicketStatus`. Without it, the server
only accepts Open. Resolved and Closed receive the matching timestamp. Signed-in
users retain the baseline ability to create their own tickets and post public
replies on accessible tickets that are not closed.

Disabled accounts cannot access the app. Closed tickets stay read-only until
reopened, assignees must be enabled and permitted to receive assignments, and
categories must be active. Administration requires MFA. The last enabled
administrator and an administrator's own access remain protected.

## Deployment

Run the normal database migration before deploying this version. Reapply
`scripts/runtime-grants.sql` with the schema-owner connection so the runtime
database login can access `application_role`. No live database is changed by
the local tests.
