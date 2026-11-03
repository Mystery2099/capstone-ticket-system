# Schema changes

The schema is composed in `src/lib/server/schema.ts`; tracked migrations live in
`drizzle/`.

1. Update the Drizzle schema, checking compatibility with installed auth plugins.
2. Run `pnpm db:generate` and inspect the SQL and snapshots.
3. Run `pnpm db:migrate` with deployment credentials before deploying dependent code.
4. Reapply `scripts/runtime-grants.sql` when runtime access changes (new tables).
5. Run focused database tests; verify the hosted schema separately.

Migrations provision required statuses and built-in roles, not accounts or sample
tickets. Prefer backward-compatible (expand/migrate/contract) changes.

| Migration                     | Change                                                    |
| ----------------------------- | --------------------------------------------------------- |
| `0000_empty_wallow`           | Initial auth and ticket schema                            |
| `0001_careful_starbolt`       | Admin-plugin columns; enabled-to-banned conversion        |
| `0002_black_namor`            | MFA, security events, required statuses                   |
| `0003_search_subject_trigram` | `pg_trgm` and subject index (Azure: allow-list `PG_TRGM`) |
| `0004_lonely_felicia_hardy`   | Saved roles and permissions                               |
| `0005_right_marvex`           | Description/comment content format                        |

## Review checklist

- Foreign keys, role references, enumerated values, required text, case-insensitive uniqueness.
- Ownership and internal-note permissions applied to every response and search.
- Mutations and events commit or roll back together; timestamps update correctly.
- Stable pagination; realistic query plans; restricted runtime privileges.
- No credentials or real personal data in tracked files or fixtures.
