# Roles and ticket workflow

## Permissions

| Action                                      | Requester | Agent | Administrator |
| ------------------------------------------- | --------- | ----- | ------------- |
| See own tickets                             | Yes       | Yes   | Yes           |
| See all tickets                             | No        | Yes   | Yes           |
| Create ticket                               | Yes       | Yes   | Yes           |
| Create ticket for another requester         | No        | Yes   | Yes           |
| Assign ticket while creating it             | No        | Yes   | Yes           |
| Public comment on accessible, active ticket | Yes       | Yes   | Yes           |
| Read/write internal notes                   | No        | Yes   | Yes           |
| Assign ticket or change status/category     | No        | Yes   | Yes           |
| Change priority (Low/Normal/High)           | No        | Yes   | Yes           |
| Reopen own Resolved ticket                  | Yes       | Yes   | Yes           |
| Reopen Closed ticket                        | No        | No    | Yes           |
| Manage users and categories                 | No        | No    | Yes           |

Admins inherit agent permissions. A requester creates tickets at Normal priority; server-side checks reject a requester-supplied priority change or a different requester. Agents see all tickets, including unassigned ones.

**Closed is read-only** until an administrator reopens it to Open. Requesters may reopen only their own Resolved tickets. There's no automatic closure.

Public comments and internal notes share the ticket conversation but have distinct visibility. Requester endpoints, list previews, searches and history must never include internal note contents. Ticket mutations and corresponding audit metadata belong in one database transaction.

[Ticket lifecycle](diagrams/ticket-lifecycle.mmd) · [Internal note visibility](diagrams/internal-notes-visibility.mmd)
