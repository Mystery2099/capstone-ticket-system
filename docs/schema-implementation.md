# Schema changes

The schema is composed in `src/lib/server/schema.ts`; tracked migrations live in
`drizzle/`. These files are authoritative. The standalone SQL reference is historical.

1. Update the Drizzle schema, checking compatibility with installed auth plugins.
2. Generate with `pnpm db:generate` and inspect the SQL and snapshots.
3. On Azure, allow-list `PG_TRGM` before applying the search migration.
4. Run `pnpm db:migrate` with deployment credentials before deploying dependent code.
5. Reapply `scripts/runtime-grants.sql` when runtime access changes.
6. Run focused database tests; verify the hosted schema separately.

Migrations provision required statuses and built-in roles, not accounts or sample
tickets. Use [operations](azure-deployment.md) for first-account setup and recovery.

| Migration                     | Change                                             |
| ----------------------------- | -------------------------------------------------- |
| `0000_empty_wallow`           | Initial auth and ticket schema                     |
| `0001_careful_starbolt`       | Admin-plugin columns; enabled-to-banned conversion |
| `0002_black_namor`            | MFA, security events, required statuses            |
| `0003_search_subject_trigram` | `pg_trgm` and subject index                        |
| `0004_lonely_felicia_hardy`   | Saved roles and permissions                        |

See [database design](database-design.md) for integrity and indexing, and the
[review checklist](database/schema-review-checklist.md) for validation.
