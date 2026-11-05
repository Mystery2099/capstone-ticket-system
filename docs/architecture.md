# Architecture: Support Ticket Management System

**Course:** CISY 8503 Applied Database Management  
**Lab:** Open Source Database Lab  
**Student:** Mathew Kennedy-Brewer  
**Status:** Current as of November 5, 2026  
**Project:** [Capstone Ticket System](https://github.com/Mystery2099/capstone-ticket-system)

## Introduction

The ticket system is one SvelteKit application that serves both desktop and mobile browsers. Its server routes and actions validate the session, the user's permissions, and the submitted input before reading or changing any ticket data, and the browser never connects to the database directly. This document describes the layers of the application, what happens during a request, how the main features are built (navigation, search, and formatted messages), how I would add file attachments, which I chose not to build, and other planned improvements.

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

On application requests, the server loads the session, the account's current state, and its saved permissions. Authentication endpoints under `/api/auth/` are handled separately by Better Auth. Because application permissions are reloaded each time, a disabled account or a stale session cannot keep access it should have lost. The action handling the request then checks that the user is allowed to perform it and validates the input.

When the request changes a ticket, the service writes the change and its audit event in one transaction, locking the ticket row while it does. Before returning anything, the server removes whatever the user is not allowed to see. Internal notes are filtered out at this stage, including from snippets, counts, search results, and activity, so they never reach a browser that should not have them. The [create ticket](diagrams/create-ticket-sequence.mmd), [internal note visibility](diagrams/internal-notes-visibility.mmd), and [status update transaction](diagrams/status-update-transaction.mmd) diagrams show these steps in more detail.

Ticket creation and replies use Superforms. A draft or reply survives a failed submission, so a validation error never costs the user what they typed, and a successful creation removes the saved draft. Metadata edits such as status or priority are applied optimistically in the interface while the server confirms them. Keyboard shortcuts are defined once in `src/lib/hotkeys.ts`, and pressing `?` lists them.

The ticket timeline mixes comments with the history of changes. When the same person makes several changes in a row, such as setting the status, priority, and assignee one after another, the timeline shows them as one entry instead of one line each. Changes are combined when they are less than 10 minutes apart and no comment comes between them. Only the display is combined: every change is still its own `ticket_event` row, written in the same transaction as the change. A friend testing the application pointed out that separate lines made phone users scroll too much, which is why I added this. The grouping lives in `ticket-activity-grouping.ts`, which has its own unit test.

## 3. Navigation

I modeled the interface on an email client because I wanted the ticket system to feel familiar, especially to people who are less technically inclined. On desktop, the workspace has a sidebar, a ticket list, and an optional reading pane; phones show one main page at a time. On a phone, the list's quick filters fold behind a single **Filters** button that shows how many filters are on, and open as a two-column grid. An earlier version kept them in one row that scrolled sideways, but it wasn't obvious that the row scrolled, and the labels were cut off. The phone's bottom bar holds Inbox, the personal views (My queue for staff, and My requests), and Settings, and the ticket views and categories open from the menu button, the way folders do in an email app. An earlier version put three of the views in the bottom bar, which crowded it, hid the rest of the views, and gave Inbox and All open the same icon. Both layouts share the same routes and the same server-side permission checks. The workspace offers four views: My requests, My queue, Unassigned, and All tickets.

| URL                           | Purpose                                                   |
| ----------------------------- | --------------------------------------------------------- |
| `/login`                      | Sign in                                                   |
| `/account-security`           | MFA enrollment and verification                           |
| `/app/tickets`                | Workspace; views and search use query parameters          |
| `/app/tickets/new`            | New ticket                                                |
| `/app/tickets/[ticketNumber]` | Conversation and details, using the numeric ticket number |
| `/app/search/suggest`         | Authenticated search suggestions                          |
| `/app/inbox`                  | Notifications; `?show=all` includes read ones             |
| `/app/settings`               | Theme, color palette, and account details                 |
| `/app/admin/users`            | Account administration                                    |
| `/app/admin/categories`       | Category administration                                   |
| `/app/admin/roles`            | Role administration                                       |
| `/health`                     | Application health check                                  |

The [site map diagram](diagrams/site-map.mmd) shows how these pages connect.

## 4. Search

Search looks through subjects, descriptions, visible comments, categories, and the names of requesters and assignees. Subject matches rank highest and tolerate typos through PostgreSQL's `pg_trgm` extension. Words can appear in any order, and search supports prefixes, quoted phrases, and excluded words. Submitting `1046` or `#1046` opens that ticket directly if the user can access it; otherwise the number is treated as an ordinary search.

Suggestions appear after two characters and a 200 ms pause, and can be chosen with the arrow keys and Enter. Pressing `/` focuses the search box, Escape clears it, and recent searches are stored per account in the browser. The search options filter by status, priority, category, dates, and visible comments, and staff can also filter by requester and assignee. Results show highlighted excerpts and can be sorted by best match or newest first, 50 tickets to a page; newest-first pages with a ticket-number cursor, while relevance uses page numbers.

Every match, suggestion, and excerpt follows the user's ticket and internal-note permissions. Search is one of the easiest places for private content to leak, since an excerpt built from an internal note would reveal it even if the note never appeared on the page. The full-text document is therefore built at query time from only the content the user may see.

## 5. Formatted messages

Professor Enke asked for descriptions and replies to support formatting, so ticket descriptions, public replies, and internal notes use a restricted rich-text composer built on Tiptap. Users format text directly, the way they would in an email client, and never see Markdown syntax. Behind the scenes, the editor stores Markdown in the same text columns the application already used. The composer supports bold, italic, strikethrough, links, lists, quotes, inline code, code blocks, and one heading level; images, tables, attachments, and raw HTML are excluded, and pasted content is reduced to that set.

The code lives in `src/lib/ticket-content/`, with `TicketContentEditor.svelte` connecting the editor to drafts and form fields and `TicketContent.svelte` rendering saved, optimistic, and draft messages through the same renderer. Because messages are written by one user and read by another, rendering assumes the content could be hostile: it escapes HTML, never loads images, and only links to `http`, `https`, and `mailto` targets, opening them with `rel="noopener noreferrer nofollow"`. The renderer does not decide who can see a message; internal-note visibility is still enforced by the server's queries.

Migration `0005_right_marvex` adds a format column to tickets and comments. Rows that existed before it are marked `plain` and still display exactly as they were typed, while new rows default to `markdown`. The length limits of 4,000 characters for descriptions and 10,000 for replies apply to the stored Markdown.

## 6. File attachments (planned, not built)

Screenshots and log files are some of the most useful things a requester can give a support team, and Professor Enke has said he would like the ticket system to accept them. I decided not to build attachments for this project. Doing them properly means adding a second place where data lives, with its own access rules, backups, and attack surface, and I did not have enough time left to build and test that to the same standard as the rest of the application. A rushed version would have been the easiest way to leak a private file or let a malicious one through.

This section records how I would add attachments to a production version of the system. It covers where the files would be stored, how they would be tied to the existing tables, how uploads and downloads would be checked, and what would change in the backup and recovery plan.

### 6.1 Where the files would live

I would store the files themselves in a private Azure Blob Storage container and keep only their metadata in PostgreSQL. I considered and rejected two simpler options:

| Option                            | Why I would not use it                                                                                                                                                                                  |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bytea` columns in PostgreSQL     | Every backup, dump, and restore drill would grow with every screenshot. The database tier is the most expensive part of the hosting, and large binary rows slow down queries that never need the files. |
| The App Service's own disk        | The application is designed to keep no data on its host, so that losing the host only means redeploying. Files on disk would break that, and the free F1 tier only has 1 GB of storage.                 |
| **Private Blob Storage (chosen)** | Cheap per gigabyte, never public, has its own soft delete and versioning, and the App Service can reach it through a managed identity without storing a key anywhere.                                   |

The container would have public access disabled at the storage-account level, so a misconfigured container still could not be read anonymously. The App Service would authenticate with its managed identity and the `Storage Blob Data Contributor` role scoped to that one container, which follows the same rule as the database: the web application gets only the access it needs and no stored password.

### 6.2 Database changes

A new migration would add one table, written through Drizzle like the others:

| Column              | Type          | Notes                                                                                             |
| ------------------- | ------------- | ------------------------------------------------------------------------------------------------- |
| `id`                | `uuid`        | Primary key, also used as the blob name, so the original filename is never part of a storage path |
| `ticket_id`         | `uuid`        | Foreign key to `ticket`, required                                                                 |
| `comment_id`        | `uuid`        | Foreign key to `ticket_comment`; null when attached to the description                            |
| `uploaded_by_id`    | `text`        | Foreign key to `user`                                                                             |
| `original_filename` | `text`        | Display only, length-limited and cleaned of path characters                                       |
| `content_type`      | `text`        | Detected by the server, checked against an allowed list                                           |
| `size_bytes`        | `integer`     | Check constraint enforcing the maximum size                                                       |
| `sha256`            | `text`        | Lets a restore confirm the blob and the row still match                                           |
| `scan_status`       | `text`        | `pending`, `clean`, or `rejected`, enforced by a check constraint                                 |
| `created_at`        | `timestamptz` | Defaults to now                                                                                   |
| `deleted_at`        | `timestamptz` | Soft delete, so history keeps a record that a file existed                                        |

The most important rule is that **an attachment inherits the visibility of whatever it is attached to**. A file attached to an internal note is as private as the note itself. Because the row points at the comment, the existing internal-note filtering can be reused instead of building a second permission system. Uploading and removing an attachment would each write a `ticket_event` row in the same transaction, matching how every other ticket change is recorded, and `scripts/runtime-grants.sql` would give the runtime role only `SELECT`, `INSERT`, and an `UPDATE` limited to `scan_status` and `deleted_at`.

### 6.3 Uploading

Uploads would go through a SvelteKit form action like replies do, so the existing session check, capability check, and write rate limit apply automatically. The server would then:

1. Reject anything over 10 MB per file or more than five files per message.
2. Detect the real file type from its contents rather than trusting the filename or the browser's `Content-Type`, and only allow PNG, JPEG, WebP, PDF, and plain-text logs. SVG and HTML would never be allowed, because both can carry scripts.
3. Re-encode images, which strips location and camera metadata from phone photos and removes anything hidden after the image data.
4. Write the blob under its generated id, then insert the row and its `ticket_event` in one transaction. If the transaction fails, the blob is deleted; a scheduled job would also remove any blob older than a day that has no row, in case the cleanup itself fails.
5. Mark the file `pending` until Microsoft Defender for Storage's malware scan reports a result. Pending and rejected files would show to staff as unavailable and would never be served.

Attachments would sit under the message, not inside it. The rich-text renderer would keep its current rule of never loading images, so formatted messages stay as safe as they are now.

### 6.4 Downloading

The browser would never receive a permanent storage URL. Every download would go through a server route such as `/app/tickets/[ticketId]/attachments/[attachmentId]` that loads the attachment, its ticket, and its comment and runs the same visibility check used to show the ticket. Only then would the server either stream the file or redirect to a user-delegation SAS link that expires within a few minutes and is signed by the managed identity rather than an account key.

Responses would carry `Content-Disposition: attachment` for anything other than the allowed image types, `X-Content-Type-Options: nosniff`, and a sandboxing Content Security Policy, so even a file that slipped past the checks could not run as a page on the application's origin. Thumbnails would be served through the same route, and the CSP's `img-src` would only be widened to that route, not to the storage account.

### 6.5 Backups and recovery

This is the largest change to the [security and data recovery plan](security-and-recovery-plan.md). A `pg_dump` would no longer be a complete backup, because it holds the metadata but not the files. I would turn on blob soft delete and versioning with the same retention as the database's point-in-time restore, and copy the container to a second storage account on the same weekly schedule as the logical dump.

Restoring would then have two parts that have to agree. After restoring the database, I would check every non-deleted `ticket_attachment` row for a blob with a matching `sha256`, and list any row without a blob or any blob without a row. The restore drill in the security plan would gain that check alongside its row counts. If tickets or accounts are ever purged for retention reasons, the purge would also have to remove their blobs, because otherwise the files would outlive the records that controlled who could see them.

### 6.6 Testing

The tests I would add follow the same priorities as the rest of the project: a requester cannot download another requester's attachment or an attachment on an internal note by guessing its id, a disabled account loses access immediately, renamed or oversized files are rejected, a failed transaction leaves no orphaned blob, and a restore reports a missing blob instead of silently showing a broken file.

### 6.7 Cost

For a small support team, storage would cost very little. A few gigabytes of hot-tier blob storage, its versions, and a weekly copy should stay under a few dollars a month. Defender for Storage is billed per storage account and per gigabyte scanned, so it would be the largest new cost and is the part I would confirm against the subscription before turning it on.

## 7. Other planned improvements

Two smaller timeline changes are planned but not built.

**Showing how a description changed.** A subject edit already shows the old and new subject. A description edit only records that it happened, because the event deliberately does not keep a copy of a long message. To show the changes, I would store the old and new text in the event and add a collapsed "Show changes" link that highlights removed and added words. That has a cost: `ticket_event` cannot be edited, so if someone edits a description to remove something sensitive, such as a pasted password, the old text would be kept for good. I would therefore add a "remove sensitive text" option to the edit, which skips saving the old version and records only that sensitive information was removed. Edits made before the change would keep showing only that the description was edited.

**A separate activity view.** A toggle on the timeline, such as **Comments | Everything**, would hide the change history for people who only want the conversation. Combining consecutive changes already solved most of the scrolling problem, so I would only add this if the timeline still feels too long in practice.
