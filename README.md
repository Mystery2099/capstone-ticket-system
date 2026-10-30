# Capstone Ticket System

A small PostgreSQL-backed support ticket application for the CISY 8503 Open Source Database Lab. This is a course project, not a commercial help desk product or the separate TicketTinker project.

## Planned stack

- SvelteKit, Svelte 5 and TypeScript
- PostgreSQL with Drizzle ORM and Drizzle Kit migrations
- Better Auth for email/password sign-in and sessions
- Tailwind CSS 4, shadcn-svelte/Bits UI, Lucide icons and Zod
- Vitest, Playwright and PostgreSQL integration tests

One full-stack SvelteKit app handles both the web UI and server logic. The browser never connects directly to PostgreSQL.

## Current status

Planning only. No working app, generated Better Auth schema or executed migration has been committed. We'll develop locally first; Azure deployment is optional once the demonstration works locally.

The UI direction is a Gmail-inspired ticket workspace with responsive mobile layouts and a Plum & Apricot palette. The Claude-produced design files are implementation references, not part of this repository.

## Documentation

- [Requirements](docs/requirements.md)
- [Architecture](docs/architecture.md)
- [Database design](docs/database-design.md)
- [Development plan](docs/development-plan.md)
- [Role and workflow rules](docs/roles-and-workflow.md)
- [Better Auth integration](docs/auth-integration.md)
- [Diagrams](docs/diagrams/)
- [Change log](docs/change-log.md)

## First development target

Seed a fictional requester, agent and administrator; sign in with Better Auth, create and view a ticket, and demonstrate that the records are stored in PostgreSQL. Then implement assignments, status changes, public replies, private notes, administration and recovery testing.

**Scope:** No command palette, email integration, attachments, push notifications, real-time chat or offline/PWA functionality.
