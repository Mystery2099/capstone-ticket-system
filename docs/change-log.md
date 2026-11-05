# Change Log: Support Ticket Management System

**Course:** CISY 8503 Applied Database Management  
**Lab:** Open Source Database Lab  
**Student:** Mathew Kennedy-Brewer  
**Status:** Current as of November 4, 2026  
**Project:** [Capstone Ticket System](https://github.com/Mystery2099/capstone-ticket-system)

## Introduction

This log records how the ticket system has changed since the original proposal, newest first. For each change I note what the expected behavior is, which parts of the schema, interface, or permissions it affects, any migration or recovery step it needs, and how it was verified. Changes that Professor Enke requested are marked as such.

## November 4, 2026: Demonstration passwords and hosted checks

Seven demonstration accounts on the live site still used the password written into the public browser tests, including an agent account that can read internal notes. I checked every hosted password hash against that password offline, then reset only the seven that matched with `pnpm account:recover`, which also signed those accounts out and wrote an audit event for each. The new passwords are stored outside the repository. I also ran the acceptance checks and a restore drill against the hosted system, as recorded in the [test and demonstration plan](test-and-demo-plan.md) and the [security and data recovery plan](security-and-recovery-plan.md). No schema changes were involved.

## November 4, 2026: Search suggestion fix, accessibility, and mobile navigation

A review found that search suggestions ignored the requester filter for anyone who could read internal notes, so a custom role with note access but without permission to see all tickets could see subjects from other requesters' tickets. Suggestions now follow the same ticket visibility rule as the ticket list, and a workflow test fails if that regresses. CI now also runs lint.

I also improved screen reader support by marking the current page in the navigation and ticket list, adding a skip link to the main content, and naming each dropdown after its field and current value. On phones, tapping outside the navigation now closes it on the first tap; a tooltip that opened with the navigation had been absorbing that tap, so tooltips are now turned off on touch screens. The filter dropdowns on phones sit in one row that scrolls sideways instead of taking up three rows. None of these changes need a migration.

## November 4, 2026: Interface polish and classic palette

Settings now has a Colors option that offers a plain, classic palette alongside the default one, and the choice is applied before the page first paints so there is no flash of the wrong colors. I also added hover and open-state feedback across the sidebar, search, menus, and composer, gave every checkbox the same style, and made the account menu and search options close when someone clicks outside them. These changes only affect the interface; no migration is needed.

## November 4, 2026: Inbox and notifications

Comments, assignments, and Resolved, Closed, or reopened status changes now create inbox notifications for the people involved. Anyone writing a comment can choose who to notify from the people connected to the ticket, and staff can also follow a ticket when they comment. Internal notes only notify people who are allowed to read them. Migration `0007_ticket_notifications` adds the follower and notification tables and makes existing requesters, assignees, and commenters followers of their tickets. The runtime grants in `scripts/runtime-grants.sql` need to be reapplied afterward. A workflow test checks that notifications reach only followers and chosen people and respect note privacy.

## November 4, 2026: Ticket layout and editing

The ticket description now has its own section above the conversation instead of appearing as the first comment, which makes it easier for an agent to see what a ticket is about at a glance. Staff can also edit a ticket's subject and description in place, and each edit appears in the timeline. Migration `0006_grant_edit_ticket_content` grants the new capability to the built-in Agent and Administrator roles, and a workflow test checks that requesters cannot use it.

## November 3, 2026: Formatted messages and shortcuts

Requested by Professor Enke. Descriptions, replies, and internal notes support rich-text formatting without showing Markdown to the user. Migration `0005_right_marvex` records each message's format so that older text still displays exactly as it was typed. The details are in [architecture](architecture.md). I also added a keyboard shortcuts dialog, opened with `?`.

## November 2, 2026: Search and saved roles

Search became ranked, with full-text and prefix matching, typo tolerance on subjects, highlighted snippets, ticket-number navigation, suggestions, filters, and sorting. Migration `0003_search_subject_trigram` adds the subject index, and Azure has to allow-list `PG_TRGM` before it can run. Search is described in [architecture](architecture.md). Roles moved into the database with editable capabilities through migration `0004_lonely_felicia_hardy`, as described in [roles and permissions](roles-and-permissions.md).

## October 30, 2026: Initial proposal

The original proposal defined the Requester, Agent, and Administrator roles, one assignee per ticket, and categories, statuses, comments, and event history.
