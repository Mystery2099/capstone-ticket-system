# Deployment and Operations: Support Ticket Management System

**Course:** CISY 8503 Applied Database Management  
**Lab:** Open Source Database Lab  
**Student:** Mathew Kennedy-Brewer  
**Status:** Current as of November 4, 2026  
**Project:** [Capstone Ticket System](https://github.com/Mystery2099/capstone-ticket-system)  
**Live site:** [capstone-tickets-mkb.azurewebsites.net](https://capstone-tickets-mkb.azurewebsites.net)

## Introduction

This document describes how the ticket system is hosted, how updates reach it, and the procedures for provisioning the database, recovering accounts, and checking that a deployment is ready. The application runs on Azure App Service's F1 Free tier (Linux, Node 24), backed by Azure Database for PostgreSQL. The included Dockerfile is an alternative for hosting plans that support custom containers. The reasoning behind these procedures is in the [security and data recovery plan](security-and-recovery-plan.md). All accounts should be individual, and all course data should be fictional.

## 1. Hosting choice and cost

I chose the F1 tier because it is free, which matters for a student project. The tradeoff is that it has daily CPU and memory limits, sleeps when idle, and offers no Always On setting or service-level agreement ([current limits](https://azure.microsoft.com/pricing/details/app-service/linux/)). In practice, the first request after a quiet period can take a while. The database and GitHub Actions are billed separately from the app. The hosting resource group has a monthly budget of 5 in the billing currency, with alerts at 20%, 80%, and 100%; those alerts warn me but do not stop spending, and they do not cover the database.

## 2. Azure resources

| Setting             | Value                                                  |
| ------------------- | ------------------------------------------------------ |
| Resource group      | `rg-capstone-web`, Canada Central                      |
| App Service plan    | `asp-capstone-free`, **F1 / Free**                     |
| Web app             | `capstone-tickets-mkb`                                 |
| Runtime             | Linux, `NODE\|24-lts`                                  |
| Startup command     | `bash /home/site/wwwroot/start.sh`                     |
| HTTPS only          | Enabled                                                |
| Deployment identity | `id-capstone-github`                                   |
| Identity permission | Website Contributor on the hosting resource group only |
| GitHub environment  | `azure`, deployment branch `main` only                 |

The PostgreSQL firewall rules named `capstone-appservice-*` only allow the app's published possible outbound IP addresses. Those addresses can change, so the rules need to be checked again after any change to the plan, the region, or Azure's infrastructure ([outbound IPs](https://learn.microsoft.com/azure/app-service/app-service-ip-addresses)).

## 3. Application settings

| Setting                                        | Purpose                                                                                       |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `NODE_ENV`, `HOST`, `PORT`                     | `production`, `0.0.0.0`, and the platform's port (8080 on App Service, 3000 in the container) |
| `ORIGIN`                                       | The exact public HTTPS origin, without a path or trailing slash                               |
| `BETTER_AUTH_SECRET`                           | Random, at least 32 characters; keep it stable and backed up (MFA needs it)                   |
| `PGHOST`, `PGUSER`, `PGDATABASE`, `PGPASSWORD` | The restricted application login; separate fields verify TLS certificates                     |
| `PGPORT`                                       | Optional; defaults to 5432                                                                    |
| `DATABASE_URL`                                 | Overrides the separate fields; use `sslmode=verify-full`                                      |

On App Service, these hold the restricted PostgreSQL login (`capstone_web`, which inherits `capstone_runtime`), along with `SCM_DO_BUILD_DURING_DEPLOYMENT=false` and `ENABLE_ORYX_BUILD=false`. They belong in the platform's secret settings, none of them reach GitHub or the build artifacts, and the migration credentials are never given to the web application. In production, the application refuses to use the embedded `DATA_DIR` storage meant for local development.

The runtime recovery settings are stored locally in `.data/azure-deployment/runtime-secrets.json`, with file mode 600 and ignored by both Git and Docker. They are backed up to my password manager and must never be copied into tracked files or artifacts.

## 4. First deployment

The database comes first. I provision a dedicated PostgreSQL database with two separate logins, one that owns the schema and is used for deployment and one for the application, and keep both sets of credentials outside version control. On Azure, `PG_TRGM` must also be added to the server's `azure.extensions` parameter before migrations can run.

From a trusted checkout with development dependencies installed, `pnpm db:migrate` is run with the deployment credentials. It applies the migrations and inserts the required statuses and roles, but it creates no users or tickets. Next, `scripts/runtime-grants.sql` is run as the schema owner, and `capstone_runtime` is granted to the application login. That login must not own tables, be a superuser, or inherit the deployment role, and the grants need to be reapplied after any migration that adds a table.

The first administrator is created in a database that has no accounts yet:

```sh
pnpm admin:create --name "Administrator name" --email admin@example.com --password-file /private/admin-password
```

The password file holds a unique password of 12 to 128 characters and should only be readable by the operator, who deletes it afterward. Passwords are never passed as command arguments, where they could end up in shell history. The command refuses to run if any account already exists.

The application is then deployed with only the application credentials. Neither startup nor `/health` runs migrations, so schema changes always have to be deployed before the code that needs them. Finally, the administrator signs in, enrolls an authenticator, stores the recovery codes in a password manager, and creates accounts and categories through Administration.

## 5. How updates work

The workflow in `.github/workflows/azure.yml` runs lint, the type checks, and the unit tests, builds the Node server, and packages its production dependencies. Pull requests are only validated, while passing pushes to `main` are deployed as long as `AZURE_DEPLOY_ENABLED` is `true`. Changes that only touch documentation or design files skip the workflow.

The release ZIP contains `application.tar.gz` and `start.sh`. When the app starts, `start.sh` extracts the application to local temporary storage before starting Node. I did this to keep pnpm's symbolic links intact and to avoid running the application from App Service's shared file system. All persistent data lives in PostgreSQL, so nothing is lost when that temporary copy disappears. GitHub keeps each release artifact for seven days.

GitHub signs in to Azure with a user-assigned managed identity and a federated credential, so there is no client secret to store or leak. The credential uses the issuer `https://token.actions.githubusercontent.com`, the audience `api://AzureADTokenExchange`, and a subject in GitHub's immutable-ID format ([details](https://docs.github.com/actions/reference/security/oidc#immutable-subject-claims)):

```text
repo:Mystery2099@54286204/capstone-ticket-system@1440190391:environment:azure
```

The repository variables are `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, `AZURE_RESOURCE_GROUP` (`rg-capstone-web`), `AZURE_WEBAPP_NAME` (`capstone-tickets-mkb`), and `AZURE_DEPLOY_ENABLED`, which pauses deployments when set to `false`.

## 6. Migrations and rollback

Before merging code that needs a migration, I run `pnpm db:migrate` from a trusted checkout with the deployment credentials, and I reapply `scripts/runtime-grants.sql` if any tables changed. Schema changes need to stay backward compatible, because rolling back the code does not roll back the data. The process for writing a migration is in [database design](database-design.md).

To redeploy, I rerun the workflow on `main`. Within seven days, I can roll back by deploying an earlier `azure-release` artifact with `az webapp deploy --type zip`; after that, the change has to be reverted on `main`. A failed health check fails the workflow but does not roll anything back automatically.

## 7. Account recovery

Users normally recover from a lost authenticator with one of their saved single-use recovery codes. If someone has lost both the authenticator and the codes, I first verify their identity outside the application, then run the following with the deployment credentials:

```sh
pnpm account:recover --email user@example.com --password-file /private/new-password --reset-mfa
```

Leaving out `--reset-mfa` resets only the password. Recovery revokes the account's sessions, pending MFA challenges, and remembered devices, and writes an audit event. It never re-enables a disabled account or changes a role, and the web application itself has no way to reset MFA over HTTP.

## 8. Troubleshooting

An error saying `column "impersonated_by" does not exist` means the database is behind the code. The fix is to run `pnpm db:migrate` against the application's database rather than patching individual tables.

If `pg_trgm` is reported as not allow-listed, `PG_TRGM` needs to be added to `azure.extensions`, keeping the existing entries, before running the migrations again. Pending migrations roll back together, so nothing is left half applied ([Azure instructions](https://learn.microsoft.com/en-us/azure/postgresql/extensions/how-to-allow-extensions)).

If email and password sign-in fails for an enabled account that has no `credential` password, `pnpm account:recover` can set one. There is no default password.

`INVALID_ORIGIN` is an origin mismatch, not a wrong password. Local authentication expects `http://localhost:5173` (or `127.0.0.1:5173`). If Vite falls back to port 5174 because another instance is running, either stop the other instance or run `ORIGIN=http://localhost:5174 pnpm dev --port 5174`.

## 9. Hosted acceptance and backup drill

Local tests cover migrations, provisioning, and restricted-role behavior, but they do not prove the hosted deployment is ready. Before I consider a deployment ready, these need to hold on the hosted system:

- `/health` succeeds with the application login after migrations.
- HTTP redirects to HTTPS, cookies are Secure and HttpOnly, and the CSP and security headers are present.
- Repeated failed logins are throttled through the actual proxy path.
- MFA enrollment, authenticator sign-in, and single-use recovery sign-in work.
- Ticket ownership, internal-note secrecy, account disablement, and audit events hold.
- Sessions and records survive an application restart.
- A backup restores into a separate database with users, relationships, comments, events, and schema intact.

A complete dump has to be taken with the deployment login. The application login cannot run `pg_dump`, because it has no access to the migration history in the `drizzle` schema and cannot read the ticket-number sequence directly; the first restore drill confirmed this. The backup and restore commands read passwords from a `~/.pgpass` file with mode 600, so no password appears in the command line or the process list. The connection details come from the usual `PGHOST`, `PGUSER`, and `PGDATABASE` settings:

```sh
pg_dump --format=custom --file=capstone.dump
pg_restore --no-owner --no-privileges --dbname=capstone_restore capstone.dump
```

`--no-privileges` skips the dump's grants, because the roles they mention do not exist yet on a fresh server. A dump should only be restored into an empty database, and dumps must be kept private. After restoring, I run `pnpm db:migrate` and then `scripts/runtime-grants.sql`, in that order, and record the row counts at backup time so the restore can be compared against them. The result of each drill is recorded in the [security and data recovery plan](security-and-recovery-plan.md).
