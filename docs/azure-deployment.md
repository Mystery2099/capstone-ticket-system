# Production deployment

Run the Linux container on Azure App Service with Azure Database for PostgreSQL.
The application uses the same authentication and permissions in every environment.
It has no demo mode, automatic account creation, or shared production password.
Use fictional ticket content for the course, with individual accounts.

## Deployment order

1. Provision a dedicated PostgreSQL database and separate schema-owner/deployment
   and application logins. Keep their credentials outside version control. Add
   `PG_TRGM` to the server's `azure.extensions` parameter; ticket search needs it
   and migrations create it.
2. From a trusted source checkout with development dependencies installed, run
   `pnpm db:migrate` using deployment credentials. This applies tracked migrations
   and inserts the five required ticket statuses. It creates no users or tickets.
3. Run `scripts/runtime-grants.sql` as the schema owner. Grant the resulting
   `capstone_runtime` role to the separately provisioned application login. That
   login must not own tables, be a superuser, inherit the deployment role, or have
   extra privileges from another role. Reapply grants after relevant migrations.
4. In a database with no accounts, run:

   ```sh
   pnpm admin:create --name "Administrator name" --email admin@example.com --password-file /private/admin-password
   ```

   Supply an independently chosen password of 12–128 characters through a private
   file readable only by the operator. Do not put passwords in command arguments,
   shell history, or the repository. Remove the file securely after provisioning.
   This command is serialized and refuses to overwrite any existing account.

5. Build and deploy the container. Give the web process only application database
   credentials. Setup tools run from the trusted checkout, not the runtime image;
   the image no longer contains migration files.
6. Sign in as the first administrator and enroll an authenticator. Save the recovery
   codes in a password manager before completing enrollment. Create individual
   accounts and categories through Administration.

`pnpm db:setup` remains an alias for migration-only setup. Web startup and `/health`
never apply migrations. Deploy schema changes before code that requires them.
For future breaking migrations, use an expand/migrate/contract rollout rather
than deploying incompatible code and schema together.

## Application settings

| Setting                                        | Purpose                                                                                     |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `NODE_ENV`                                     | `production`, already set in the image                                                      |
| `HOST`, `PORT`                                 | `0.0.0.0`, `3000`, already set in the image                                                 |
| `ORIGIN`                                       | Exact public HTTPS origin, without path or trailing slash                                   |
| `BETTER_AUTH_SECRET`                           | Unique random secret of at least 32 characters; stable across restarts                      |
| `PGHOST`, `PGUSER`, `PGDATABASE`, `PGPASSWORD` | Restricted application connection; separate fields verify TLS certificates                  |
| `PGPORT`                                       | Optional, defaults to 5432                                                                  |
| `DATABASE_URL`                                 | Alternative to separate fields; use certificate-verified TLS, such as `sslmode=verify-full` |

Use the hosting platform's secret settings. Never supply migration credentials to
an application deployment slot. `DATABASE_URL` takes precedence over separate
fields. Production rejects embedded `DATA_DIR` storage.

Configure App Service's container target port as 3000. Traditional custom-container
configuration uses `WEBSITES_PORT=3000`; sidecar configuration uses the container
port setting. Enable HTTPS-only access and restrict database network access to
trusted application and deployment paths.

## Security behavior

- Public signup, direct admin-plugin routes, ordinary profile edits, account
  deletion, and disabling MFA over HTTP are closed.
- Administrators must enroll MFA before accessing the workspace. Enrollment
  revokes older password-only sessions. Subsequent sign-ins require an authenticator
  or single-use recovery code. Keep `BETTER_AUTH_SECRET` backed up securely: MFA
  secrets and recovery material depend on it.
- Administrator writes require a session established in the last 15 minutes.
  Sign out and sign in again if asked. Account and category mutations commit with
  their audit events. Passwords and MFA secrets are never included in these events.
- Disabling an account or changing its role/email revokes its sessions. The last
  enabled administrator and the current administrator's own access are protected.
- Application responses use security headers and `Cache-Control: no-store`.
  SvelteKit generates script CSP nonces; inline styles remain permitted for existing
  components. HTTPS responses include HSTS.
- Authenticated application writes are limited to 30 per minute per account, with
  HTTP 429 and `Retry-After`. This bounded limiter is process-local. Before using
  multiple instances, use a shared limiter/gateway and verify authentication rate
  limits across instances. Validate client IP handling at the trusted proxy; do
  not trust arbitrary forwarding headers from public clients.
- Ticket lists use 50-row cursor pages and one latest public preview comment per
  ticket. Full conversations are still loaded together.

## Recovery and existing installations

Existing fictional accounts are not deleted or silently reset by migration. Their
old passwords remain valid until explicitly changed. Before exposing an old seeded
installation, replace those passwords individually or provision a fresh database.
Do not treat changing or removing old seed environment variables as a password reset.

Users normally recover MFA using a saved single-use code. If both the authenticator
and codes are lost, a trusted database operator must verify the person's identity
outside the application and then run:

```sh
pnpm account:recover --email user@example.com --password-file /private/new-password --reset-mfa
```

Omit `--reset-mfa` to reset only the password. Recovery revokes all sessions, pending
MFA challenges, and remembered devices, and writes an operator audit event. It
never enables a disabled account or changes a role. Administrators whose MFA was
reset must enroll again before workspace access. Use deployment/operator credentials
for this command; the web application cannot reset MFA through HTTP.

## Hosted acceptance and backup drill

Before calling the deployment ready:

- Confirm `/health` succeeds with the application login after migrations.
- Check HTTPS redirects, secure/HttpOnly session cookies, CSP and security headers.
- Confirm repeated failed logins are throttled per the actual trusted proxy path.
- Enroll MFA, sign out, and verify both authenticator and single-use recovery login.
- Create requester/agent accounts with individual passwords; verify ticket ownership,
  internal-note secrecy, account disablement, and administrator audit events.
- Restart the application and verify sessions and records survive.
- Restore a backup into a separate database and verify users, ticket relationships,
  comments, events, and schema before testing sign-in using the corresponding secret.

For example, from a trusted operator machine with PostgreSQL tools:

```sh
pg_dump --format=custom --file=capstone.dump "$DATABASE_URL"
pg_restore --no-owner --dbname="$RESTORE_DATABASE_URL" capstone.dump
```

Use an empty restore destination, keep dumps private, and never restore over the
live database. Reapply runtime grants to the restored database as appropriate.
Local tests cover migration, provisioning, restricted-role behavior, and embedded
backup recovery. Azure configuration, hosted TLS/proxy behavior, container execution,
and a hosted restore must be verified in the actual environment; they have not been
performed by this implementation.
