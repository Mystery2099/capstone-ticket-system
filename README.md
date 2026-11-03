# Capstone Ticket System

A support ticket application for CISY 8503, Open Source Database Lab. One SvelteKit
application handles the UI, authentication, permissions, and PostgreSQL access.

Stack: Svelte 5, TypeScript, Tailwind CSS 4, Better Auth, Drizzle ORM, and Tiptap.
Local development uses embedded PostgreSQL (PGlite); hosting uses PostgreSQL.

## Local setup

Use Node.js 24+ and pnpm 12.8.1:

```sh
cp .env.example .env
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm admin:create --name "Your name" --email you@example.com --password-file /private/initial-password
pnpm dev
```

Open `http://localhost:5173/login`, enroll administrator MFA, save the recovery
codes, and create accounts and categories through Administration.

The password file must contain a unique password of 12–128 characters. Keep it
private and remove it after provisioning. There are no default accounts or sample
tickets; `admin:create` requires an installation with no accounts.

Without hosted connection settings, local data lives in `.data/postgres`.
See `.env.example` for configuration and the [operations guide](docs/azure-deployment.md)
for restricted database access, existing-account recovery, and sign-in troubleshooting.
`pnpm db:setup` is an alias for migrations only.

## Verification

```sh
pnpm lint
pnpm check
pnpm test
pnpm build
```

`pnpm test:e2e` starts an isolated browser-test server. Tests use fictional fixtures
in disposable databases.

## Documentation

- [Requirements](docs/requirements.md) and [tests/demo plan](docs/test-and-demo-plan.md)
- [Roles and workflow](docs/roles-and-workflow.md) and [custom permissions](docs/permissions.md)
- [Architecture and request flow](docs/architecture.md), [authentication](docs/auth-integration.md), and [formatted messages](docs/formatted-messages.md)
- [Database design](docs/database-design.md) and [schema changes](docs/schema-implementation.md)
- [Navigation](docs/site-map.md), [search](docs/search.md), and [diagrams](docs/diagram-index.md)
- [Student hosting](docs/azure-student-deployment.md) and [operations/recovery](docs/azure-deployment.md)
- [Change log](docs/change-log.md) and [design references](design/README.md)
