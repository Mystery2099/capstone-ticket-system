# Ticket search

Search covers subjects, descriptions, visible comments, categories, and requester
and assignee names. Subject matches rank highest and support typo matching.
Words can appear in any order; prefixes, quoted phrases, and exclusions are supported.
Submit `1046` or `#1046` to open an accessible ticket directly. Unavailable numbers
fall back to search.

Suggestions appear after two characters and a 200 ms pause. Use arrows and Enter
to select, Enter without a selection for full results, `/` to focus, and Escape
to clear. Recent searches are stored per account in the browser and can be cleared.

Options filter status, priority, category, dates, and visible comments; staff can
also filter requester and assignee. Submitted searches include all statuses unless
filtered. Results show highlighted excerpts and matching name/category labels,
with best-match or newest-first sorting. Pages contain up to 50 tickets;
newest-first uses a ticket-number cursor, relevance uses page numbers.

All matches, suggestions, and excerpts follow the user's ticket and internal-note
permissions. See [database design](database-design.md) for indexing and
[operations](azure-deployment.md) for the Azure extension prerequisite.
