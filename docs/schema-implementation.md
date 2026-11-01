# Database implementation checklist

The schema proposal is now represented in `src/lib/server/db/schema/tickets.ts`. It isn't runnable yet, because Better Auth must generate the matching `auth.ts` schema first. I've intentionally avoided inventing authentication tables or presenting this draft as tested code.

## Before generating migrations

1. Bootstrap SvelteKit and install compatible versions of Better Auth, Drizzle and the PostgreSQL driver.
2. Configure Better Auth with the Drizzle PostgreSQL adapter, the admin plugin's user fields (`role` and `banned`) and public sign-up disabled.
3. Use Better Auth's schema generator and put its generated tables in `src/lib/server/db/schema/auth.ts`. Verify its actual names and `user.id` type. Then typecheck our application schema.
4. Review the database defaults and decide whether `ticket_number` should start at 1 or use a custom offset. The visible ticket number must be unique and never change.
5. Seed the five status codes (`open`, `in_progress`, `on_hold`, `resolved`, `closed`) and fictional categories/users. The seed procedure must use supported Better Auth server-side account creation, not plain-text password inserts.
6. Generate **one** set of Drizzle migrations for both auth and ticket tables; apply it to local PostgreSQL and inspect the resulting constraints.
7. Test foreign keys, uniqueness, invalid priorities, empty text, category deactivation, disabled account behavior, and transactional audit events.
8. Confirm requesters cannot access internal note bodies through detail views, search, previews, activity records or direct requests.

## Important boundaries

Database constraints prevent invalid relationships, but they don't automatically enforce our full permission model. SvelteKit must still check that assignees are enabled staff, that requesters cannot change priority, and that Closed tickets are read-only until an admin reopens them.

The app should update `updated_at` as part of ticket modifications; the column's default only covers insertion. The event `details` JSONB should contain safe change metadata and must never duplicate private-note bodies.

We should preserve old tickets and history by **deactivating** users and categories instead of deleting them through normal administration. Referential deletion behavior is a last-resort database safeguard, not the normal UI workflow.

## Documentation cleanup

I don't think the current number of docs is excessive. Keep `requirements.md`, `architecture.md`, `database-design.md`, `roles-and-workflow.md`, `development-plan.md`, `auth-integration.md` and the change log. Keep the diagrams as individual `.mmd` files, as requested.

Once the implementation works, consolidate overlapping explanations rather than creating a new document for each small decision. An outdated standalone SQL reference should stay labeled as a historical proposal, not a migration to run.

## Reference

- Better Auth database schema generation: https://www.better-auth.com/docs/concepts/database
- Better Auth Drizzle adapter: https://www.better-auth.com/docs/adapters/drizzle
- Drizzle PostgreSQL constraints: https://orm.drizzle.team/docs/indexes-constraints
