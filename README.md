# Capstone Ticket System

**Course:** CISY 8503 Applied Database Management  
**Lab:** Open Source Database Lab  
**Student:** Mathew Kennedy-Brewer  
**Status:** Complete; documentation reviewed November 11, 2026  
**Live site:** [capstone-tickets-mkb.azurewebsites.net](https://capstone-tickets-mkb.azurewebsites.net)  
**Database:** PostgreSQL

## Introduction

For my Open Source Database Lab, I built a web-based support ticket system for a fictional small IT support team. Requesters submit tickets and follow their progress, agents assign and respond to them, and administrators manage accounts, roles, and categories. One SvelteKit application handles the interface, authentication, permissions, and all access to PostgreSQL.

The application uses Svelte 5, TypeScript, Tailwind CSS 4, Better Auth, Drizzle ORM, and Tiptap. Local development uses PGlite, an embedded PostgreSQL implementation, while the hosted version runs on Azure Database for PostgreSQL. The live site uses Azure's free tier, so the first request after a quiet period can take up to a minute. Demonstration accounts are provided separately and are not stored in this repository.

## Course objectives

Each course objective is addressed by one or more documents in `docs/`.

| Objective                                     | Where it is addressed                                                                                                                    |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Needs assessment for the organization         | [Needs assessment](docs/needs-assessment.md)                                                                                             |
| Plan for the database application             | [Project plan](docs/project-plan.md), [requirements](docs/requirements.md), [database design](docs/database-design.md)                   |
| Build and configure the database application  | This repository, [local setup](#local-setup), [deployment and operations](docs/deployment-and-operations.md)                             |
| Maintain, secure, and program the application | [Database design](docs/database-design.md), [roles and permissions](docs/roles-and-permissions.md), [architecture](docs/architecture.md) |
| Security and data recovery plan               | [Security and data recovery plan](docs/security-and-recovery-plan.md), [deployment and operations](docs/deployment-and-operations.md)    |

## Local setup

The project needs Node.js 24 or newer and pnpm 12.8.1. These commands install it, create the database, and provision the first administrator:

```sh
cp .env.example .env
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm admin:create --name "Your name" --email you@example.com --password-file /private/initial-password
pnpm dev
```

After that, open `http://localhost:5173/login`, enroll the administrator's authenticator, save the recovery codes, and create accounts and categories through Administration.

The password file must contain a unique password of 12 to 128 characters; it should be kept private and removed once the account exists. There are no default accounts or sample tickets, and `admin:create` only works on an installation that has no accounts yet. Without hosted connection settings, local data is stored in `.data/postgres`. The available settings are listed in `.env.example`, and the [operations and recovery guide](docs/deployment-and-operations.md) covers restricted database access, recovering an existing account, and sign-in troubleshooting. `pnpm db:setup` is an alias for running the migrations.

## Verification

Four commands check the project, and GitHub Actions runs them again on every pull request that changes code:

```sh
pnpm lint
pnpm check
pnpm test
pnpm build
```

Install Chromium once with `pnpm exec playwright install chromium` (on Linux, add `--with-deps` to install system dependencies too). `pnpm test:e2e` starts its own isolated server on port 4180, which must be available. All tests use fictional fixtures in disposable databases. The [test and demonstration plan](docs/test-and-demo-plan.md) describes what they cover and what still has to be checked by hand.

Hosted checks recorded in these documents are dated evidence, not a guarantee of the live site's current configuration. This documentation review did not access or modify the hosted application or database.

## Documentation

- **Planning:** [needs assessment](docs/needs-assessment.md) (with a [retrospective](docs/retrospective-needs-assessment.md) written after the build), [project plan](docs/project-plan.md), [requirements](docs/requirements.md), and [test and demonstration plan](docs/test-and-demo-plan.md) with its [demonstration queries](docs/demo-queries.sql)
- **Reflection:** [development reflections and lessons learned](docs/development-reflections.md)
- **Screens:** [screen gallery](docs/screen-gallery.md) with every page of the application and mockups of planned production features
- **Design:** [architecture](docs/architecture.md), [database design](docs/database-design.md), [roles and permissions](docs/roles-and-permissions.md), [diagrams](docs/diagrams/), and [interface design references](design/README.md)
- **Operations:** [security and data recovery plan](docs/security-and-recovery-plan.md) and [deployment and operations](docs/deployment-and-operations.md)
