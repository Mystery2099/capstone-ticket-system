# Development Plan

## Milestone 0 — Baseline (current)
- [x] Write initial requirements, architecture, and database design.
- [x] Draft first migration.
- [ ] Review initial assumptions with Professor Enke.

## Milestone 1 — Working vertical slice
- [ ] Bootstrap Gradle multi-module Kotlin project.
- [ ] Start PostgreSQL locally and execute migration.
- [ ] Add fictional development users and seed categories/statuses.
- [ ] Build Ktor health, authentication, list/create/detail ticket routes.
- [ ] Build Compose desktop sign-in, list, create, and detail screens.
- [ ] Verify client/server/database flow and permissions with tests.

## Milestone 2 — Ticket workflow
- [ ] Add assignment, status changes, and comments.
- [ ] Add server-side role checks and database transactions.
- [ ] Add status/category filters and basic SQL aggregation.
- [ ] Add audit events for ticket modifications.

## Milestone 3 — Lab demonstration and change request
- [ ] Show working application and database diagram to Professor Enke.
- [ ] Record new requirements verbatim in `change-log.md`.
- [ ] Assess database/API/UI impact before implementation.
- [ ] Add migrations, tests, and documentation for approved changes.

## Milestone 4 — Submission
- [ ] Document Linux/Windows setup and configuration.
- [ ] Run integration tests and backup/restore test.
- [ ] Capture screenshots and query examples.
- [ ] Produce a course-format report with cover page.
- [ ] Confirm deliverables and demonstrate to Professor Enke.

## Definition of done for initial demo
A fictional user can authenticate in the Compose client, create a ticket through the Ktor API, and see that ticket persisted and retrieved from PostgreSQL. The same repository has the initial requirements, ER diagram, versioned SQL migration, and documented test results.
