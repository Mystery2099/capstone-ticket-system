# Student deployment

The app runs on **Azure App Service F1 Free** (Linux, Node 24) with Azure
PostgreSQL: [capstone-tickets-mkb.azurewebsites.net](https://capstone-tickets-mkb.azurewebsites.net).
See [operations](azure-deployment.md) for provisioning, recovery, and acceptance checks.

F1 has daily CPU/memory limits, sleeps when idle, and has no Always On or SLA
([current limits](https://azure.microsoft.com/pricing/details/app-service/linux/)).
Database and GitHub Actions costs are separate. The hosting group has a monthly
budget of 5 (billing currency) with alerts at 20%, 80%, and 100%; alerts do not
stop spending or cover the database.

## How updates work

`.github/workflows/azure.yml` runs type checks and unit tests, builds the Node
server, and packages production dependencies. Pull requests validate only;
passing pushes to `main` deploy when `AZURE_DEPLOY_ENABLED=true`. Docs/design-only
changes are skipped.

The release ZIP holds `application.tar.gz` and `start.sh`, which extracts the app
to local temporary storage before starting Node (keeping pnpm symlinks intact and
avoiding the shared filesystem). All persistent data lives in PostgreSQL. GitHub
keeps release artifacts for seven days.

## Azure resources

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

App settings hold the restricted PostgreSQL login (`capstone_web`, inheriting
`capstone_runtime`), a stable `BETTER_AUTH_SECRET`, and `ORIGIN`, plus
`NODE_ENV=production`, `HOST=0.0.0.0`, `PORT=8080`,
`SCM_DO_BUILD_DURING_DEPLOYMENT=false`, and `ENABLE_ORYX_BUILD=false`. None of
these reach GitHub or build artifacts.

PostgreSQL firewall rules named `capstone-appservice-*` allow only the app's
published possible outbound IPs. Recheck them after a plan, region, or Azure
infrastructure change ([outbound IPs](https://learn.microsoft.com/azure/app-service/app-service-ip-addresses)).

## Deployment identity

GitHub signs in with a user-assigned managed identity and federated credential
(no client secret). Issuer `https://token.actions.githubusercontent.com`, audience
`api://AzureADTokenExchange`, and subject (immutable-ID format,
[details](https://docs.github.com/actions/reference/security/oidc#immutable-subject-claims)):

```text
repo:Mystery2099@54286204/capstone-ticket-system@1440190391:environment:azure
```

Repository variables: `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`,
`AZURE_RESOURCE_GROUP` (`rg-capstone-web`), `AZURE_WEBAPP_NAME`
(`capstone-tickets-mkb`), and `AZURE_DEPLOY_ENABLED` (`false` pauses deployments).

## Migrations, rollback, and secrets

Before merging code that needs a migration, run `pnpm db:migrate` from a trusted
checkout with deployment credentials, and reapply `scripts/runtime-grants.sql` if
tables changed. Keep schema changes backward-compatible: rolling back code does
not roll back data.

To redeploy, rerun the workflow on `main`. To roll back within seven days, deploy
an earlier `azure-release` artifact with `az webapp deploy --type zip`; otherwise
revert on `main`. A failed health check fails the workflow but does not roll back.

Runtime recovery settings are in the deployment worktree's
`.data/azure-deployment/runtime-secrets.json` (mode 600, ignored by Git and Docker).
Back them up to a password manager and never copy them into tracked files or artifacts.
