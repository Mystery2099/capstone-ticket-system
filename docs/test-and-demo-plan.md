# Tests and course demonstration

Run `pnpm lint`, `pnpm check`, `pnpm test`, and `pnpm build`.
`pnpm test:e2e` starts its own isolated browser-test server.

The optional HTTP scenario changes accounts and MFA settings. Run it only against
a disposable fixture server, never a personal or deployed database:

```sh
TEST_BASE_URL=http://localhost:5173 pnpm exec vitest run tests/http.test.ts
```

## Acceptance checks

| Area | Verify |
| --- | --- |
| Accounts | Sign-in/out, MFA enrollment, recovery-code single use, session revocation, disabled-account rejection |
| Creation | Ticket and event saved together; invalid fields and foreign keys rejected |
| Authorization | Requesters cannot access others' tickets, change priority, or submit internal notes |
| Staff workflow | Unassigned tickets visible; assignment rejects disabled or ineligible users; metadata edits audited |
| Conversation | Public replies visible; internal notes excluded from requester responses, previews, counts, activity, and search |
| Status | Requesters reopen own Resolved tickets; Closed is read-only until permitted reopening |
| Transactions | Failed event insertion rolls back its ticket change |
| Administration | Account, category, and role changes persist; unauthorized access rejected; last-admin protection holds |
| Search | Word order/forms, typos, comments/names, highlights, filters, number redirects, and permission boundaries |
| Recovery | Restore PostgreSQL into a separate database and verify relationships, records, and sign-in |

Manual browser checks: select a suggestion with arrows/Enter, submit a ticket
number, change sorting and filters, clear recent searches, and use mobile search.
Repeat internal-note searches with and without permission. Database tests alone do
not verify these interactions. Hosted PostgreSQL restore verification remains an
operational task; see the [backup drill](azure-deployment.md#hosted-acceptance-and-backup-drill).

## Live demonstration

1. As a requester, create a ticket.
2. As an agent, find it, assign it, add a public reply and internal note, then resolve it.
3. As the requester, confirm the reply is visible and the note is hidden; reopen it.
4. Inspect SQL joins across tickets, users, categories, and statuses; show chronological
   comments/events and counts grouped by status or category.
5. Demonstrate a rejected reference or unauthorized operation and transaction rollback.
6. Show backup/restore evidence from a separate database.

Use fictional data and individual accounts. For professor-requested changes, record
the request, affected schema/screens, migration or recovery plan, and verification
in the [change log](change-log.md).
