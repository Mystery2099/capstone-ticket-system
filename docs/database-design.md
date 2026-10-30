# PostgreSQL Database Design — Working Proposal

This is a **design proposal**, not a migrated or validated database. The aim is to demonstrate genuine relational behavior without adding tables that don't help this class project.

[ERD](diagrams/entity-relationship.mmd) · [Better Auth plan](auth-integration.md)

## Planned tables

Better Auth owns `user`, `session`, `account` and `verification`. We'll generate their definitions with the actual installed Better Auth version instead of hand-writing them. Our five application tables are:

| Table | Purpose |
|---|---|
| `category` | Ticket categories, with an active flag |
| `ticket_status` | Open, In Progress, On Hold, Resolved and Closed |
| `ticket` | Subject, description, requester, optional assignee, status, category, priority and timestamps |
| `ticket_comment` | Public replies and staff-only internal notes, using `is_internal` |
| `ticket_event` | Server-written status, assignment, priority and category history |

Ticket requester, assignee, comment author and event actor link to Better Auth `user.id`. Its IDs are strings by default; these foreign keys should use the generated compatible type, rather than UUID. Our app records can use UUIDs, alongside a separate readable numeric ticket number.

## Data integrity and access

Required foreign keys protect ticket relationships. Priority accepts only `low`, `normal` and `high`, defaulting to `normal`; requesters cannot set or change priority. One enabled agent/administrator may be assigned to a ticket. Admins inherit agent capabilities, and only admins can reopen Closed tickets.

Internal note text must be excluded in the server's requester-facing queries, previews and history payloads. The audit event table should record metadata about changes, not copies of private-note bodies. Status updates and their audit records must commit in one transaction.

## Practical indexing and recovery

Start with indexes supporting requester tickets, assigned/unassigned queues, status filters and chronological comment/event history. Check real query plans after seeding data rather than adding indexes speculatively. Use a `pg_dump` backup and verify restoration into another database.

PostgreSQL RLS isn't part of this first design: SvelteKit owns data access and applies authorization before querying or returning records. Revisit that if we ever expose database access to untrusted clients.

**Migration rule:** Generate Better Auth tables from its versioned schema, compose the application schema in Drizzle, and use Drizzle Kit as the one migration source of truth. Existing standalone SQL drafts are reference material, not executable migrations.
