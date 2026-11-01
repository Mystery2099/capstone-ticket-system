# Azure deployment for a professor-accessible demo

Database verification update: the configured Azure database `capstone_tickets` contains 8 fictional users, 10 tickets, 4 comments, and 11 events after initial setup. Azure App Service deployment and hosted backup recovery remain to be performed.

This is a deployment path, not a claim that an Azure deployment has been tested. No Azure account, resources, registry, subscription, or credentials were accessed during implementation.

## Recommended shape

Run the included Linux container on Azure App Service with Azure Database for PostgreSQL Flexible Server. Keep the application stateless and put durable records in PostgreSQL. Do not rely on a container's local PGlite directory for the hosted demonstration.

The Dockerfile builds the SvelteKit Node adapter output and copies production dependencies plus tracked migrations into a Node 24 runtime image. It listens on port 3000 and runs as the unprivileged `node` user. The build needs no database or secret.

## Application settings

Configure these as App Service environment settings, rather than committing an `.env` file:

| Setting              | Value / purpose                                                                                                         |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`           | `production` (already set in Dockerfile)                                                                                |
| `HOST`               | `0.0.0.0` (already set)                                                                                                 |
| `PORT`               | `3000` (already set)                                                                                                    |
| `WEBSITES_PORT`      | `3000` for the traditional App Service custom-container configuration                                                   |
| `ORIGIN`             | Exact public HTTPS origin, e.g. `https://your-app.azurewebsites.net`, without a trailing slash                          |
| `BETTER_AUTH_SECRET` | A fresh strong random secret, at least 32 characters; keep stable across restarts                                       |
| `DATABASE_URL`       | URL-encoded PostgreSQL connection string with TLS, e.g. `postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require` |
| `SEED_DEMO`          | `1` for the first fictional-demo initialization                                                                         |
| `DEMO_PASSWORD`      | Your chosen initial password, at least 12 characters, set before the first seed                                         |

If using App Service's newer sidecar-enabled container configuration, set the container target port to 3000 in that configuration. `WEBSITES_PORT` is for the traditional custom-container path. In all cases, Azure's forwarding port and the process's `PORT` must agree.

The port-setting distinction is documented by Microsoft: [configure custom containers](https://learn.microsoft.com/en-us/azure/app-service/configure-custom-container) and [Linux App Service FAQ](https://learn.microsoft.com/en-us/troubleshoot/azure/app-service/faqs-app-service-linux-new).

The production server requires `ORIGIN` and `BETTER_AUTH_SECRET`. A remote `DATABASE_URL` is expected for hosted use. An explicit writable `DATA_DIR` can be used for intentional single-process local production smoke tests.

## Deployment sequence

1. Create the PostgreSQL database and an application login with privileges to apply the initial migration. Configure networking so App Service can reach the database, and require TLS.
2. Build and publish the Docker image to your chosen container registry. Docker was unavailable in the implementation environment, so the Dockerfile has not itself been built here.
3. Create a Linux App Service using that image. Set the environment values above, enable HTTPS, and configure the container target port.
4. Start with one application instance. Open `/health`; the first request applies tracked migrations and, when enabled, creates fictional users/tickets in one seed transaction.
5. Confirm `/health` returns `{"status":"ok"}`, then sign in using the seeded email addresses and your `DEMO_PASSWORD`.
6. Remove `SEED_DEMO` after initialization. Changing `DEMO_PASSWORD` later does not reset existing account passwords; the seed deliberately does not overwrite records.
7. Give the professor the HTTPS URL and fictional demo credentials separately. Use the three roles to show access differences.

To build the image on a machine with Docker:

```sh
docker build -t capstone-ticket-system:demo .
```

To use the built Node output without Docker, install with pnpm, run `pnpm build`, deploy `build/`, production dependencies, `package.json`, and `drizzle/`, then use `node build` as the startup command. This alternative was smoke-tested locally; Azure itself was not.

## Hosted acceptance checklist

- Refresh an authenticated ticket URL directly; verify the page and session survive restart.
- Create a ticket as Marcus, assign and reply as Priya, add an internal note, and confirm Marcus cannot see it in page data.
- Resolve the ticket and reopen it as Marcus. Close it and confirm only Jordan can reopen it.
- Disable a fictional account and verify its existing session loses application access.
- Confirm the new ticket and activity rows exist in the hosted PostgreSQL database.
- Test both 390px and desktop widths, and check HTTPS cookies and application logs.
- Verify Better Auth resolves client IPs through the trusted Azure proxy path. The local production smoke test used a shared rate-limit bucket when no client IP was available; configure the supported proxy/IP options before a multi-user demo.
- Back up, restore into a fresh database, and verify records before calling the hosted demo ready.

## Backup and recovery

The automated tests export a PGlite data directory and restore it into a fresh embedded instance, checking ticket counts and joined internal notes. That validates local recovery only.

For the hosted PostgreSQL database, use PostgreSQL's own tools on a machine that has them installed:

```sh
pg_dump --format=custom --file=capstone-demo.dump "$DATABASE_URL"
pg_restore --no-owner --dbname="$RESTORE_DATABASE_URL" capstone-demo.dump
```

`RESTORE_DATABASE_URL` must point to a separate, empty database. Do not restore over the live demo. Inspect ticket/user/comment/event counts and run the SQL examples in `architecture.md` against the restored instance. Neither `pg_dump` nor Azure recovery was executed here because those services/tools were unavailable.

## Known deployment limits

The external PostgreSQL connection path has now been exercised against the configured Azure PostgreSQL database with certificate-verified TLS. Migrations, fictional seed data, database identity/count queries, and the local application health endpoint succeeded. This verifies Azure database connectivity, not deployment of the web application to Azure App Service. The Docker image has not been built in this environment. Initial migration/seed is intended for one replica; multi-instance release coordination, monitoring, and password-reset administration remain future work. Review those items before treating this course prototype as a general-purpose service.
