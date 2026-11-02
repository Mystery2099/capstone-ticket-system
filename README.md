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
audit records, ranked ticket search with live suggestions, paginated results, and explicit database provisioning. The application
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
If another dev server is already using port 5173, use that instance or stop it before
restarting; a Vite fallback port needs a matching `ORIGIN` for sign-in. See
[sign-in troubleshooting](docs/azure-deployment.md#migration-and-sign-in-troubleshooting).
No default credentials are provided. Initial administrator creation refuses to run when accounts already exist.
Existing fictional records may have no password credential. Use the operator recovery command
in the [deployment runbook](docs/azure-deployment.md#recovery-and-existing-installations)
to set an individual password; migration alone does not make those accounts usable.

Copy `.env.example` to `.env` for connection settings. Migrations use deployment
credentials; the web process should use the restricted login described in the deployment
runbook. Production requires an exact HTTPS `ORIGIN`, a strong `BETTER_AUTH_SECRET`,
and hosted PostgreSQL. `pnpm db:setup` is a migration-only alias.

Run `pnpm lint`, `pnpm check`, `pnpm test`, and `pnpm build` for verification. Tests create fictional
fixtures explicitly in disposable databases; fixtures cannot run outside `NODE_ENV=test`.
`pnpm test:e2e` starts its own isolated test server. The optional
`TEST_BASE_URL=http://localhost:5173 pnpm exec vitest run tests/http.test.ts` scenario
changes seeded test accounts and MFA settings, so use it only with a disposable fixture
server, never a personal or deployed database.

The UI direction is a Gmail-inspired ticket workspace with responsive mobile layouts and a Plum & Apricot palette. The Claude-produced design mockups in [design/](design/) are implementation references developed alongside the app.

## Ticket search

Search covers subjects, descriptions, visible comments, category names, and requester/assignee
names. Subject matches have the highest text weight; subjects also support typo matching.
Words match in any order and support prefixes, quoted phrases, and exclusions. No operators
are required. Submit a number such as `1046` or `#1046` to open an accessible ticket directly;
unavailable numbers fall back to normal search.

Live suggestions start at two characters after a 200 ms pause. Use arrows and Enter to
select a suggestion, Enter without a selection for full results, `/` to focus, and Escape
to clear the field. Recent searches are stored per account in this browser and can be cleared.
Search options include status, priority, category, dates, and visible comments; staff can also
choose requester or assignee. Submitting search covers all statuses unless explicitly filtered.
Results offer highlighted excerpts and best-match or newest-first ordering. Name and
category matches include labels such as “Assigned to”, “Requested by”, or “Category”
in both suggestions and full results, with the matching words highlighted. Lists contain
up to 50 tickets per page; newest-first uses a ticket-number cursor, relevance uses page numbers.
Requesters see only their tickets and public comments, including in suggestions and snippets.

Hosted PostgreSQL requires `PG_TRGM` in Azure's extension allow-list **before** running
`pnpm db:migrate`. Local PGlite registers the extension automatically. Search adds a subject
trigram index, with no new search column or external search service. Full-text documents are
assembled at query time; large datasets will need query-plan and latency checks.

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

ESLint checks JavaScript, TypeScript and Svelte files with the recommended rules.
Use `pnpm lint:fix` for automatic fixes and `pnpm format` for Prettier formatting.
Generated migrations, build output and local database files are excluded from linting.
