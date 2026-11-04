# Change log

Record professor-requested changes with the date, expected behavior, affected
schema/UI/permissions, migration or recovery plan, and verification.

## 2026-11-04 — Inbox and notifications

Comments, assignments, and Resolved/Closed/reopened status changes create inbox
notifications for the people involved. Anyone commenting can choose who to notify
from the people connected to the ticket; staff can also follow a ticket when they
comment. Internal notes only reach people who may read them. `0007_ticket_notifications`
adds the tables and makes existing requesters, assignees, and commenters followers;
reapply `scripts/runtime-grants.sql` afterward.

## 2026-11-04 — Ticket layout and editing

The description now has its own section above the conversation. Staff can edit a
ticket's subject and description in place; each edit appears in the timeline.
`0006_grant_edit_ticket_content` grants the new capability to the built-in roles.

## 2026-11-03 — Formatted messages and shortcuts

Professor-requested: descriptions, replies, and notes support rich-text formatting
without visible Markdown. `0005_right_marvex` records each message's format so
older text displays unchanged. See [formatted messages](formatted-messages.md).
Also added a keyboard shortcuts dialog (`?`).

## 2026-11-02 — Search and saved roles

Ranked full-text/prefix search, subject typo matching, highlighted snippets,
ticket-number navigation, suggestions, filters, and sorting
(`0003_search_subject_trigram`; Azure must allow-list `PG_TRGM`). See [search](search.md).
Roles moved into the database with editable capabilities
(`0004_lonely_felicia_hardy`). See [permissions](permissions.md).

## 2026-10-30 — Initial proposal

Requester, agent, and administrator roles; one assignee per ticket; categories,
statuses, comments, and event history.
