# Database Design: Support Ticket Management System

**Course:** CISY 8503 Applied Database Management  
**Lab:** Open Source Database Lab  
**Status:** Current as of November 4, 2026  
**Project:** [Capstone Ticket System](https://github.com/Mystery2099/capstone-ticket-system)  
**Database:** PostgreSQL

## Introduction

This document describes the tables behind the ticket system, the rules that keep them consistent, and how the schema changes over time. The Drizzle schema files and tracked migrations are the authoritative, column-level reference: [auth tables](../src/lib/server/auth-schema.ts), [ticket tables](../src/lib/server/ticket-schema.ts), and [role tables](../src/lib/server/role-schema.ts), composed together in `src/lib/server/schema.ts`. The [entity relationship diagram](diagrams/entity-relationship.mmd) shows the relationships visually.

## 1. Tables

Better Auth owns the `user`, `session`, `account`, `verification`, and `two_factor` tables, which hold accounts, sign-in sessions, password credentials, and MFA secrets. The remaining tables belong to the application.

| Table              | Purpose                                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------------- |
| `application_role` | Saved role names and capability grants; `user.role` references it                                             |
| `category`         | Ticket categories, with an active flag                                                                        |
| `ticket_status`    | Open, In Progress, On Hold, Resolved, and Closed                                                              |
| `ticket`           | Subject, description and its format, requester, optional assignee, status, category, priority, and timestamps |
| `ticket_comment`   | Public replies and internal notes (`is_internal`), with the body's format                                     |
| `ticket_event`     | Server-written history of status, assignment, priority, category, and content changes                         |
| `security_event`   | Transactional audit records of administrator and operator actions                                             |
| `ticket_follower`  | Who hears about a ticket: its requester, its assignee, and staff who chose to follow it                       |
| `notification`     | Inbox items that point at a ticket (and optionally a comment); never a copy of the message                    |

## 2. Keys and data types

User IDs, and the foreign keys that point to them, are text, because that is how Better Auth generates them. Roles and statuses also use readable text keys, such as `agent` or `resolved`, since migrations seed them with fixed values. Every other application record uses a UUID, and tickets also have a unique generated ticket number so people can refer to "ticket 1046" instead of a UUID. Ticket, comment, event, and notification timestamps include a time zone; the Better Auth tables use the library's own timestamp columns without one. Categories, statuses, and users are referenced by key rather than copied into tickets, so renaming a category changes it everywhere at once.

## 3. Integrity rules

Required foreign keys protect every relationship a ticket depends on, so a ticket cannot point at a missing requester, category, or status. Priority only accepts `low`, `normal`, or `high`, defaulting to `normal`, and message formats only accept `plain` or `markdown`. A ticket has at most one assignee, and the server only accepts an assignee who is enabled and eligible for assignment.

Event `details` store metadata about a change, such as the old and new status, but never the body of a private note or any credential. Every ticket mutation and its event commit in one transaction, with the ticket row locked while it changes. That way a failed history insert rolls back the change itself, and two people editing the same ticket cannot interleave their updates.

## 4. Access control

I decided not to use PostgreSQL row-level security. SvelteKit owns all data access, and it checks the user's capabilities before querying and again before returning records, so the database is never reachable by an untrusted client. Instead, the application connects with a restricted login whose grants are described in the [security and data recovery plan](security-and-recovery-plan.md). If untrusted clients were ever given direct database access, row-level security would need to be reconsidered.

## 5. Indexing and search

Indexes support the queries the application runs most: a requester's own tickets, filters by assignee and status, and comments and events in chronological order. Migration `0003_search_subject_trigram` adds a `pg_trgm` index on subjects for typo-tolerant search. Full-text documents are assembled at query time from content the user is allowed to see, so no search column is stored that could accidentally include an internal note. When checking performance, I use `EXPLAIN (ANALYZE, BUFFERS)` with realistic amounts of data. How search behaves for users is described in [architecture](architecture.md).

## 6. Changing the schema

I never change the hosted tables by hand; every change goes through a migration in `drizzle/` so a new database can be built to exactly the same structure. I start by updating the Drizzle schema, checking that the change is compatible with the installed Better Auth plugins, since they expect certain columns to exist. Running `pnpm db:generate` produces the migration SQL and a snapshot, and I read both before going further, because a generated migration can drop or rewrite more than intended.

Before deploying any code that depends on the change, I run `pnpm db:migrate` against the hosted database with the deployment credentials. If the change added a table, I reapply `scripts/runtime-grants.sql` so the restricted runtime login can use it. Migrations create the required statuses and built-in roles, never accounts or sample tickets. I prefer backward-compatible changes that expand the schema first, migrate data second, and remove anything old only after the code no longer needs it, because rolling back application code does not roll back the database.

When I review a migration, I check that foreign keys, role references, allowed values, required text, and case-insensitive uniqueness are in place, that ownership and internal-note permissions apply to every new response and to search, and that the runtime login still has only the privileges it needs. I also check that no credentials or real personal data have ended up in tracked files or test fixtures.

| Migration                        | Change                                                                       |
| -------------------------------- | ---------------------------------------------------------------------------- |
| `0000_empty_wallow`              | Initial auth and ticket schema                                               |
| `0001_careful_starbolt`          | Admin-plugin columns; converts the enabled flag to Better Auth's banned flag |
| `0002_black_namor`               | MFA, security events, and required statuses                                  |
| `0003_search_subject_trigram`    | `pg_trgm` and a subject index (Azure must allow-list `PG_TRGM`)              |
| `0004_lonely_felicia_hardy`      | Saved roles and permissions                                                  |
| `0005_right_marvex`              | Description and comment content format                                       |
| `0006_grant_edit_ticket_content` | Grants `editTicketContent` to the built-in Agent and Administrator           |
| `0007_ticket_notifications`      | Followers and inbox notifications; backfills followers                       |

## Conclusion

The schema keeps the ticket system's important rules in the database itself wherever possible: relationships through foreign keys, allowed values through constraints, and consistent history through transactions. The rules that depend on who is asking, especially internal-note visibility, are enforced by the server before any data leaves it.
