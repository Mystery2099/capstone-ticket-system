# Test and Demonstration Plan: Support Ticket Management System

**Course:** CISY 8503 Applied Database Management  
**Lab:** Open Source Database Lab  
**Student:** Mathew Kennedy-Brewer  
**Status:** Current as of November 4, 2026  
**Project:** [Capstone Ticket System](https://github.com/Mystery2099/capstone-ticket-system)

## Introduction

This plan lists how I check that the ticket system meets its [requirements](requirements.md) and how I intend to demonstrate it for the lab. Some of these checks are automated and run on every change, while others have to be done by hand in a browser or against the hosted database. I have tried to be clear about which is which, because passing tests on my own machine does not prove the Azure deployment behaves the same way.

## 1. Automated checks

Four commands check the project before every pull request: `pnpm lint`, `pnpm check`, `pnpm test`, and `pnpm build`. GitHub Actions runs the type checks and unit tests again before deploying. The unit tests run against disposable PGlite databases with fictional fixtures, and they cover ticket workflows, authorization, transaction rollback, provisioning, and security headers.

`pnpm test:e2e` starts its own isolated server and drives a real browser through the main workflows: a requester who cannot read private notes or other tickets, an agent creating and replying to a ticket, drafts surviving a reload, administration screens, and a custom role signing in with its permissions. On November 4, 2026, all 31 unit tests and all 9 browser tests passed.

## 2. Acceptance checks

Before the first browser run, install Chromium with `pnpm exec playwright install chromium`, adding `--with-deps` on Linux if system dependencies are missing. Port 4180 must be free: Playwright refuses to reuse an existing server. The dated test counts above are historical results, not a fresh verification of the current checkout.

The table below lists what has to hold in each area. Most of these are covered by the automated tests above; the recovery check and the hosted versions of the account checks still need to be done by hand.

| Area           | What to verify                                                                                                           |
| -------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Accounts       | Sign-in and sign-out, MFA enrollment, single use of recovery codes, session revocation, and disabled-account rejection   |
| Creation       | The ticket and its event are saved together; invalid fields and foreign keys are rejected                                |
| Authorization  | Requesters cannot access others' tickets, change priority, or submit internal notes                                      |
| Staff workflow | Unassigned tickets are visible; assignment rejects disabled or ineligible users; metadata edits are audited              |
| Conversation   | Public replies are visible; internal notes are excluded from requester responses, previews, counts, activity, and search |
| Status         | Requesters reopen their own Resolved tickets; Closed is read-only until someone permitted reopens it                     |
| Transactions   | A failed event insert rolls back its ticket change                                                                       |
| Administration | Account, category, and role changes persist; unauthorized access is rejected; the last administrator is protected        |
| Formatting     | Formatting survives saving, reloading, and draft recovery; raw HTML, images, and unsafe links are not rendered           |
| Notifications  | Followers and chosen people are notified, and internal notes only reach people who can read them                         |
| Search         | Word order and forms, typos, comments and names, highlights, filters, ticket-number redirects, and permission boundaries |
| Recovery       | PostgreSQL restores into a separate database with relationships, records, and sign-in intact                             |

## 3. Manual browser checks

Some interactions are only meaningful in a real browser, and database tests cannot verify them. I check that a search suggestion can be selected with the arrow keys and Enter, that submitting a ticket number opens that ticket, that sorting and filters change the results, that recent searches can be cleared, and that search works on a phone-sized screen. I also repeat a search that matches an internal note while signed in with and without note access, to confirm the results differ in the way they should.

## 4. Live demonstration

The demonstration follows one ticket through its whole lifecycle and then shows the database underneath it. I plan to use fictional data and individual accounts throughout.

1. As a requester, create a ticket.
2. As an agent, find it, assign it, add a public reply and an internal note, and resolve it.
3. As the requester, confirm the reply is visible and the note is not, then reopen the ticket.
4. Run SQL joins across tickets, users, categories, and statuses, show comments and events in chronological order, and show counts grouped by status or category. These queries are prepared in [demo-queries.sql](demo-queries.sql).
5. Show a rejected reference or unauthorized operation, and a transaction that rolls back. The last section of the same file attempts three invalid changes inside a transaction that is always rolled back.
6. Show evidence of a backup restored into a separate database.

## 5. Hosted evidence

On November 4, 2026, I checked the parts of the hosted deployment that can be verified without changing it. Plain HTTP redirects to HTTPS, and the live site sends HSTS, a Content Security Policy with script nonces, `Cache-Control: no-store`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, and a same-origin referrer policy. The application login was denied access to the migration history and could not read the ticket-number sequence directly, which confirms its grants are restricted. I also completed two restore drills into a separate PostgreSQL database, the second from a full `pg_dump`; the method and results are recorded at the end of the [security and data recovery plan](security-and-recovery-plan.md).

I then ran the core acceptance checks against the live site in a real browser, using fictional demonstration accounts and tickets clearly labeled as acceptance checks. A requester created a ticket, which was saved at Normal priority with no staff controls shown. An agent assigned it, posted a public reply, added an internal note, and resolved it. The requester saw the reply, but the note's text appeared nowhere on the page or in its HTML, and searching for the note's text returned nothing for the requester while returning the ticket for the agent. The requester received a 404 when opening another requester's ticket, reopened their own Resolved ticket, and found it read-only after the agent closed it. The server recorded seven audit events for the ticket: creation, assignment, the reply, the note, and three status changes. Repeated sign-ins from one address were refused with "Too many sign-in attempts," which confirms that throttling works through Azure's proxy.

Earlier, on November 2, 2026, I signed in to the live site with an administrator account using an authenticator code, which confirms that MFA sign-in works through the hosted deployment. Those sessions have stayed active since, because a session lasts seven days and restarts that period whenever it is used after a day, so I have not needed to sign in again. The only check I have not repeated on the live site is signing in with a single-use recovery code, which the automated tests cover locally; using one on a real administrator account would spend a code. The procedures are in [deployment and operations](deployment-and-operations.md).

## Conclusion

The automated tests give me reasonable confidence in the application's rules, especially around private notes and transactions, which are the areas most likely to fail without anyone noticing. The same rules held on the live site, along with its security headers, sign-in throttling, and a restore into a separate database.
