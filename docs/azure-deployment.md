# Operations and recovery

Database provisioning, recovery, and acceptance procedures for either hosting
option. The current host is described in the [student deployment guide](azure-student-deployment.md);
the Dockerfile is an optional alternative for plans that support custom containers.
Use individual accounts and fictional course data.

## First deployment

1. Provision a dedicated PostgreSQL database with separate schema-owner/deployment
   and application logins, keeping credentials outside version control. On Azure,
   add `PG_TRGM` to the server's `azure.extensions` parameter.
2. From a trusted checkout with development dependencies, run `pnpm db:migrate`
   with deployment credentials. This applies migrations and inserts required
   statuses and roles. It creates no users or tickets.
3. Run `scripts/runtime-grants.sql` as the schema owner and grant `capstone_runtime`
   to the application login. That login must not own tables, be a superuser, or
   inherit the deployment role. Reapply grants after migrations that add tables.
4. In a database with no accounts, run:

   ```sh
   pnpm admin:create --name "Administrator name" --email admin@example.com --password-file /private/admin-password
   ```

   The file holds a unique 12–128 character password, readable only by the
   operator; delete it afterward. Never pass passwords as arguments. The command
   refuses to run if any account exists.

5. Deploy, giving the web process only application credentials. Startup and
   `/health` never run migrations, so deploy schema changes before code that needs them.
6. Sign in, enroll an authenticator, store the recovery codes in a password manager,
   then create accounts and categories through Administration.

## Application settings

| Setting                                        | Purpose                                                                  |
| ---------------------------------------------- | ------------------------------------------------------------------------ |
| `NODE_ENV`, `HOST`, `PORT`                     | `production`, `0.0.0.0`, and the platform port (3000 in the container)   |
| `ORIGIN`                                       | Exact public HTTPS origin, without path or trailing slash                |
| `BETTER_AUTH_SECRET`                           | Random, at least 32 characters; keep stable and backed up (MFA needs it) |
| `PGHOST`, `PGUSER`, `PGDATABASE`, `PGPASSWORD` | Restricted application login; separate fields verify TLS certificates    |
| `PGPORT`                                       | Optional, defaults to 5432                                               |
| `DATABASE_URL`                                 | Overrides separate fields; use `sslmode=verify-full`                     |

Use the platform's secret settings and never give migration credentials to the
web app. Production rejects embedded `DATA_DIR` storage. Enable HTTPS-only access
and restrict database network access to the app and trusted deployment paths.

## Security and scaling

Responses send `Cache-Control: no-store`, a CSP with script nonces, and security
headers; HTTPS adds HSTS. Authenticated writes are limited to 30 per minute per
account (HTTP 429 with `Retry-After`). The limiter is process-local, so add a shared
limiter or gateway before running multiple instances. See
[authentication](auth-integration.md) and [permissions](permissions.md).

## Account recovery

Users normally recover MFA with a saved single-use code. If both the authenticator
and codes are lost, verify the person's identity outside the application, then run
with deployment credentials:

```sh
pnpm account:recover --email user@example.com --password-file /private/new-password --reset-mfa
```

Omit `--reset-mfa` to reset only the password. Recovery revokes sessions, pending
MFA challenges, and remembered devices, and writes an audit event. It never enables
a disabled account or changes a role. The web app cannot reset MFA over HTTP.

## Troubleshooting

- `column "impersonated_by" does not exist`: the database is behind the code. Run
  `pnpm db:migrate` against the app's database; don't patch individual tables.
- `pg_trgm` not allow-listed: add `PG_TRGM` to `azure.extensions`, keeping existing
  entries, then rerun. Pending migrations roll back together.
  [Azure instructions](https://learn.microsoft.com/en-us/azure/postgresql/extensions/how-to-allow-extensions).
- Email/password sign-in fails for an enabled account with no `credential` password:
  set one with `pnpm account:recover`. There is no default password.
- `INVALID_ORIGIN` is an origin mismatch, not a bad password. Local auth expects
  `http://localhost:5173` (and `127.0.0.1:5173`). If Vite falls back to 5174, stop
  the other instance or run `ORIGIN=http://localhost:5174 pnpm dev --port 5174`.

## Hosted acceptance and backup drill

- `/health` succeeds with the application login after migrations.
- HTTPS redirects, secure/HttpOnly cookies, CSP, and security headers are present.
- Repeated failed logins are throttled through the actual proxy path.
- MFA enrollment, authenticator login, and single-use recovery login work.
- Ticket ownership, internal-note secrecy, account disablement, and audit events hold.
- Sessions and records survive an application restart.
- A backup restores into a separate database with users, relationships, comments,
  events, and schema intact:

```sh
pg_dump --format=custom --file=capstone.dump "$DATABASE_URL"
pg_restore --no-owner --dbname="$RESTORE_DATABASE_URL" capstone.dump
```

Restore only into an empty database, keep dumps private, and reapply runtime grants.
Local tests cover migrations, provisioning, and restricted-role behavior; they do
not establish hosted readiness.
