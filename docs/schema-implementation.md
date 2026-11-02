# Database implementation checklist

The implemented schema is composed in `src/lib/server/schema.ts`, with ticket tables in
`ticket-schema.ts` and auth tables in `auth-schema.ts`. Tracked migrations live in `drizzle/`.
Standalone SQL design references are historical proposals, not setup scripts.

## Applying schema changes

1. Update the Drizzle schema and review compatibility with the installed Better Auth plugins.
2. Generate migrations with `pnpm db:generate`; inspect SQL and migration snapshots.
3. Enable `PG_TRGM` in Azure's extension allow-list before applying search migrations.
4. Apply `pnpm db:migrate` using deployment credentials before code that expects the schema.
5. Reapply `scripts/runtime-grants.sql` when new tables need runtime access.
6. Run focused database tests and verify the hosted schema separately from disposable test data.

Migrations create schema and required status codes, not users, passwords, or sample tickets.
Use `pnpm admin:create` only for the first account in an empty installation. Existing accounts
without password credentials require explicit operator recovery; see the
[deployment runbook](azure-deployment.md#recovery-and-existing-installations).

## Current migrations

- `0000_empty_wallow`: initial auth and ticket schema.
- `0001_careful_starbolt`: admin plugin columns, including session `impersonated_by`;
  converts user `enabled` into `banned` without changing account availability.
- `0002_black_namor`: two-factor authentication, security events, and required ticket statuses.
- `0003_search_subject_trigram`: `pg_trgm` extension and subject GIN trigram index.

## Integrity and permissions

Foreign keys and checks protect relationships, priority values, and required text. Server
checks enforce enabled staff assignment, requester ownership, internal-note visibility,
and Closed-ticket editing rules. Ticket changes and audit events commit together.
Search suggestions, matching, and highlights apply the same visibility boundaries.
Newest-first lists use cursor pagination; relevance search uses page numbers.

Full-text documents combine ticket content, names, categories, and visible comments at query
time. The subject trigram index supports typo matching; no stored search column is added.
Check query plans and latency before using substantially larger ticket datasets.
