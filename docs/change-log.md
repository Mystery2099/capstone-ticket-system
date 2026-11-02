# Requirements Change Log

## Baseline v0.1 — Initial proposal

**Date:** 2026-10-30  
**Status:** Proposed, not yet demonstrated or reviewed  
**Scope:** Generic ticketing system, requester/agent/admin roles, one assigned agent per ticket, categories, statuses, comments, and event history.

## Template for new professor-requested changes

- **Change ID / date:**
- **Requested by / exact request:**
- **Initial behavior:**
- **New expected behavior:**
- **Impact on schema/API/UI/security:**
- **Migration plan / data compatibility:**
- **Tests and evidence:**
- **Status / approval:**

## Search improvements — 2026-11-02

Implemented ranked full-text/prefix search across ticket content, names and categories,
subject typo matching, highlighted snippets, ticket-number navigation, live suggestions,
keyboard selection, per-account browser recent searches, expanded filters, and result
sorting. Requester ownership and internal-note visibility apply throughout search.
Migration `0003_search_subject_trigram` adds `pg_trgm` and its subject index; Azure must
allow-list the extension before migration. No external search service or search column.

Verification includes type checks, lint, production build, and database tests for
matching, redirects, suggestions, and permissions. Browser interaction checks remain
part of the manual acceptance plan.
