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

Implemented: ticket workflows, account/category administration, server-side permissions,
security headers, administrator MFA with recovery codes, transactional administrative
audit records, cursor pagination, and explicit database provisioning. The application
has no demo mode or automatic sample accounts. Hosted deployment and restore verification
remain operational steps; see [production deployment](docs/azure-deployment.md).

Use Node.js 24+ and pnpm 12.8.1:

```sh
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm admin:create --name "Your name" --email you@example.com --password-file /private/initial-password
pnpm dev
```

For local development, data lives in `.data/postgres` unless database settings select
another database. Sign in at `http://localhost:5173/login`, complete administrator MFA
enrollment, and create categories and individual accounts. Supply a private password
file containing a unique password of 12–128 characters; remove it after provisioning.
No default credentials are provided. Setup refuses to overwrite existing accounts.

Copy `.env.example` to `.env` for connection settings. Migrations use deployment
credentials; the web process should use the restricted login described in the deployment
runbook. Production requires an exact HTTPS `ORIGIN`, a strong `BETTER_AUTH_SECRET`,
and hosted PostgreSQL. `pnpm db:setup` is a migration-only alias.

Run `pnpm check`, `pnpm test`, and `pnpm build` for verification. Tests create fictional
fixtures explicitly in disposable databases; fixtures cannot run outside `NODE_ENV=test`.
`pnpm test:e2e` starts its own isolated test server. The optional
`TEST_BASE_URL=http://localhost:5173 pnpm exec vitest run tests/http.test.ts` scenario
changes seeded test accounts and MFA settings, so use it only with a disposable fixture
server, never a personal or deployed database.

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

## Operational follow-up

Verify hosted HTTPS/proxy configuration and login throttling, apply restricted database
grants, and complete a backup/restore drill before sharing the deployment. Use a shared
rate limiter before scaling to multiple application instances.
