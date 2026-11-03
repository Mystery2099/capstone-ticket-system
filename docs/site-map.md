# Navigation

Desktop uses a sidebar, ticket list, and optional reading pane. Phones show one
primary page at a time. Both layouts share routes and server permissions.

| URL                       | Purpose                                          |
| ------------------------- | ------------------------------------------------ |
| `/login`                  | Sign in                                          |
| `/account-security`       | MFA enrollment and verification                  |
| `/app/tickets`            | Workspace; views and search use query parameters |
| `/app/tickets/new`        | New ticket                                       |
| `/app/tickets/[ticketId]` | Conversation and details                         |
| `/app/search/suggest`     | Authenticated search suggestions                 |
| `/app/settings`           | Theme and account details                        |
| `/app/admin/users`        | Account administration                           |
| `/app/admin/categories`   | Category administration                          |
| `/app/admin/roles`        | Role administration                              |
| `/health`                 | Application health check                         |

My Tickets, Assigned to Me, Unassigned, and All Tickets are workspace views.
Press `?` (or use the account menu) for keyboard shortcuts.
Navigation follows saved capabilities; hiding a destination never replaces server
checks. See [permissions](permissions.md), [search](search.md), and the
[site map diagram](diagrams/site-map.mmd).
