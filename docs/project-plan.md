# Project Plan: Support Ticket Management System

**Course:** CISY 8503 Applied Database Management  
**Lab:** Open Source Database Lab  
**Student:** Mathew Kennedy-Brewer  
**Status:** Current as of November 4, 2026  
**Project:** [Capstone Ticket System](https://github.com/Mystery2099/capstone-ticket-system)

## Introduction

This plan describes how I have built the ticket system and how I intend to finish it. It follows the phases of the system development life cycle, from planning through maintenance. The dates come from the repository's history, where each piece of work was merged through a pull request on GitHub. The [needs assessment](needs-assessment.md) explains why the project exists; this document explains how the work was organized and what process I follow when something changes.

## 1. Phases and timeline

I started with planning and data modeling before writing application code, because the database design determines most of what the application can safely do. Implementation and deployment overlapped once the core schema was stable, and the most recent work has been maintenance driven by feedback.

| Phase          | Dates           | Work                                                                                                       | Output                                                                                                                      |
| -------------- | --------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Planning       | Oct 30          | Scope, roles, and choice of technology                                                                     | [Needs assessment](needs-assessment.md), [requirements](requirements.md), [roles and permissions](roles-and-permissions.md) |
| Analysis       | Oct 30          | Entities, relationships, the ticket lifecycle, and note visibility                                         | [ERD](diagrams/entity-relationship.mmd), [lifecycle](diagrams/ticket-lifecycle.mmd)                                         |
| Design         | Oct 30 – Oct 31 | Desktop and mobile mockups, site map, and architecture                                                     | [Design references](../design/README.md), [architecture](architecture.md)                                                   |
| Implementation | Oct 31 – Nov 2  | Drizzle schema and migrations, Better Auth with MFA, ticket workflows, search, and saved roles             | `src/`, `drizzle/`, [database design](database-design.md), [roles and permissions](roles-and-permissions.md)                |
| Testing        | Throughout      | Database workflow tests, security tests, and browser tests                                                 | `tests/`, [test and demonstration plan](test-and-demo-plan.md)                                                              |
| Deployment     | Nov 1 – Nov 2   | Azure App Service and PostgreSQL, a restricted runtime login, and GitHub Actions with a federated identity | [Deployment and operations](deployment-and-operations.md)                                                                   |
| Maintenance    | Nov 3 – ongoing | Rich-text messages, ticket editing, a separate description section, and inbox notifications                | [Change log](change-log.md)                                                                                                 |

## 2. Technology choices

PostgreSQL is the center of the project. I chose it because it is open source and supports what the lab needs to demonstrate: foreign keys, check constraints, transactions with row locks, full-text search, and the `pg_trgm` extension for typo-tolerant matching. It is also available as a managed service through Azure for Students. Local development uses PGlite, an embedded PostgreSQL implementation, so I can work without running a separate database server.

I used Drizzle ORM and Drizzle Kit for the schema because they give typed queries, always send parameterized SQL, and generate migration files I can read and review before applying them. SvelteKit lets one application serve both the interface and the server code, which keeps the database entirely on the server side; the browser never receives database credentials or connects to PostgreSQL. Better Auth handles password hashing, sessions, authenticator-based MFA, and recovery codes, which are areas where I did not want to write my own security code. The application runs on Azure App Service's free F1 tier to keep hosting costs within a student budget.

## 3. Change process

Every change follows the same process so the schema, the hosted database, and the code stay in agreement. I first record the request and its expected behavior in the [change log](change-log.md). If the change affects the schema, I update the Drizzle definitions, generate a migration, and read the generated SQL before using it, as described in [database design](database-design.md).

The work then happens on a feature branch. Before opening a pull request I run `pnpm lint`, `pnpm check`, `pnpm test`, and `pnpm build`, and GitHub Actions repeats those checks on any pull request that changes code. If the change needs a migration, I apply it to the hosted database before merging, and I reapply `scripts/runtime-grants.sql` when a table has been added. Merging to `main` then deploys the application and checks its `/health` endpoint.

## 4. Risks

The biggest risk is scope creep. The application already includes custom permissions, MFA, ranked search, and formatted messages, and each of those added behavior that has to be tested. I keep an explicit out-of-scope list in the [requirements](requirements.md) and a backlog in `TODO.txt` so new ideas are written down without automatically becoming work.

Leaking internal notes to requesters is the most serious correctness risk, because the main ticket page can look right while a search excerpt or a count still reveals private content. I filter notes in the server queries themselves and have dedicated tests for previews, search, counts, and notifications. Schema changes could also break the hosted application if code is deployed before its migration, so I keep migrations backward compatible and apply them first.

The free hosting tier sleeps when idle and has daily resource limits, so the first request during a demonstration can be slow. If the hosted application is unavailable, I can run the same demonstration locally with `pnpm dev`. Data loss is covered separately in the [security and data recovery plan](security-and-recovery-plan.md).

## Conclusion

The project has moved quickly from planning to a deployed application, and most of the remaining work is verification rather than new features. Keeping a consistent change process has let me add requested features without losing track of the schema or the hosted database, and it gives me a record of how the system reached its current state.
