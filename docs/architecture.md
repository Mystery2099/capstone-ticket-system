# Architecture: Support Ticket Management System

**Course:** CISY 8503 Applied Database Management  
**Lab:** Open Source Database Lab  
**Status:** Current as of November 4, 2026  
**Project:** [Capstone Ticket System](https://github.com/Mystery2099/capstone-ticket-system)

## Introduction

The ticket system is one SvelteKit application that serves both desktop and mobile browsers. Its server routes and actions validate the session, the user's permissions, and the submitted input before touching PostgreSQL, and the browser never connects to the database directly. This document describes the layers of the application, what happens during a request, and how the main features are built: navigation, search, and formatted messages.

## 1. Layers

| Layer                                       | Responsibility                                     |
| ------------------------------------------- | -------------------------------------------------- |
| Svelte 5, Tailwind 4, shadcn-svelte/Bits UI | Responsive ticket workspace                        |
| Tiptap, markdown-it                         | Formatted messages                                 |
| SvelteKit server routes and actions         | Validation, authorization, workflows, transactions |
| Better Auth                                 | Passwords, sessions, MFA, and the auth tables      |
| Drizzle ORM and Drizzle Kit                 | Queries, schema, and tracked migrations            |
| PostgreSQL                                  | Persistence, constraints, and indexes              |

I wanted a single application rather than a separate API and front end, because it keeps database credentials and query logic in one server-side place. The [system architecture diagram](diagrams/system-architecture.mmd) shows these layers.

## 2. Request flow

On every request, the server loads the session, the account's current state, and its saved permissions. Because this happens each time, a disabled account or a stale session cannot keep access it should have lost. The action handling the request then checks that the user is allowed to perform it and validates the input.

When the request changes a ticket, the service writes the change and its audit event in one transaction, locking the ticket row while it does. Before returning anything, the server removes whatever the user is not allowed to see. Internal notes are filtered out at this stage, including from snippets, counts, search results, and activity, so they never reach a browser that should not have them. The [create ticket](diagrams/create-ticket-sequence.mmd), [internal note visibility](diagrams/internal-notes-visibility.mmd), and [status update transaction](diagrams/status-update-transaction.mmd) diagrams show these steps in more detail.

Ticket creation and replies use Superforms. A draft or reply survives a failed submission, so a validation error never costs the user what they typed, and a successful creation removes the saved draft. Metadata edits such as status or priority are applied optimistically in the interface while the server confirms them. Keyboard shortcuts are defined once in `src/lib/hotkeys.ts`, and pressing `?` lists them.

## 3. Navigation

I modeled the interface on an email client because I wanted the ticket system to feel familiar, especially to people who are less technically inclined. On desktop, the workspace has a sidebar, a ticket list, and an optional reading pane; phones show one main page at a time. Both layouts share the same routes and the same server-side permission checks. The workspace offers four views: My Tickets, Assigned to Me, Unassigned, and All Tickets.

| URL                       | Purpose                                          |
| ------------------------- | ------------------------------------------------ |
| `/login`                  | Sign in                                          |
| `/account-security`       | MFA enrollment and verification                  |
| `/app/tickets`            | Workspace; views and search use query parameters |
| `/app/tickets/new`        | New ticket                                       |
| `/app/tickets/[ticketId]` | Conversation and details                         |
| `/app/search/suggest`     | Authenticated search suggestions                 |
| `/app/inbox`              | Notifications; `?show=all` includes read ones    |
| `/app/settings`           | Theme, color palette, and account details        |
| `/app/admin/users`        | Account administration                           |
| `/app/admin/categories`   | Category administration                          |
| `/app/admin/roles`        | Role administration                              |
| `/health`                 | Application health check                         |

The [site map diagram](diagrams/site-map.mmd) shows how these pages connect.

## 4. Search

Search looks through subjects, descriptions, visible comments, categories, and the names of requesters and assignees. Subject matches rank highest and tolerate typos through PostgreSQL's `pg_trgm` extension. Words can appear in any order, and search supports prefixes, quoted phrases, and excluded words. Submitting `1046` or `#1046` opens that ticket directly if the user can access it; otherwise the number is treated as an ordinary search.

Suggestions appear after two characters and a 200 ms pause, and can be chosen with the arrow keys and Enter. Pressing `/` focuses the search box, Escape clears it, and recent searches are stored per account in the browser. The search options filter by status, priority, category, dates, and visible comments, and staff can also filter by requester and assignee. Results show highlighted excerpts and can be sorted by best match or newest first, 50 tickets to a page; newest-first pages with a ticket-number cursor, while relevance uses page numbers.

Every match, suggestion, and excerpt follows the user's ticket and internal-note permissions. Search is one of the easiest places for private content to leak, since an excerpt built from an internal note would reveal it even if the note never appeared on the page. The full-text document is therefore built at query time from only the content the user may see.

## 5. Formatted messages

Professor Enke asked for descriptions and replies to support formatting, so ticket descriptions, public replies, and internal notes use a restricted rich-text composer built on Tiptap. Users format text directly, the way they would in an email client, and never see Markdown syntax. Behind the scenes, the editor stores Markdown in the same text columns the application already used. The composer supports bold, italic, strikethrough, links, lists, quotes, inline code, code blocks, and one heading level; images, tables, attachments, and raw HTML are excluded, and pasted content is reduced to that set.

The code lives in `src/lib/ticket-content/`, with `TicketContentEditor.svelte` connecting the editor to drafts and form fields and `TicketContent.svelte` rendering saved, optimistic, and draft messages through the same renderer. Because messages are written by one user and read by another, rendering assumes the content could be hostile: it escapes HTML, never loads images, and only links to `http`, `https`, and `mailto` targets, opening them with `rel="noopener noreferrer nofollow"`. The renderer does not decide who can see a message; internal-note visibility is still enforced by the server's queries.

Migration `0005_right_marvex` adds a format column to tickets and comments. Rows that existed before it are marked `plain` and still display exactly as they were typed, while new rows default to `markdown`. The length limits of 4,000 characters for descriptions and 10,000 for replies apply to the stored Markdown.
