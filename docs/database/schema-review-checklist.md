# Database review checklist

Use with [schema changes](../schema-implementation.md). Check against the actual
schema and PostgreSQL; this list does not certify that a check has passed.

- Foreign keys, role references, priorities, required text, and case-insensitive uniqueness.
- Optional assignee allowed; missing, disabled, or ineligible assignee rejected.
- Ticket ownership and internal-note permissions applied to every response and search.
- Reopening and Closed-ticket rules enforced by the server.
- Mutations and their events commit or roll back together; timestamps update correctly.
- Stable list pagination and chronological conversation history.
- Realistic query plans using `EXPLAIN (ANALYZE, BUFFERS)`; connection limits and pooling.
- Restricted runtime privileges and migration credentials kept separate.
- Backup restored into a separate database with row counts and constraints verified.
- No credentials or real personal data in tracked files or fixtures.
