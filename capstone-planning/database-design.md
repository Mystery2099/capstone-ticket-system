# Capstone Ticket System: PostgreSQL Database Design

**Status:** Reviewed design proposal, not yet migrated or tested.  
**Stack:** PostgreSQL, Drizzle ORM and SvelteKit server-side database access.

## Why I'm keeping the schema small

I'm using a relational design because the project needs to demonstrate more than basic CRUD operations. Tickets belong to users, reference categories and statuses, and have separate comments and activity history; PostgreSQL can enforce those relationships even when a bug slips through the application code. At the same time, I don't want a bunch of extra tables that make a class project harder to finish without adding much to the demonstration.

The initial design has **six tables**. I've kept roles as a constrained field on the user record, and each ticket can be assigned to one support agent. Those are intentional limitations, not assumptions about how larger ticketing systems should work.

[Entity-relationship diagram](diagrams/entity-relationship.mmd)  
[SQL design reference](database/schema-reference.sql)  
[Data dictionary](database/data-dictionary.md)

## Tables and relationships

| Table | Purpose |
|---|---|
| `app_user` | Accounts, display names, password hashes, roles and enabled state |
| `category` | Ticket categories that can be disabled without losing old references |
| `ticket_status` | Fixed set of allowed ticket states and their display order |
| `ticket` | Ticket details, requester, optional assignee, category, status, priority and timestamps |
| `ticket_comment` | Public replies and private internal notes, distinguished by `is_internal` |
| `ticket_event` | Server-written activity history for meaningful ticket changes |

Each ticket has exactly one requester, category and status, and it may have one assigned user. A ticket can contain any number of comments and history events. Users and categories aren't hard-deleted once other records reference them, which keeps the sample data and demonstration history intact.

## Integrity and data types

I plan to use UUID primary keys for the main records, with a separate database-generated `bigint` ticket number for display. That gives us readable identifiers in the interface without depending on sequential numbers for internal relationships. Timestamps use `timestamptz`, so they're stored consistently and formatted for the user in the application.

The database will reject empty subjects and comments, invalid role or priority values, and references to nonexistent users or categories. Emails and category names need uniqueness regardless of capitalization, so the proposal uses unique indexes on their lowercase values. The five statuses are Open, In Progress, On Hold, Resolved and Closed, with their allowed values stored in a small lookup table.

There are a few rules a foreign key won't handle by itself. An assignee needs to be an enabled agent or administrator, for example, and a requester should only be able to reopen their own resolved ticket. The SvelteKit server will check those permissions and make the related updates inside transactions; we'll also test the rules against the database before considering the implementation complete.

## Internal notes and history

Internal notes are stored alongside public replies in `ticket_comment`, using a required boolean flag. However, that does **not** mean we can send every comment to the client and hide the private ones with CSS. Requester-facing queries must exclude internal notes before the data leaves the server, including previews, pagination and any history display.

The event table keeps structured `jsonb` details for things such as a status change from Resolved to Open. It should not store private-note contents, because an event history endpoint could accidentally expose them even if the comments endpoint is correct. Events for ticket changes need to be written in the same transaction as the change itself, so one cannot succeed while the other fails.

## Indexes and query plan

I'm starting with indexes that match the screens and queries we already know the app needs, especially requester ticket lists, an agent's assigned queue, unassigned tickets, status filters and conversation history. The proposed partial index for unassigned tickets is meant for the open queue rather than every historical ticket. We'll verify the real query shapes and use `EXPLAIN (ANALYZE, BUFFERS)` after seeding sample records; a tiny database may choose sequential scans, and that's not automatically evidence of a problem.

I don't plan to add full-text search, triggers for every timestamp or elaborate materialized reports at this stage. Search can start with a straightforward subject filter, and the server can maintain `updated_at` during meaningful ticket changes. This keeps the database understandable while leaving room to adapt if the professor changes the requirements.

## Security and deployment boundaries

The browser never connects directly to PostgreSQL. SvelteKit server code owns the database credentials, validates requests, checks permissions and returns only authorized fields. Because we're using one application database role with server-enforced authorization, **PostgreSQL row-level security is not part of the initial design**; if we later expose the database to untrusted clients or use separate database roles, we'll revisit that choice instead of pretending UI filtering provides database isolation.

For recovery, we'll create a `pg_dump` backup and restore it into a separate test database before the demonstration. Drizzle migrations will be the source of truth for schema changes; the standalone SQL file is a review reference, **not a second migration system**.

## Finalized business rules

Administrators inherit all agent capabilities, so they can handle ticket work as well as user and category administration. Agents can see and manage tickets across the system, but only administrators can reopen a Closed ticket. Reopening Closed returns the ticket to Open in the proposed lifecycle, and the change must be recorded in the history table.

Tickets use three priority levels: Low, Normal and High. New tickets default to Normal, and only agents and administrators can change priority. A requester cannot override the default by changing a form field or submitting a custom value; that restriction belongs in server-side authorization rather than relying on the database `CHECK` constraint alone.

Closed tickets are otherwise read-only, including comments and internal notes. Requesters can reopen their own Resolved tickets, but not Closed tickets. We are not adding automatic ticket closure, escalation or SLA scheduling to the initial project.

The database model itself doesn't need extra tables or columns for these decisions. The existing `priority` constraint and default already fit, and `ticket_status` already contains Closed; the critical implementation work is validating authorization and status transitions on the server, inside the same transaction that writes the audit event.

## Open implementation details

We still need to confirm whether requesters may post on Resolved tickets without reopening them, and which target status staff should use when reopening Resolved tickets. Those aren't reasons to expand the database schema right now.

## How I applied the supplied skill

I used the *Supabase Postgres Best Practices* skill as a design checklist for schema integrity, query and index design, security boundaries, connection management and migration safety. The uploaded skill lists more detailed reference documents, but those reference files weren't included with the upload, so this review uses the top-level guidance rather than claiming to have applied every individual Supabase rule. We'll revisit indexes and connection pooling using actual query results and deployment details, not guesswork.
