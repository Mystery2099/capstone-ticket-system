# Architecture and Implementation Plan (Working Draft)

## System architecture

[View Mermaid diagram](diagrams/system-architecture.mmd)

I’m keeping this as one full-stack SvelteKit application instead of splitting it into a separate frontend and backend. The browser will talk to SvelteKit, and the server will handle sign-in sessions, validation, permissions, and PostgreSQL queries through Drizzle. That keeps database credentials out of the browser and avoids maintaining a second service just for this class project. I’ll develop and test everything locally first; Azure can be an option for the final demonstration, but it shouldn’t be required to run the app.

## Recommended implementation slices

1. **Foundation:** SvelteKit with Svelte 5/TypeScript, Tailwind 4, shadcn-svelte/Bits UI, environment configuration, PostgreSQL connection, Drizzle migrations, seed data.
2. **Authentication and permissions:** Sign in/out, server sessions, protected routes, sample users, access control tests.
3. **Ticket MVP:** Create tickets, list own tickets, inspect ticket details, verify PostgreSQL persistence.
4. **Agent workflows:** Queues, assignment, status changes, priority/category updates, transactional audit events.
5. **Conversations and admin:** Public replies, private internal notes with server-side visibility checks, category management, user role/enablement controls.
6. **Polish and verification:** Desktop/mobile layouts based on Claude's design handoff, search/filter, accessible validation states, tests, backup/restore demonstration.
7. **Optional deployment:** Azure only after the full local demonstration works, with a test account and fictional data.

## Scope limits

I’m intentionally skipping a command palette, email integration, push notifications, attachments, offline/PWA functionality, real-time synchronization, complex dashboards, and a full-text search system. A few of those could be interesting in a larger project, but they would take time away from the database functionality that actually matters for this lab. **Private internal notes are in scope**, since we’ve already decided to support them; they just need to be implemented with proper permissions. The UI can borrow familiar patterns from Gmail without actually sending or receiving email.

## Demonstration acceptance checklist

- Seeded requester can sign in, submit a ticket, and view it.
- Another requester cannot open it through a guessed/direct URL.
- An agent can find the ticket, assign it, reply, and resolve it.
- The ticket's PostgreSQL records and joins can be inspected using SQL.
- Invalid foreign keys and unauthorized state changes are rejected.
- An authorized mutation and its history record commit or roll back together.
- The database can be backed up and restored to a fresh instance.
- Professor's change request can be recorded in the change log, scoped, migrated if needed, tested, and demonstrated.

## Confirmed business rules (October 30, 2026)

- Include `on_hold` alongside Open, In Progress, Resolved and Closed.
- Agents can view all tickets, including unassigned tickets.
- A requester can reopen a resolved ticket that they created.
- Agent/admin-only internal notes are distinct from public replies and are filtered at the server boundary.
- Any changes to status, assignments or visibility should be tested across both requester and agent roles.
