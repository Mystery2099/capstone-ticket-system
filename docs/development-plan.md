# Development Plan — Web Baseline v0.4

## Milestone 0: Planning
- [x] Decide on SvelteKit full-stack web app following instructor feedback.
- [x] Draft needs assessment, architecture and revised requirements.
- [ ] Review initial PostgreSQL schema and migration before adoption.

## Milestone 1: Vertical slice
- [ ] Scaffold SvelteKit, Svelte 5, TypeScript, Tailwind and shadcn-svelte.
- [ ] Configure PostgreSQL and Drizzle migrations; seed fictional records.
- [ ] Implement basic sessions and server authorization.
- [ ] Build create/list/detail ticket server actions.
- [ ] Build the split-view ticket UI using actual database data.
- [ ] Test access restrictions and persistence using PostgreSQL.

## Milestone 2: Ticket workflow
- [ ] Add assignment, status updates, comments and history.
- [ ] Verify transactional writes and constraints.
- [ ] Add filtering, useful indexes, minimal administration and UI feedback.

## Milestone 3: Review with Professor Enke
- [ ] Demonstrate the app with ER diagram, migrations and SQL.
- [ ] Record new requirements exactly and assess their consequences.
- [ ] Implement changes with migrations and regression tests.

## Milestone 4: Submission
- [ ] Document local startup, security and database recovery.
- [ ] Capture test results, screenshots and example SQL.
- [ ] Compile a readable lab report with course-required cover page.
- [ ] Confirm any instructor-specific submission requirements.

**Initial demo definition of done:** a fictional user signs in through the browser, creates a ticket, and retrieves its data from PostgreSQL, with the permission boundary tested.
