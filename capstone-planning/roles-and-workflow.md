# Roles, Permissions and Ticket Lifecycle (Working Draft)

**Status:** User-confirmed business rules, pending implementation and any changes requested by Professor Enke.

## Role-permission matrix

| Operation | Requester | Agent | Administrator |
|---|---|---|---|
| Sign in and view own tickets | Yes | Yes | Yes |
| Create a ticket as requester | Yes | Yes | Yes |
| View other users' tickets | No | Yes | Yes |
| Add a public comment to an accessible ticket | Yes | Yes | Yes |
| Add a private internal note | No | Yes | Yes |
| Read internal notes | No | Yes | Yes |
| Reopen own resolved ticket | Yes | Yes | Yes |
| Update ticket status during ordinary work | No | Yes | Yes |
| Reopen a Closed ticket | No | No | Yes |
| Change ticket priority | No | Yes | Yes |
| Assign or reassign a ticket | No | Yes | Yes |
| Change ticket category | No | Yes | Yes |
| Manage categories | No | No | Yes |
| Enable/disable users and change roles | No | No | Yes |
| View event history on an accessible ticket | Yes | Yes | Yes |

**Role inheritance:** Administrators inherit the agent capabilities, including viewing all tickets, assigning work, replying, adding internal notes and changing priority. Requesters can create tickets, but priority is always set to `normal` at creation; requester-submitted priority values must be ignored or rejected. Agents and administrators can change priority to `low`, `normal` or `high`.

**Server enforcement:** Check authentication, role, resource ownership, and target validity inside SvelteKit server actions/load functions or server endpoints. A hidden button is not an authorization boundary. Prevent agents from promoting themselves or changing user roles. Avoid allowing administrators to disable their only active admin account.

## Suggested ticket lifecycle

[View Mermaid diagram](diagrams/ticket-lifecycle.mmd)

`On Hold` is included in the initial status set. Requesters can reopen **their own Resolved tickets**, returning them to Open, but they cannot directly change other statuses. Agents and administrators handle ordinary ticket status changes, including resolving and closing tickets.

**Closed tickets are read-only**, including comments and internal notes, unless an administrator chooses to reopen one. Administrators are the only role allowed to reopen a Closed ticket; the proposed transition returns it to Open and records an audit event. Agents and requesters cannot reopen Closed tickets. No automatic closure or time-based workflow is planned.

## Public replies and internal notes

I want public replies and internal notes to be part of the same ticket conversation, but they cannot have the same visibility rules. Each comment will have an `is_internal` flag, and only agents or administrators will be allowed to create or read internal notes. Requesters will see public replies on their own tickets without receiving the private notes in the response at all. This rule has to cover previews and activity feeds too, not just the main conversation screen.

## Required audit events

I’d like the history to show when a ticket was created, assigned, or updated, including status, priority, and category changes. Each event should record who made the change, when it happened, and the previous and new values where those apply. Comments already store their author and timestamp, so I don’t think we need to duplicate every reply in the event table unless a requirement calls for it. When a change needs an audit event, both records should be written in the **same PostgreSQL transaction**, so we don’t end up with history that disagrees with the ticket.

## Important tests

- A requester cannot access another requester's ticket by modifying the URL.
- A requester cannot retrieve an internal note, even by guessing its ID; agents/admins can.
- A requester cannot post an internal note by submitting `is_internal=true`.
- A requester can reopen their own resolved ticket, but cannot reopen others' tickets or arbitrarily change status.
- An agent can see all tickets, including unassigned tickets.
- An agent can access an eligible ticket, assign it, and change its status.
- Assignment to a requester or disabled account fails.
- A failed status change rolls back its audit event, and a failed audit insert rolls back the status change.
- Only an administrator can change user roles or categories.
- Closed tickets reject comments, notes and other changes from requesters and agents; only an administrator can reopen one.
- An administrator can reopen a Closed ticket to Open, with a matching audit event.
- An agent cannot reopen Closed, even though they can manage ordinary status transitions.
- New tickets have Normal priority even if a requester submits a different value.
- Requesters cannot change priority; agents and administrators can choose Low, Normal or High.
- Administrators can carry out the same ticket-management actions as agents.

## Remaining questions

The four decisions about On Hold, all-ticket agent visibility, requester reopening, and private internal notes are settled. Remaining implementation details include whether a requester can reply to a Resolved ticket before reopening it and whether staff reopening a Resolved ticket should return it to Open or In Progress. Closed-ticket behavior, priority rules and administrator capabilities have now been decided. Avoid expanding scope unless the course demonstration needs it.
