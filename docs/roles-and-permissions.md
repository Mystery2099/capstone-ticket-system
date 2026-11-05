# Roles and Permissions: Support Ticket Management System

**Course:** CISY 8503 Applied Database Management  
**Lab:** Open Source Database Lab  
**Student:** Mathew Kennedy-Brewer  
**Status:** Current as of November 4, 2026  
**Project:** [Capstone Ticket System](https://github.com/Mystery2099/capstone-ticket-system)

## Introduction

This document describes what each role can do, how a ticket moves through its lifecycle, and how the server enforces both. The original design centered on three fixed roles: Requester, Agent, and Administrator. The current implementation stores roles in the database, so administrators can create custom roles and choose exactly which capabilities each receives. The table in section 1 therefore shows the defaults rather than fixed rules, and the server always checks the capabilities a role has been granted, never its name.

## 1. Built-in roles

| Action                                      | Requester | Agent | Administrator |
| ------------------------------------------- | --------- | ----- | ------------- |
| See own tickets                             | Yes       | Yes   | Yes           |
| See all tickets                             | No        | Yes   | Yes           |
| Create ticket                               | Yes       | Yes   | Yes           |
| Create ticket for another requester         | No        | Yes   | Yes           |
| Assign ticket while creating it             | No        | Yes   | Yes           |
| Public comment on accessible, active ticket | Yes       | Yes   | Yes           |
| Read and write internal notes               | No        | Yes   | Yes           |
| Assign ticket or change status or category  | No        | Yes   | Yes           |
| Change priority (Low, Normal, High)         | No        | Yes   | Yes           |
| Edit subject and description                | No        | Yes   | Yes           |
| Reopen own Resolved ticket                  | Yes       | Yes   | Yes           |
| Reopen Closed ticket                        | No        | No    | Yes           |
| Manage users, categories, and roles         | No        | No    | Yes           |

The built-in Administrator role includes every agent permission. Agents see all tickets, including unassigned ones, so new requests do not wait for someone to notice them. A requester's tickets are always created at Normal priority, and the server rejects a request that tries to set a different priority or name a different requester, even if someone builds that request by hand. Every signed-in user can create their own tickets and reply publicly on accessible tickets that are not Closed, regardless of role.

## 2. Ticket lifecycle

Assignment eligibility is capability-based, not restricted to the built-in role names: an enabled account needs both `receiveAssignments` and `viewAllTickets`. A custom role with both grants can receive assignments too.

A ticket moves through five statuses: Open, In Progress, On Hold, Resolved, and Closed. New tickets start as Open, and a user without the `setTicketStatus` capability can only create them that way. Setting Resolved or Closed also records the matching timestamp. There is no automatic closure, so a ticket only reaches Closed when someone deliberately closes it.

For any non-Closed ticket, `setTicketStatus` permits changing to any of the other four statuses; there is no required progression through In Progress or Resolved. Staff with this grant can also choose the initial status during creation. Leaving Resolved or Closed clears its corresponding timestamp, so those columns describe the current state, not a permanent history of earlier resolutions or closures.

Resolved and Closed mean different things. A requester can reopen their own Resolved ticket if the problem turns out not to be fixed. Closed is read-only, with no new replies or edits, until someone with the `reopenClosedTickets` capability reopens it to Open; by default, only administrators have that capability. This keeps ordinary users from silently undoing a decision the support team has made. The [ticket lifecycle diagram](diagrams/ticket-lifecycle.mmd) shows the allowed transitions.

`editTicketContent` lets staff rewrite a ticket's subject or description in place, except on Closed tickets. A subject edit records the old and new subject in the timeline, while a description edit only records that the text changed. Every ticket change and its matching history entry belong to one database transaction, so the history always reflects what actually changed.

## 3. Public comments and internal notes

Public comments and internal notes appear in the same ticket conversation, but they have different visibility. Public comments are shared with the requester and support staff, while internal notes are limited to staff with note access. Seeing a ticket and reading its notes are separate capabilities, so a custom role can be given one without the other.

Requester-facing pages, list previews, search results, counts, notifications, and history must never include the content of an internal note. The server enforces that in its queries rather than in the interface, so hiding the notes on the page is not what protects them. The [internal note visibility diagram](diagrams/internal-notes-visibility.mmd) shows where that filtering happens.

## 4. Managing roles

Administrators manage roles at **Administration → Roles**. Migrations seed the Requester, Agent, and Administrator roles, and from there roles can be created, copied, renamed, and given capabilities. Account forms list whichever roles are currently saved.

The Administrator role cannot be renamed, edited, or deleted, and its administration capability cannot be granted to a custom role. Without those protections, an administrator could accidentally remove everyone's ability to manage accounts. Deleting a role that still has users requires choosing a replacement role that is not Administrator. The reassignment, revocation of those users' sessions, the deletion itself, and its audit event all commit in one transaction, and reassigned users simply sign in again.

## 5. How permissions are enforced

The `application_role` table stores a stable ID, a display name, and an array of permissions for each role. Renaming a role never changes its ID, and assigning or deleting a role locks the role's row so two administrators cannot make conflicting changes at the same time. The available capabilities, their labels, and the built-in defaults are defined in `src/lib/permissions.ts`.

`hooks.server.ts` loads the current user's grants on every request, and both the interface and the server call `hasPermission(user, permission)` with that loaded user. There is no global cache, so a change to a role applies on the user's next request. If a user's grants cannot be loaded, every permission check fails closed and denies access. The navigation only shows destinations a user's capabilities allow, but that is a convenience; the server checks every request regardless.

## Conclusion

Custom roles make the system more flexible, but they also add permission combinations that need testing. The browser tests include creating a custom role and signing in with it, and the workflow tests check that unknown roles are denied and that reassignment happens atomically.
