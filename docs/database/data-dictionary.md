# Data dictionary

The Drizzle definitions are the column-level reference:

- [Auth tables](../../src/lib/server/auth-schema.ts): identity, credentials, sessions, MFA.
- [Ticket tables](../../src/lib/server/ticket-schema.ts): categories, statuses, tickets,
  comments, ticket events, and security events.
- [Role tables](../../src/lib/server/role-schema.ts): saved roles and capabilities.
- [Composed schema](../../src/lib/server/schema.ts): application schema exports.

User IDs and their foreign keys are text. Ticket, category, comment, and event IDs
are UUIDs. Tickets also have a unique generated numeric display number. Timestamps
use time zones; assignment and resolution/closure timestamps may be absent.

Comments use `is_internal` for visibility. Event `details` stores change metadata,
not private-note bodies or credentials. Categories/statuses/users are referenced
rather than copied, and comments/events are separate child records.

See [database design](../database-design.md) for relationships and constraints and
[permissions](../permissions.md) for saved roles. The older
[SQL proposal](schema-reference.sql) predates Better Auth and must not be used for setup.
