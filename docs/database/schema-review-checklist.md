# PostgreSQL Review and Testing Checklist

The following are checks to complete when we turn the design into Drizzle migrations. The schema is not considered validated until the tests actually run against PostgreSQL.

- [ ] Generate Drizzle migration from the reviewed schema; do not maintain the reference SQL as a competing migration.
- [ ] Verify uniqueness regardless of email/category capitalization.
- [ ] Verify valid roles, priorities, statuses and all required foreign keys.
- [ ] Verify empty subjects, descriptions, comments and display names are rejected.
- [ ] Verify a ticket can be unassigned but cannot reference a missing assignee.
- [ ] Verify the server rejects assigning tickets to disabled accounts and requesters.
- [ ] Verify requester reads return only their tickets and no internal notes, including history and previews.
- [ ] Verify agents can read all tickets and write internal notes, without user-management privileges.
- [ ] Verify a requester can reopen only their own resolved ticket.
- [ ] Verify a ticket update and its event both commit or both roll back.
- [ ] Verify `created_at` and `updated_at` behavior, including meaningful comment/assignment changes.
- [ ] Verify filtered lists and comment threads are stable with pagination.
- [ ] Check common query plans using sample data and `EXPLAIN (ANALYZE, BUFFERS)`.
- [ ] Confirm connection and pooling settings match local development and eventual hosting.
- [ ] Test `pg_dump` and restore to a different database; verify restored row counts and constraints.
- [ ] Verify no credentials or real personal data are in the repository or seed dataset.
