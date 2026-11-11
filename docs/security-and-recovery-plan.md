# Security and Data Recovery Plan: Support Ticket Management System

**Course:** CISY 8503 Applied Database Management  
**Lab:** Open Source Database Lab  
**Student:** Mathew Kennedy-Brewer  
**Status:** Current as of November 11, 2026  
**Project:** [Capstone Ticket System](https://github.com/Mystery2099/capstone-ticket-system)  
**Database:** Azure Database for PostgreSQL

## Introduction

This plan explains how the ticket system protects its data and how I would recover that data after a failure. The exact operator commands are in [deployment and operations](deployment-and-operations.md); this document describes the reasoning behind them and the order I would follow in each situation. Most of the security controls described here are implemented and covered by automated tests. Two restores from hosted data into separate local PostgreSQL servers were recorded on November 4, 2026, as detailed at the end of this plan. These drills did not test Azure point-in-time restore or rebuilding the App Service host.

## 1. What needs protecting

The most important asset is the ticket data in PostgreSQL: tickets, public comments, internal notes, and their history. Internal notes are the most sensitive part, since they are meant for staff and may contain remarks a requester should never see. The same database also holds accounts, sessions, and the protected MFA secrets that control who can reach that data.

A few things live outside the database but are just as necessary. `BETTER_AUTH_SECRET` signs sessions and protects stored MFA material, so losing it would lock out every enrolled authenticator. The database credentials give direct access to every record. Both are stored as App Service settings and backed up in my password manager. The source code and migrations live on GitHub, which is what I would use to rebuild the application and its schema.

## 2. Authentication and access to the application

Better Auth handles passwords, sessions, authenticator-based MFA, and single-use recovery codes. I chose to rely on an established library for these parts rather than writing my own, since mistakes in authentication are easy to make and hard to notice. There is no public signup, and Better Auth's direct admin-plugin routes are disabled. The first administrator is created from the command line with `pnpm admin:create`, and administrators create every other account, which matches a small internal team where nobody should be able to create an account for themselves.

Administrators must enroll MFA before they can use the workspace. Enrolling revokes older sessions that were signed in with only a password, and later sign-ins require the second factor. The setup page generates its QR code locally rather than through an outside service, offers a manual key, and requires the user to confirm they saved their recovery codes; the downloadable codes never include the authenticator secret. The [redacted setup screenshot](screenshots/mfa-setup-redacted.png) is safe to show in the demonstration. Ordinary profile edits, account deletion, and turning off MFA are blocked over HTTP, so those changes go through administrators or the operator recovery command.

For this project, MFA is required only for accounts that can manage administration; agents and requesters can enroll but are not forced to. That keeps the demonstration accounts easy to use while protecting the accounts that can change everyone else's access. In production I would require MFA for every account, since a requester's tickets can still contain personal or sensitive information. In practice I would most likely not manage that inside the application at all. An organization running a help desk usually already has an identity provider, such as Microsoft Entra ID, so I would connect sign-in to it through single sign-on with OpenID Connect or SAML, which Better Auth supports through its SSO plugin. The identity provider would then enforce MFA, password policy, and account lockout in one place, and disabling someone there would remove their access to the ticket system along with everything else. The application would still keep its own roles and capabilities, because the identity provider only proves who someone is, not what they are allowed to do with tickets.

Whenever the second factor is my decision rather than the identity provider's, I would not offer codes sent by text message or email. Text messages can be intercepted or redirected through SIM swapping and phone-number porting, and an email code is only as strong as the mailbox it goes to, which is often protected by the same reused password the second factor is supposed to back up. Both also make it easy for a phishing page to ask for the code in real time. The application deliberately offers only authenticator-app codes and single-use recovery codes, and the next step I would add is passkeys or hardware security keys, which are tied to the real site and cannot be phished the same way.

Every request reloads the account, whether it is enabled, and the capabilities saved for its role, rather than trusting what the browser or an older session says. Disabling an account or changing its role or email revokes its sessions immediately. The server checks capabilities for every action, so hiding a button is never the only protection. Requesters can only retrieve their own tickets, and internal notes are filtered out of responses, previews, counts, activity, search results, and notifications. Authenticated writes are limited to 30 per minute per account. The details are in [roles and permissions](roles-and-permissions.md).

## 3. Access to the database

The application write limiter covers authenticated POST requests outside `/api/auth/`, at 30 per minute per account per server process. Better Auth handles authentication endpoints separately. The limiter resets on restart and is not shared across replicas; multi-instance hosting needs shared rate limiting.

The browser never connects to PostgreSQL; only the server does. I use two separate logins. The deployment login owns the schema and runs migrations, while the application login, `capstone_web`, inherits a `capstone_runtime` role that `scripts/runtime-grants.sql` limits to the statements the application actually needs on each table. The application cannot create or drop tables, and `ticket_event`, `security_event`, and `ticket_comment` are insert-only for it, so it cannot rewrite history.

All queries go through Drizzle, which sends parameterized SQL. The Azure PostgreSQL firewall only admits the App Service's outbound addresses and trusted deployment paths, and connections verify the server's TLS certificate. The schema also enforces integrity on its own through foreign keys, allowed values for priority and format, a fixed status table, and unique ticket numbers, so a mistake in application code still cannot store an invalid relationship.

## 4. Transport, browser, and secrets

The site is HTTPS only, with HSTS, and session cookies are HttpOnly and Secure over HTTPS. Every response includes a Content Security Policy with script nonces, `Cache-Control: no-store`, and `X-Frame-Options: DENY`. Formatted messages are rendered with raw HTML escaped, no images loaded, and only `http`, `https`, and `mailto` links allowed.

No secrets are stored in Git. The `.env` file and local data are ignored, and `.env.example` only contains placeholders. GitHub deploys through a federated identity, so it stores no Azure password at all. When I provision or recover an account from the command line, the password is read from a private file rather than passed as an argument, where it could end up in shell history.

## 5. Audit trail

Every ticket change writes a `ticket_event` row in the same transaction as the change, so the history cannot disagree with the ticket. Account and category changes, role deletion, the initial administrator bootstrap, and operator account recovery write a `security_event` row. Those two tables are what I would review after a suspected compromise.

## 6. Backups

The backup policy uses two kinds of backup. Azure Database for PostgreSQL flexible server provides automated backups and point-in-time restore; the configured retention must be checked in Azure. The intended retention is seven days, or up to 35 days if configured. Separately, the operator should take a logical dump with `pg_dump --format=custom` using the deployment credentials before every migration and once a week, keeping the four most recent. The repository does not automate that schedule; the recorded drills demonstrate individual successful dumps and restores, not ongoing compliance with the policy.

| Backup                               | Method                                  | Frequency                      | Retention                    |
| ------------------------------------ | --------------------------------------- | ------------------------------ | ---------------------------- |
| Azure automated backups              | Point-in-time restore, managed by Azure | Continuous                     | 7 days by default (up to 35) |
| Logical dump                         | `pg_dump --format=custom`               | Before every migration; weekly | Last 4, stored privately     |
| `BETTER_AUTH_SECRET`, DB credentials | Password manager                        | When created or rotated        | Current and previous         |
| Source code and migrations           | GitHub repository                       | Every push                     | Full history                 |

Dumps contain personal data and password hashes, so they have to stay out of the repository and out of shared folders.

## 7. Recovery objectives

For a course project with a small team, I am targeting a recovery point of a few minutes when point-in-time restore is available, or up to one week if only the weekly dump survives. The recovery time target is under two hours to a working, verified application. A production help desk would likely need a paid tier with high availability to do better than that, which is outside this project's budget.

## 8. Recovery procedures

**Bad data or an accidental deletion.** I would note the time just before the mistake and use Azure's point-in-time restore to create a new server at that moment, never overwriting the live one. From there I can either dump the affected rows and repair the live database or, if the damage is widespread, point the application at the restored server. If I switch over, the restored server needs the same firewall rules as the original (see the next procedure). Either way I run the verification checks in section 9.

**Losing the database server.** I would restore the latest Azure backup to a new server, or create a new server and restore the latest dump into an empty database as shown in [deployment and operations](deployment-and-operations.md). A restored Azure server does not keep the original firewall rules, so I recreate the `capstone-appservice-*` rules from the App Service's current outbound addresses. The new server also needs `PG_TRGM` allow-listed in `azure.extensions` and a new application login. The order matters next: `pnpm db:migrate` applies any migrations newer than the backup, and only then do I run `scripts/runtime-grants.sql`, because the grants script can only grant access to tables that already exist. Finally, I update the App Service connection settings and restart the application.

**Losing the application host.** The application keeps no data on its host, so I would recreate the App Service from the settings in [deployment and operations](deployment-and-operations.md), restore its settings from the password manager, and rerun the GitHub workflow. It has to use the same `BETTER_AUTH_SECRET` as before, or every enrolled authenticator stops working.

**A compromised account or credential.** For a user account, I would disable it in Administration, which revokes its sessions, then reset its password and MFA with `pnpm account:recover` after confirming the person's identity outside the application. A leaked database password is rotated in Azure, updated in the App Service settings, and followed by a restart. Rotating `BETTER_AUTH_SECRET` signs everyone out and makes the stored MFA secrets unusable. Users cannot simply enroll again, because their accounts are still marked as enrolled, so I would run `pnpm account:recover --reset-mfa` for each enrolled account. That command also sets a new temporary password, which I would deliver to each person outside the application before they sign in and enroll again. This is why the secret has to be backed up rather than regenerated. In each case I would review the `security_event` and `ticket_event` rows for the affected period.

## 9. Verifying a restore

A restore is only finished once the application works against it. I would confirm that `/health` succeeds using the application login rather than the deployment login, that accounts can sign in with an authenticator, and that row counts for `ticket`, `ticket_comment`, `ticket_event`, and `user` match the counts recorded when the backup was taken. Comparing against the live database would be misleading, since it may have newer rows than the backup. A sample ticket should still show its comments and history in order, and a requester should still be unable to see internal notes or other requesters' tickets.

## 10. Testing this plan

I intend to restore a dump into a separate, empty database at least once per term and after any major schema change, and record the result below. The automated tests already cover migrations, provisioning, restricted-role behavior, and transaction rollback, but they run against local databases and do not replace a hosted restore drill.

| Date        | Source                                             | Restored into                                                    | Result | By                    |
| ----------- | -------------------------------------------------- | ---------------------------------------------------------------- | ------ | --------------------- |
| Nov 4, 2026 | Hosted Azure database, export at 01:47:38 UTC      | Separate PostgreSQL 18 database built with `pnpm db:migrate`     | Passed | Mathew Kennedy-Brewer |
| Nov 4, 2026 | Full `pg_dump` of the hosted database at 02:22 UTC | Separate, empty PostgreSQL 18 server, restored with `pg_restore` | Passed | Mathew Kennedy-Brewer |

### First drill, November 4, 2026

I exported every table in the `public` schema from the hosted database inside one read-only, repeatable-read transaction, so all tables came from the same moment. I then built an empty PostgreSQL 18 database on my own machine with `pnpm db:migrate` and loaded the exported rows with every foreign key and check constraint active, so any orphaned or invalid row would have stopped the load. All fourteen tables loaded without errors, and I reset the ticket-number sequence to the highest restored number.

The row counts in the restored database matched the counts I recorded at export time exactly: 14 users, 1,016 tickets, 12 comments, 1,032 ticket events, 9 security events, 5 categories, 3 roles, and 2 notifications. Joins across tickets, users, categories, and statuses returned the expected groupings, and each ticket's comments and events were still attached to it. The built application started against the restored database, `/health` returned 200, and an existing requester signed in successfully, which shows that accounts and password hashes survived. I deleted the export and the restored database afterward, since they contained password hashes.

The drill also showed a limit in my backup procedure. The application login could not run `pg_dump`, because it has no access to the `drizzle` schema that holds the migration history and cannot read the ticket-number sequence directly. That is the least-privilege design working as intended, but it means a complete `pg_dump` has to be taken with the deployment login, which I keep off the web server. I ran a second drill with the deployment login to close that gap.

### Second drill, November 4, 2026

This time I followed the documented procedure exactly. I recorded row counts, took a full `pg_dump --format=custom` of the hosted database with the deployment login, and recorded the counts again; they had not changed during the dump. The 190 KB dump included the migration history as well as the data. I restored it into a new, empty PostgreSQL 18 server with `pg_restore --no-owner --no-privileges`, which finished without errors.

Running `pnpm db:migrate` against the restored database found nothing to apply, which confirms the migration history came back with the data. I then ran `scripts/runtime-grants.sql` and created a separate login that only inherits `capstone_runtime`, the same arrangement the live site uses. Row counts matched the counts recorded at backup time exactly (14 users, 1,021 tickets, 16 comments, 1,051 ticket events, 16 security events, 11 notifications, and all 8 migrations), and the ticket-number sequence continued from the same value, 2059. The built application started using only the restricted login, `/health` returned 200, and a requester signed in with their current password. I deleted the dump and the restored server afterward.

## Conclusion

The application's security depends on layers that do not trust each other: the server checks capabilities, the database login is restricted, and the schema rejects invalid data on its own. Recovery depends on backups that exist in more than one form and on secrets that are stored outside Azure. Two restore drills showed that the hosted database, including its migration history, can be rebuilt on a separate server and run by the application under its restricted login. The plan's next test is due after the next major schema change or at the start of next term.
