# PostgreSQL Database Design

The implemented Drizzle schema and tracked migrations are the source of truth. The linked standalone SQL reference and data dictionary preserve the earlier design proposal; they are not migration scripts.

[ERD](diagrams/entity-relationship.mmd) · [Better Auth plan](auth-integration.md) · [SQL design reference](database/schema-reference.sql) · [Data dictionary](database/data-dictionary.md) · [Review checklist](database/schema-review-checklist.md)

## Implemented tables

Better Auth owns `user`, `session`, `account`, `verification`, and `two_factor`. Definitions are in `src/lib/server/auth-schema.ts`; ticket and audit tables are in `src/lib/server/ticket-schema.ts`. The application tables include:

| Table            | Purpose                                                                                       |
| ---------------- | --------------------------------------------------------------------------------------------- |
| `category`       | Ticket categories, with an active flag                                                        |
| `ticket_status`  | Open, In Progress, On Hold, Resolved and Closed                                               |
| `ticket`         | Subject, description, requester, optional assignee, status, category, priority and timestamps |
| `ticket_comment` | Public replies and staff-only internal notes, using `is_internal`                             |
| `ticket_event`   | Server-written status, assignment, priority and category history                              |
| `security_event` | Transactional administrator and operator audit records                                        |

Ticket requester, assignee, comment author and event actor link to Better Auth `user.id`. User IDs and referencing foreign keys use text. Application records use UUIDs, alongside a separate unique, generated numeric ticket number.

## Data integrity and access

Required foreign keys protect ticket relationships. Priority accepts only `low`, `normal` and `high`, defaulting to `normal`; requesters cannot set or change priority. One enabled agent/administrator may be assigned to a ticket. Admins inherit agent capabilities, and only admins can reopen Closed tickets.

Internal note text must be excluded in the server's requester-facing queries, previews and history payloads. The audit event table should record metadata about changes, not copies of private-note bodies. Status updates and their audit records must commit in one transaction.

## Practical indexing and recovery

Indexes support requester tickets, assignment and status filters, and chronological comment/event history. Migration `0003_search_subject_trigram` enables `pg_trgm` and adds a subject GIN trigram index. Full-text search documents are assembled at query time from ticket content, names, categories and permitted comments; no search column is stored. Check query plans with realistic data before scaling. Use a `pg_dump` backup and verify restoration into another database.

PostgreSQL RLS isn't part of this first design: SvelteKit owns data access and applies authorization before querying or returning records. Revisit that if we ever expose database access to untrusted clients.

**Migration rule:** Generate Better Auth tables from its versioned schema, compose the application schema in Drizzle, and use Drizzle Kit as the one migration source of truth. Existing standalone SQL drafts are reference material, not executable migrations.
