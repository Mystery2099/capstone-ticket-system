# Free student deployment

The app uses **Azure App Service F1 Free**, Linux / Node 24, with the existing
Azure PostgreSQL database. The deployed URL is:

[capstone-tickets-mkb.azurewebsites.net](https://capstone-tickets-mkb.azurewebsites.net)

## Cost and limits

F1 has limited daily CPU, memory, and storage, sleeps when idle, and has no uptime
SLA or Always On. Check [Microsoft's current limits](https://azure.microsoft.com/pricing/details/app-service/linux/).
Database and GitHub Actions costs/allowances are separate. The workflow does not
upgrade the plan. The hosting group's monthly budget is 5 in the billing currency,
with alerts at 20%, 80%, and 100%; alerts do not stop spending or cover the database.

## How updates work

`.github/workflows/azure.yml` checks types, runs unit tests, builds the SvelteKit
Node server, and packages production dependencies. PRs validate without deploying.
Passing pushes to `main` deploy automatically when `AZURE_DEPLOY_ENABLED=true`.
Documentation/design-only changes are skipped to save build minutes.

The release ZIP contains `application.tar.gz` and `start.sh`. The startup script
extracts the application to local temporary storage before starting Node, so pnpm
symlinks remain intact and dependency reads avoid App Service's shared filesystem.
All persistent application data lives in PostgreSQL. Startup never runs migrations.
GitHub retains release artifacts for seven days. No container registry is needed.

## Azure resources and configuration

| Setting             | Value                                                  |
| ------------------- | ------------------------------------------------------ |
| Resource group      | `rg-capstone-web`, Canada Central                      |
| App Service plan    | `asp-capstone-free`, **F1 / Free**                     |
| Web app             | `capstone-tickets-mkb`                                 |
| Runtime             | Linux, `NODE\|24-lts`                                  |
| Startup command     | `bash /home/site/wwwroot/start.sh`                     |
| HTTPS only          | Enabled                                                |
| Always On           | Disabled (F1 requirement)                              |
| Deployment identity | `id-capstone-github`                                   |
| Identity permission | Website Contributor on the hosting resource group only |
| GitHub environment  | `azure`, deployment branch `main` only                 |

App Service application settings hold the restricted PostgreSQL login and stable
`BETTER_AUTH_SECRET`, together with `ORIGIN` set to the exact public HTTPS URL.
They are not included in GitHub, build artifacts, or the public application.
`NODE_ENV=production`, `HOST=0.0.0.0`, and `PORT=8080` configure the server.
`SCM_DO_BUILD_DURING_DEPLOYMENT=false` and `ENABLE_ORYX_BUILD=false` keep builds in
GitHub. The GitHub runner receives no database or authentication secrets.

The runtime login is `capstone_web`, inheriting `capstone_runtime`; it is not the
schema owner and does not inherit the deployment/admin login. Existing accounts,
passwords, MFA enrollment, and the authentication secret are preserved. Sign in
with your existing account and authenticator.

PostgreSQL firewall rules named `capstone-appservice-*` allow the web app's
published possible outbound IP set, rather than all Azure services or the whole Internet.
Normal code deployment does not require changing these rules. Recheck the full
possible outbound IP set after a hosting-plan/region change or an Azure infrastructure
change. [App Service outbound IP behavior](https://learn.microsoft.com/azure/app-service/app-service-ip-addresses).

The Dockerfile remains available for optional container hosting. The current
workflow deploys ZIP releases and the GitHub repository stays private.

## Deployment identity

GitHub authenticates to Azure using a user-assigned managed identity and a
federated credential, without a client password. Its exact trust subject is:

```text
repo:Mystery2099@54286204/capstone-ticket-system@1440190391:environment:azure
```

Issuer: `https://token.actions.githubusercontent.com`.
Audience: `api://AzureADTokenExchange`.
GitHub uses the immutable IDs in this repository's subject; older name-only
examples will not match. [GitHub subject format](https://docs.github.com/actions/reference/security/oidc#immutable-subject-claims).

GitHub Actions repository variables:

- `AZURE_CLIENT_ID`: deployment identity's client ID.
- `AZURE_TENANT_ID`: Azure directory ID.
- `AZURE_SUBSCRIPTION_ID`: student subscription ID.
- `AZURE_RESOURCE_GROUP`: `rg-capstone-web`.
- `AZURE_WEBAPP_NAME`: `capstone-tickets-mkb`.
- `AZURE_DEPLOY_ENABLED`: `true` when hosting is ready; `false` to pause deployments.

## Migrations and recovery

Before merging code that needs new database migrations, run `pnpm db:migrate`
from a trusted checkout with deployment credentials in your private environment.
Reapply `scripts/runtime-grants.sql` after relevant schema changes. See
[database provisioning and recovery](azure-deployment.md) for administrator setup,
MFA recovery, runtime privileges, backup/restore, and hosted acceptance checks.
Use backward-compatible schema changes: rolling back code does not roll back data.

To redeploy, run the workflow on `main`. To roll back within the seven-day artifact
retention window, deploy an earlier `azure-release` artifact's `release.zip` with
`az webapp deploy --type zip` to the app above. Otherwise, revert the relevant code
on `main` or rebuild the earlier revision with its lockfile. Keep secrets stable.
A failed health check fails the workflow without automatically rolling back.

Private runtime recovery settings are in the deployment worktree's
`.data/azure-deployment/runtime-secrets.json`, file mode 600, excluded from Git and
Docker. Back them up to a password manager. The existing local `.env` also remains
private. Never copy either file into a tracked directory or build artifact.
