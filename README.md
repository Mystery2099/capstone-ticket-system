# Capstone Ticket System

An independent, small multi-user ticket management web application for the CISY 8503 Applied Database Management Open Source Database Lab.

**Status:** Planning baseline v0.4. No runnable application has been implemented. Requirements and database design are still proposals subject to Professor Enke's feedback.

## Proposed stack
- SvelteKit, Svelte 5, strict TypeScript
- Tailwind CSS 4, shadcn-svelte (Bits UI), Lucide
- PostgreSQL, Drizzle ORM, Drizzle Kit migrations
- Zod validation; Vitest, Playwright and PostgreSQL integration tests
- Local Node.js server; optional online-only PWA support later

SvelteKit handles browser UI and server-side business logic. There is no Ktor backend, Compose desktop client or Electron shell. This project is entirely independent of TicketTinker.

## Initial scope
Requester, agent and administrator roles; authentication; tickets; category, status, assignment, comments, filtering and event history. The interface is desktop-first and uses a compact split-view ticket workspace, with a restrained Material 3 influence. The application is a small course exercise, not a long-term product.

## Documentation
- [Needs assessment](docs/needs-assessment.md)
- [Requirements](docs/requirements.md)
- [Architecture](docs/architecture.md)
- [Database design](docs/database-design.md)
- [Development plan](docs/development-plan.md)
- [Change log](docs/change-log.md)

## First demonstration
A fictional user signs in, creates a ticket, and sees it persisted and retrieved through PostgreSQL. Show authorization controls, an ER diagram, a tested migration, example queries and test evidence. Use only fictional demonstration data.

Documentation should explain the project at a high level and give more detail where technical choices are uncertain or consequential. The lab's exact deliverables remain subject to instructor clarification.
