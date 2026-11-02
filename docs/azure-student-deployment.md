# Low-cost student deployment

Use Azure Container Apps Consumption with zero minimum replicas, one maximum
replica, and a public image in GitHub Container Registry (GHCR). Keep the existing
Azure PostgreSQL server. This is an alternative to the App Service instructions
in [azure-deployment.md](azure-deployment.md); its database preparation,
account provisioning, and acceptance checks still apply.

## Current deployment (November 2, 2026)

The app is deployed at
[capstone-tickets](https://capstone-tickets.thankfulground-fa892d65.canadacentral.azurecontainerapps.io).
The repository remains private; the built application image is public on GHCR.

- Hosting resource group: `rg-capstone-web`, Canada Central.
- Environment: `cae-capstone`. Azure provisioned the Express environment variant,
  which uses the same Consumption billing/free grant. The standard-environment
  instructions below remain an alternative for a fresh deployment.
- App: `capstone-tickets`, 0.25 vCPU / 0.5 GiB, minimum zero / maximum one replica.
- Deployment identity: `id-capstone-github`, with Container Apps Contributor on
  the hosting resource group only; GitHub environment `azure` accepts `main`.
- Database login: `capstone_web`, inheriting the restricted `capstone_runtime`
  role. The existing database and authentication secret are preserved, so use
  your existing sign-in and authenticator.
- Azure secrets: `postgres-password` and `auth-secret`; neither value is in GitHub.
- Database firewall rule: `capstone-web-egress-1`, allowing the observed single
  outbound address. No all-Azure-services or all-Internet rule was enabled.
  Outbound addresses can change: if database connectivity fails after a cold
  start or platform change, inspect the current egress address and update this
  narrow rule. A guaranteed fixed address requires additional networking/cost.

Private runtime credential recovery data is in the deployment worktree's
`.data/azure-deployment/runtime-secrets.json` (file mode 600, excluded from Git and
Docker). Back it up to a password manager; do not copy it into tracked files.
Azure also holds the runtime secrets. Keep the existing local `.env` private.

[Express pricing and capabilities](https://learn.microsoft.com/azure/container-apps/express-faq)
use the same free grant as standard Consumption. Express has a smaller supported
configuration surface: avoid custom revision suffixes and explicit workload
profile settings when updating this app. Public GHCR pulls work anonymously;
do not add a registry entry containing only a server and no credentials.

## Cost and behavior

Container Apps includes 180,000 vCPU-seconds, 360,000 GiB-seconds, and two million
requests per subscription per month. Light demo use may fit in that allowance;
this is not a spending cap. The first request after idle time can have a cold
start. Start at 0.25 vCPU / 0.5 GiB; increase memory if the app is killed for OOM.
Use the Consumption workload profile, no dedicated profiles, no premium ingress,
and no Log Analytics workspace initially. Live logs remain available, but there
is no persisted log history with this setup. Do not use an uptime monitor that
continually wakes the app. PostgreSQL, network traffic, GitHub Actions usage, and
any optional services have their own billing. Azure for Students credit is finite.

References: [Container Apps billing](https://learn.microsoft.com/azure/container-apps/billing),
[student offer](https://learn.microsoft.com/azure/education-hub/about-azure-for-students),
[logging options](https://learn.microsoft.com/azure/container-apps/log-options).

## 1. Publish the first container

Push this branch, open a PR, and merge it to `main`. The workflow checks TypeScript,
runs unit tests, builds the Dockerfile, and publishes an image on `main`. PRs build
without publishing or deploying. No Azure resources are created by the workflow.

The first run intentionally skips deployment: `AZURE_DEPLOY_ENABLED` is unset.
In GitHub, open your profile's Packages, select `capstone-ticket-system`, then
Package settings → Change visibility → Public. The image contains application
code; only make it public if that is acceptable. Never include credentials or
private data in the image. The existing Docker ignore excludes `.env` files.
If public images are unsuitable, configure GHCR read authentication separately
before enabling deployment.

Copy the full commit-tagged image from the workflow, for example:
`ghcr.io/mystery2099/capstone-ticket-system:<full-main-commit-sha>`.
There is deliberately no mutable `latest` tag.

## 2. Create the Azure app once

In the Azure portal, select the **Azure for Students** subscription and a region
allowed by that subscription, preferably the same region as PostgreSQL (the
existing server was in Canada Central at preparation time).

1. Create a dedicated resource group, such as `rg-capstone-web`.
2. Create a standard Container Apps environment with the **Consumption** workload
   profile. Disable Log Analytics / select no log destination. Do not create a
   dedicated workload profile or a container registry. Review the pricing summary.
3. Create a Container App named, for example, `capstone-tickets`, using the public
   GHCR image from step 1, Linux amd64, 0.25 CPU, and 0.5 GiB memory.
4. Enable external HTTP ingress, target port **3000**, HTTPS only. Set revision
   mode to **Single**, minimum replicas **0**, maximum replicas **1**. Avoid HTTP
   liveness probes that depend on the database; `/health` checks database access.
5. Store the restricted runtime database URL and a newly generated, stable
   authentication secret as Container App secrets. Map environment variables:

   | Variable             | Value                                                      |
   | -------------------- | ---------------------------------------------------------- |
   | `DATABASE_URL`       | Secret reference; runtime login, TLS `sslmode=verify-full` |
   | `BETTER_AUTH_SECRET` | Secret reference; random value of at least 32 characters   |
   | `ORIGIN`             | Exact `https://` application hostname, no trailing slash   |

   Node production mode, host, and port are already set in the Dockerfile.
   The first revision may fail until the hostname is known and ORIGIN is saved;
   save the settings to create a corrected revision. Never set `DATA_DIR`.

6. Configure PostgreSQL network access for the app's actual outbound addresses.
   Do not open `0.0.0.0–255.255.255.255`. Azure's “allow Azure services” option
   permits other Azure tenants too; prefer specific rules. Outbound addresses are not guaranteed and can
   change over time, including during platform maintenance: recheck them if connectivity fails.
   If the server is private-only, the environment needs a compatible VNet path.
7. Apply pending migrations from a trusted local checkout with Node 24 / pnpm,
   using deployment credentials: `pnpm install --frozen-lockfile`, then
   `pnpm db:migrate`. Enable `PG_TRGM`, apply runtime grants, and provision the
   first administrator as described in `azure-deployment.md`. Do not give the web
   app the deployment login. Verify `/health` and complete the hosted acceptance
   checks there, including MFA and proxy behavior.

Do not paste credentials into tracked files, issue comments, or shell command
arguments. Supply migration credentials through your private local environment.
Keep the authentication secret backed up securely.

## 3. Connect GitHub to Azure without a deployment password

1. In GitHub repository Settings → Environments, create **azure**. Restrict its
   deployment branches to `main`. Required approvals are optional; adding them
   means deployments will wait for approval.
2. Use a user-assigned managed identity (as in the current deployment), or create
   an application for this repo in Microsoft Entra ID → App registrations.
   For a managed identity, add its federated credential under the identity's
   Federated credentials page and use its client ID in GitHub. For an app registration:
   Under Certificates & secrets → Federated credentials, add a GitHub Actions
   credential for owner `Mystery2099`, repository `capstone-ticket-system`, entity
   **Environment**, environment **azure**. Subject must be
   `repo:Mystery2099@54286204/capstone-ticket-system@1440190391:environment:azure`, audience
   `api://AzureADTokenExchange`. No client secret is needed.
   This repository uses GitHub's immutable subject format, including owner and
   repository IDs. Use the exact subject above rather than the name-only format
   shown in older examples. When configuring a different repository, check its
   actual subject in the Azure Login action's token details.
   [GitHub's subject format reference](https://docs.github.com/actions/reference/security/oidc#immutable-subject-claims).
3. On the dedicated resource group → Access control (IAM), grant that application's
   service principal **Container Apps Contributor**. Keep its scope to this group.
4. Set these GitHub **repository Actions variables** (Settings → Secrets and
   variables → Actions → Variables). They are identifiers, not passwords:

   | Variable                | Value                                         |
   | ----------------------- | --------------------------------------------- |
   | `AZURE_CLIENT_ID`       | Application/client ID from app registration   |
   | `AZURE_TENANT_ID`       | Directory/tenant ID                           |
   | `AZURE_SUBSCRIPTION_ID` | Student subscription ID                       |
   | `AZURE_RESOURCE_GROUP`  | `rg-capstone-web`, or your chosen group       |
   | `AZURE_CONTAINER_APP`   | `capstone-tickets`, or your chosen app        |
   | `AZURE_DEPLOY_ENABLED`  | `true`, only after app and database are ready |

5. Open Actions → Azure container deployment → Run workflow, selecting `main`.
   It publishes the current commit and updates only the existing app's image and
   replica limits. Database secrets and ORIGIN stay in Azure. It checks `/health`;
   a failed check fails the workflow and does not automatically roll back.

See [Azure GitHub Actions/OIDC guidance](https://learn.microsoft.com/azure/container-apps/github-actions).
Your account may require an administrator to create app registrations or role
assignments; this is an account permission requirement, not a code change.

## Normal updates and recovery

Push/merge passing changes to `main`; Azure then follows automatically. Before
merging changes with new database migrations, run them manually with deployment
credentials and reapply grants if needed. Use backward-compatible schema changes.
The workflow deliberately has no database credentials and never runs migrations.
Keep application secret values stable across releases.

To stop automatic deployments, set `AZURE_DEPLOY_ENABLED=false`. To roll back,
select a previous working image tag in Azure Container App → Containers → Edit
and deploy (or update the image with Azure CLI). Schema changes are separate and
are not reversed by an image rollback. A failed revision may leave the old app
serving; inspect revision status and live logs rather than assuming an outage.

Create a small monthly Azure budget with email alerts, and review Cost Analysis
and the student credit balance after your first few demos. Alerts do not stop
spending. The workflow itself does not create Azure resources, federated identities, or
role assignments; the current deployment above was provisioned separately.
