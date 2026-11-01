# Capstone Ticket System

A small PostgreSQL-backed support ticket application for the CISY 8503 Open Source Database Lab. This is a course project, not a commercial help desk product or the separate TicketTinker project.

## Stack

- SvelteKit, Svelte 5 and TypeScript
- PostgreSQL with Drizzle ORM and Drizzle Kit migrations
- Better Auth for email/password sign-in, sessions and account creation (admin plugin)
- Tailwind CSS 4, shadcn-svelte/Bits UI, Lucide icons and Zod
- Superforms and Formsnap for admin forms, svelte-sonner for toasts
- Vitest, Playwright and PostgreSQL integration tests

One full-stack SvelteKit app handles both the web UI and server logic. The browser never connects directly to PostgreSQL.

## Current status

Implemented: project setup, PostgreSQL migrations and demo seed, Better Auth sign-in, the
responsive ticket workspace, user and category administration, browser-saved ticket drafts,
appearance settings, a `/health` endpoint and a container image, all backed by server-side
permissions. Deployment to Azure App Service and a hosted backup restore have not been verified;
see [docs/azure-deployment.md](docs/azure-deployment.md).

Use Node.js 24+ and pnpm 12.8.1:

```sh
pnpm install --frozen-lockfile
pnpm db:setup
pnpm dev
```

Sign in at `http://localhost:5173/login` with `priya.raman@example.test` (agent),
`marcus.lee@example.test` (requester), or `jordan.ellis@example.test` (administrator).
The fictional demo password is `Capstone2026!`. Local data lives in `.data/postgres`;
setup applies migrations and seeds only an empty database.

Run `pnpm check`, `pnpm test`, `pnpm test:e2e`, and `pnpm build` to verify the implementation.
The workflow and browser tests use disposable databases in the system temporary directory.
`TEST_BASE_URL=http://localhost:5173 pnpm test` adds the HTTP acceptance scenario, which briefly
disables a demo account, so only point it at a disposable fictional server. Copy `.env.example`
to `.env` to use hosted PostgreSQL. With those settings, `pnpm db:setup` and `pnpm dev` connect
to that database and apply migrations.
Production authentication requires `ORIGIN` and `BETTER_AUTH_SECRET`; the local demo
fallbacks are for development only.

The UI direction is a Gmail-inspired ticket workspace with responsive mobile layouts and a Plum & Apricot palette. The Claude-produced design mockups in [design/](design/) are implementation references developed alongside the app.

## Documentation

- [Requirements](docs/requirements.md)
- [Architecture](docs/architecture.md)
- [Database design](docs/database-design.md) (with SQL reference and data dictionary in [docs/database/](docs/database/))
- [Development plan](docs/development-plan.md)
- [Roles and workflow rules](docs/roles-and-workflow.md)
- [Better Auth integration](docs/auth-integration.md)
- [Request lifecycle](docs/request-lifecycle.md)
- [Site map](docs/site-map.md)
- [Test and demo plan](docs/test-and-demo-plan.md)
- [Diagrams](docs/diagrams/)
- [Change log](docs/change-log.md)

## Next development target

Build the ticket list, conversation, creation form, and workspace shell.
Then add administration and the remaining acceptance tests.

**Scope:** No command palette, email integration, attachments, push notifications, real-time chat or offline/PWA functionality.
