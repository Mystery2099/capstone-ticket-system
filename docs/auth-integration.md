# Better Auth integration

Better Auth manages email/password authentication and sessions in PostgreSQL. Our application still controls ticket ownership, staff access, internal-note visibility and administrator operations.

We'll generate Better Auth's `user`, `session`, `account` and `verification` definitions from the installed version using its Drizzle integration. The `user` table gets server-controlled `role` and `enabled` extensions. User foreign keys in ticket records must match the generated `user.id` type, normally text.

Public sign-up is disabled; fictional demonstration users will be created through supported server-side APIs. Check account enablement on every protected operation, including requests carrying an otherwise valid session. Do not expose role or enabled updates through ordinary profile editing.

The generated auth tables and our ticket tables should share one Drizzle migration workflow. No independent hand-written auth SQL migrations.

**Still to validate:** exact generated columns, SDK version, seed procedure, disabled-session revocation, tests against a running PostgreSQL database.

Official docs: https://www.better-auth.com/docs/concepts/database · https://www.better-auth.com/docs/adapters/drizzle · https://www.better-auth.com/docs/integrations/svelte-kit
