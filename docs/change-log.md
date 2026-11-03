# Change log

Record professor-requested changes with the date, expected behavior, affected
schema/UI/permissions, migration or recovery plan, and verification.

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
