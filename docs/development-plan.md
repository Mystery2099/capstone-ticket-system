# Development Plan

This is one of several major course projects, so I'm keeping the implementation focused on what we need to demonstrate rather than treating every idea in the design mockups as a required feature.

1. **Foundation:** Create the SvelteKit/TypeScript app, Tailwind and component setup; configure local PostgreSQL, Drizzle and environment variables.
2. **Authentication:** Integrate Better Auth, generate its Drizzle schema, disable public registration, and seed fictional requester/agent/admin accounts.
3. **Ticket MVP:** Create/list/view tickets with database constraints and permission checks.
4. **Agent workflows:** Assignment, five statuses, priority/category changes and transactional audit history.
5. **Conversations/admin:** Public replies, private staff notes, role/category management and disabled-account enforcement.
6. **UI and verification:** Implement Claude's desktop/mobile design handoff; responsive search/filter; integration, browser, backup and restore tests.
7. **Optional deployment:** Evaluate Azure only after the whole local demonstration works.

The first usable milestone is a requester signing in and submitting a ticket that actually appears in PostgreSQL. Every later milestone should build on that working vertical slice.

## Scope

No command bar, email integration, attachments, real-time updates, PWA/offline mode or elaborate dashboard. Keep schema decisions documented, especially changes requested by Professor Enke.

## Remaining implementation checks

- Confirm generated Better Auth schema and Drizzle version compatibility.
- Verify permission restrictions in the server, not just the UI.
- Test transaction rollback when audit insertion fails.
- Validate backup and restore against an actual PostgreSQL instance.
