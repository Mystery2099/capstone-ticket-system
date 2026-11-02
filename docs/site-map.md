# Capstone Ticket System: Site Map and Navigation

**Status:** Implemented workspace routes and search behavior; design discussion below explains the layout.

## How the pages fit together

The application doesn't need a separate page for every ticket list. I want the same ticket workspace to handle My Tickets, Assigned to Me, Unassigned, and All Tickets, with a filter determining which records are shown. On desktop, opening a ticket can display its conversation alongside the list; on mobile, the same ticket route can show a full-screen detail view instead. This should keep the app easier to navigate without adding unnecessary routing complexity.

[View Mermaid diagram](diagrams/site-map.mmd)

The boxes marked as views, filters, and actions do not need their own routes. Access to a route is not the same as permission to read every record at that route; the server still checks who is signed in and what they're allowed to see.

## URL structure

```text
/login
/app/tickets                       list workspace; view/search in query parameters
/app/tickets/new                   new ticket form
/app/tickets/[ticketId]            ticket conversation and details
/app/search/suggest                authenticated live ticket suggestions
/app/settings                      appearance and settings
/account-security                  MFA enrollment and verification
/app/admin/users                   administrator only
/app/admin/categories              administrator only
```

I would have `/` redirect to the sign-in screen or an appropriate ticket view based on the session. We don't need a separate dashboard unless the professor specifically asks for one. Search uses a text field with live ticket/people suggestions, keyboard selection, recent searches, and an options panel. See [search behavior](../README.md#ticket-search).

## Roles and navigation

| Area                             | Requester              | Agent              | Administrator      |
| -------------------------------- | ---------------------- | ------------------ | ------------------ |
| My Tickets                       | Yes                    | Yes                | Yes                |
| Assigned to Me                   | No                     | Yes                | Yes                |
| Unassigned / All Tickets         | No                     | Yes                | Yes                |
| Create Ticket                    | Yes                    | Yes                | Yes                |
| Ticket conversation              | Own tickets            | All tickets        | All tickets        |
| Public reply                     | Own accessible tickets | Accessible tickets | Accessible tickets |
| Internal note                    | No                     | Yes                | Yes                |
| User and category administration | No                     | No                 | Yes                |

An administrator may create tickets, so My Tickets still makes sense for that role. We should avoid placing agent-only destinations in the requester's navigation, although hiding them must never replace the server-side authorization checks.

## Desktop and mobile behavior

Desktop uses the sidebar, list, and optional ticket reading pane that we've already designed. Narrower screens can collapse the sidebar into a rail, while phones show one primary page at a time and use the mobile navigation from Claude's handoff. Those are different presentations of the same routes and permissions, not separate applications.

For ticket details, I'd keep the reply and internal-note actions obvious on mobile and make sure the private-note mode looks different from public replies. Requesters should only get a Reopen action when the ticket belongs to them and is Resolved. We shouldn't add new mobile-only capabilities merely because a mockup has space for them.
