# Database design

Drizzle schemas and tracked migrations are authoritative and serve as the
column-level reference: [auth tables](../src/lib/server/auth-schema.ts),
[ticket tables](../src/lib/server/ticket-schema.ts), and
[role tables](../src/lib/server/role-schema.ts). The
[SQL proposal](database/schema-reference.sql) predates Better Auth and is kept
for reference only; do not use it for setup.

[ERD](diagrams/entity-relationship.mmd) · [Schema changes](schema-implementation.md) · [Permissions](permissions.md)

## Tables

Better Auth owns `user`, `session`, `account`, `verification`, and `two_factor`.

| Table              | Purpose                                                                                                   |
| ------------------ | --------------------------------------------------------------------------------------------------------- |
| `application_role` | Saved role names and capability grants; `user.role` references it                                         |
| `category`         | Ticket categories, with an active flag                                                                    |
| `ticket_status`    | Open, In Progress, On Hold, Resolved, and Closed                                                          |
| `ticket`           | Subject, description and its format, requester, optional assignee, status, category, priority, timestamps |
| `ticket_comment`   | Public replies and internal notes (`is_internal`), with body format                                       |
| `ticket_event`     | Server-written status, assignment, priority, and category history                                         |
| `security_event`   | Transactional administrator and operator audit records                                                    |

User IDs and their foreign keys are text. Application records use UUIDs; tickets
also have a unique generated ticket number. Timestamps use time zones. Categories,
statuses, and users are referenced rather than copied.

## Integrity and access

- Required foreign keys protect ticket relationships.
- Priority accepts `low`, `normal`, or `high` (default `normal`). Formats accept
  `plain` or `markdown`.
- A ticket has at most one assignee, who must be enabled and assignment-eligible.
- Event `details` store change metadata, never private-note bodies or credentials.
- Ticket mutations and their events commit in one transaction.

SvelteKit owns data access and authorizes before querying or returning records,
so PostgreSQL RLS is not used. Revisit that if untrusted clients ever get direct
database access.

## Indexing and recovery

Indexes support requester tickets, assignment and status filters, and chronological
comment/event history. `0003_search_subject_trigram` adds a `pg_trgm` subject index.
Full-text documents are assembled at query time from permitted content; no search
column is stored. Check plans with `EXPLAIN (ANALYZE, BUFFERS)` on realistic data.
Back up with `pg_dump` and verify restoration into a separate database.
