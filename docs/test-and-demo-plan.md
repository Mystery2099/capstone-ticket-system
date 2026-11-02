# Capstone Ticket System: Testing and Demonstration Plan

**Status:** Implemented. Run `pnpm test` for the database and configuration suites, add `TEST_BASE_URL` to include the HTTP acceptance scenario against a disposable server, and run `pnpm test:e2e` for the browser journeys. T15's hosted `pg_dump` restore has not been run.

## What I want to prove

A working interface isn't enough for this lab. I want to show that PostgreSQL is storing the data correctly, that the relationships actually matter, and that the system rejects invalid or unauthorized operations. The tests should also make it easier to respond to the professor's surprise requirement changes, since we can check whether a small change broke something else.

## Acceptance test matrix

| ID  | Scenario                                              | Expected result                                                   | Main evidence                  |
| --- | ----------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------ |
| T01 | Requester signs in and creates ticket                 | Ticket and creation event saved                                   | UI + SQL SELECT                |
| T02 | Submit ticket with missing/invalid category           | Validation or foreign-key failure, no partial ticket              | Form + integration test        |
| T03 | Requester opens another requester's ticket URL        | Access rejected                                                   | Authorization test             |
| T04 | Agent opens unassigned and other agents' tickets      | Both are visible                                                  | Agent list and SQL             |
| T05 | Agent assigns ticket to enabled agent                 | Assignee changes and history is recorded                          | UI + transaction test          |
| T06 | Assign ticket to requester or disabled account        | Operation rejected                                                | Integration test               |
| T07 | Agent moves ticket to On Hold and resumes it          | Valid transitions work and are audited                            | Workflow test                  |
| T08 | Requester reopens own Resolved ticket                 | Status becomes Open, history recorded                             | Requester UI + SQL             |
| T09 | Requester tries to reopen another person's ticket     | Operation rejected                                                | Authorization test             |
| T10 | Agent adds an internal note                           | Visible to agent/admin only                                       | Two-role UI test               |
| T11 | Requester manipulates submission to add internal note | Operation rejected                                                | Forged request test            |
| T12 | Requester requests conversation data                  | No internal note body, metadata or sensitive event details leaked | Server response test           |
| T13 | Status update succeeds but event insert fails         | Entire transaction rolls back                                     | Integration test               |
| T14 | Administrator manages categories and roles            | Changes persist; non-admin attempts rejected                      | UI + authorization test        |
| T15 | Backup and restore development database               | Restored DB retains expected records                              | pg_dump / restore verification |
| T16 | New requirement changes one ticket attribute          | Migration, UI and tests updated without data loss                 | Change log + demo              |

## Database queries to demonstrate

I want to show a query that joins tickets with their requesters, assignees, categories, and statuses; another that counts tickets grouped by status or category; and another that retrieves comments and activity history in chronological order. The demo should also include an invalid foreign-key value being rejected and a transaction that updates a ticket with its audit record. These examples will demonstrate more about the database than showing a collection of screenshots alone.

## A manageable live demonstration

First, sign in as a requester and create a ticket. Then switch to an agent account, locate that ticket in the unassigned queue, assign it, add a public reply and an internal note, and change its status. Finally, switch back to the requester account to confirm that the public reply is visible but the internal note isn't, and reopen the ticket after it has been resolved.

After that, inspect the corresponding PostgreSQL records and show that the events match what happened in the interface. If there's time, demonstrate an invalid operation and a successful backup restoration. Automated tests use repeatable fixtures in disposable databases. The deployed application uses individual accounts and explicit setup; it never seeds sample accounts at startup.

## Responding to a change request

When the professor requests a change, I'll record the new requirement, identify the affected database fields and application screens, implement the smallest safe change, and run the related tests. This isn't intended to simulate an entire enterprise change-management process; it's just enough structure to show that I can adapt the design without guessing. A migration affecting existing data should be reversible or have an explicit recovery approach.

## Additional agreed-rule tests

- New requester-created tickets start with Normal priority; manipulating the request body cannot change it.
- Agents and administrators can set Low, Normal and High, but requesters cannot edit priority.
- Administrators can perform ticket operations available to agents.
- Closed tickets refuse new replies, internal notes and ordinary edits.
- Agents and requesters cannot reopen Closed tickets; administrators can reopen them to Open and the history records the transition.
- Requesters can still reopen their own Resolved tickets, without gaining access to other users' tickets.

## Search acceptance checks

Database tests cover reordered words, word forms, subject typos, comment/name matches,
search highlights, ticket-number redirect permissions, and private-content exclusion in
live suggestions. Options tests cover requester and creation-date filtering.

For a manual demonstration, type a partial subject, use arrows and Enter to open a
suggestion, submit an accessible ticket number, search a comment, change result ordering,
and try the options panel. Check recent-search clearing and the mobile options button.
Repeat internal-note searches as staff and as the requester. These manual UI checks are
separate from the database tests; passing the latter does not verify browser interaction.
