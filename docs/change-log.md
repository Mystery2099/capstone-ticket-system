# Change log

## 2026-11-02 — Search

Added ranked full-text/prefix search, subject typo matching, highlighted snippets,
ticket-number navigation, suggestions, keyboard selection, recent searches,
filters, and sorting. Permission checks cover matching and excerpts.
`0003_search_subject_trigram` adds the subject index and requires Azure to allow-list
`PG_TRGM`. See [search](search.md) and the [test plan](test-and-demo-plan.md).

## 2026-10-30 — Initial proposal

Requester, agent, and administrator roles; one assignee per ticket; categories,
statuses, comments, and event history.

## Professor-requested changes

Record the date/request, expected behavior, affected schema/UI/permissions,
migration or recovery plan, verification evidence, and approval status.
