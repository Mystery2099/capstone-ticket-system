# Screen Gallery: Support Ticket Management System

**Course:** CISY 8503 Applied Database Management  
**Lab:** Open Source Database Lab  
**Student:** Mathew Kennedy-Brewer  
**Status:** Current as of November 5, 2026  
**Project:** [Capstone Ticket System](https://github.com/Mystery2099/capstone-ticket-system)  
**Prepared by:** Claude Opus 5.5 (Anthropic's AI assistant, running in Claude Code), at my request. I also told it to replicate the writing style used in the rest of the documentation.

## Introduction

This page shows every screen in the application, so the whole system can be reviewed without signing in or clicking through it. The screens are grouped by who sees them: a requester, an agent, and an administrator. Each group follows the order someone would normally use them in. The last section has mockups of screens I would add for a production version, covering file attachments, single sign-on, and MFA for every account.

Claude Opus, an AI assistant, made this gallery for me, including the screenshots, the mockups, and this page's text. It captured the screenshots on November 5, 2026 with a script it wrote to drive the real application in a browser. It ran against a disposable local database loaded with the same fictional accounts and tickets the automated tests use, so no real data appears and the hosted database was never touched. The authenticator QR code, setup key, and recovery codes are blurred. Desktop screenshots are 1440 × 900, and phone screenshots are 390 × 844, the size of a typical phone.

| Account      | Role          | Used for                                 |
| ------------ | ------------- | ---------------------------------------- |
| Marcus Lee   | Requester     | Submitting and following his own tickets |
| Rosa Delgado | Requester     | Reopening a resolved ticket              |
| Priya Raman  | Agent         | Working the queue and writing notes      |
| Jordan Ellis | Administrator | MFA, accounts, categories, and roles     |

## 1. Signing in

There is no public sign-up. Accounts are created by an administrator. A failed sign-in gives the same message whether the email or the password was wrong, so the page does not reveal which accounts exist.

![Sign-in page](screenshots/app/desktop/01-sign-in.png)

![Sign-in page after a wrong password](screenshots/app/desktop/02-sign-in-wrong-password.png)

## 2. Requester screens

A requester only sees their own tickets, an inbox, and drafts. They have no staff views and cannot change a ticket's status, priority, or assignee.

**My requests.** The ticket list shows status, number, and the latest reply. The empty pane on the right is where a ticket opens.

![Requester ticket list](screenshots/app/desktop/03-requester-my-tickets.png)

**A ticket conversation.** The description sits above the comments and activity. Internal notes are removed on the server, so the requester's browser never receives them.

![Requester view of a ticket](screenshots/app/desktop/04-requester-ticket-conversation.png)

**New ticket.** The rich-text editor formats text without showing Markdown.

![New ticket form for a requester](screenshots/app/desktop/05-requester-new-ticket.png)

**Drafts.** Unsent tickets are saved, so closing the form never loses work.

![Saved drafts](screenshots/app/desktop/06-requester-drafts.png)

**Inbox.** Notifications about replies and status changes on the requester's own tickets.

![Requester inbox](screenshots/app/desktop/09-requester-inbox.png)

**Reopening a resolved ticket.** A requester can reopen their own ticket while it is Resolved. Only an administrator can reopen a Closed ticket.

![Resolved ticket with the reopen button](screenshots/app/desktop/10-requester-resolved-ticket-reopen.png)

**Blocked access.** Opening another requester's ticket by its address returns "not found", so the page does not even confirm that the ticket exists. Opening an administration page returns "access denied".

![Another requester's ticket returns not found](screenshots/app/desktop/07-requester-other-ticket-blocked.png)

![Administration page returns access denied](screenshots/app/desktop/08-requester-admin-blocked.png)

## 3. Agent screens

An agent sees every ticket and works through queue views, a category breakdown, and internal notes.

**Queue views.** My queue, Unassigned, All open (with counts for each category), and All tickets.

![My queue](screenshots/app/desktop/11-agent-assigned-to-me.png)

![Unassigned tickets](screenshots/app/desktop/12-agent-unassigned.png)

![All open tickets](screenshots/app/desktop/13-agent-open.png)

![All tickets](screenshots/app/desktop/14-agent-all-tickets.png)

**A ticket with an internal note.** Notes are highlighted and labeled as visible only to the support team.

![Ticket with an internal note](screenshots/app/desktop/15-agent-ticket-with-internal-note.png)

**Writing an internal note.** The composer switches between a public comment and a private note.

![Internal note composer](screenshots/app/desktop/16-agent-internal-note-composer.png)

**Choosing who is notified.** A comment notifies the ticket's followers by default. "Change" lets the agent pick people by hand.

![Choosing who a comment notifies](screenshots/app/desktop/20-agent-choose-who-is-notified.png)

**Changing ticket details.** Status, priority, assignee, and category are each changed from a picker.

![Status picker](screenshots/app/desktop/17-agent-status-picker.png)

**Changes made in a row share one timeline entry.** Here the status, priority, and assignee were changed one after another, so the timeline shows one entry instead of three. Each change is still recorded separately in the database.

![Three changes shown as one timeline entry](screenshots/app/desktop/49-changes-in-a-row-combined.png)

**Editing the subject and description.** Each edit is recorded in the ticket's history.

![Editing the subject](screenshots/app/desktop/18-agent-edit-subject.png)

![Editing the description](screenshots/app/desktop/19-agent-edit-description.png)

**Opening a ticket for someone else.** Staff can set the requester, assignee, priority, and status while creating a ticket.

![New ticket form for an agent](screenshots/app/desktop/26-agent-new-ticket-for-someone-else.png)

**Agent inbox.**

![Agent inbox](screenshots/app/desktop/27-agent-inbox.png)

## 4. Search and navigation

**List filters.** Every list can be filtered by status, priority, and category, and staff can also filter by requester and assignee.

![Status filter on the ticket list](screenshots/app/desktop/21-list-status-filter.png)

**Search suggestions** appear while typing, and **search results** highlight the matching words. Results only include what the user is allowed to see.

![Search suggestions](screenshots/app/desktop/23-search-suggestions.png)

![Search results](screenshots/app/desktop/24-search-results.png)

**Search options** filter by dates, people, and whether a ticket has comments.

![Search options](screenshots/app/desktop/22-search-options.png)

**Keyboard shortcuts**, **account menu**, and **settings** (theme, color palette, and the signed-in account).

![Keyboard shortcuts](screenshots/app/desktop/25-keyboard-shortcuts.png)

![Account menu](screenshots/app/desktop/30-account-menu.png)

![Settings](screenshots/app/desktop/28-settings.png)

**Unknown page.**

![Page not found](screenshots/app/desktop/29-not-found.png)

## 5. Administrator sign-in and MFA

An administrator can't use the workspace until they set up an authenticator app. After that, every sign-in asks for a code, or for a single-use recovery code if the authenticator is lost.

**Setup starts by confirming the password.**

![MFA setup asks for the password](screenshots/app/desktop/31-mfa-required-start.png)

**Connecting the authenticator and saving recovery codes.** The QR code and codes are blurred in this screenshot.

![MFA setup with QR code and recovery codes, blurred](screenshots/app/desktop/32-mfa-setup-qr-and-recovery-codes.png)

**Later sign-ins** ask for a code. The second screenshot shows the recovery-code option.

![Verify sign-in with an authenticator code](screenshots/app/desktop/33-mfa-sign-in-code.png)

![Verify sign-in with a recovery code](screenshots/app/desktop/34-mfa-sign-in-recovery-code.png)

## 6. Administration

Administrators get an Administration section in the sidebar for users, categories, and roles.

![Administrator workspace](screenshots/app/desktop/35-admin-workspace.png)

**Users.** The list can be filtered by role and by whether the account is enabled. Disabling an account signs that person out immediately but keeps their tickets and comments.

![User list](screenshots/app/desktop/36-admin-users.png)

![Filtering users by account state](screenshots/app/desktop/45-admin-users-state-filter.png)

![Editing a user](screenshots/app/desktop/37-admin-edit-user.png)

![Disabling an account](screenshots/app/desktop/46-admin-disable-account-picker.png)

![Adding a user](screenshots/app/desktop/38-admin-new-user.png)

**Categories.** An inactive category stays on existing tickets but can't be chosen for new ones.

![Category list](screenshots/app/desktop/39-admin-categories.png)

![Editing a category](screenshots/app/desktop/47-admin-edit-category.png)

![Adding a category](screenshots/app/desktop/40-admin-new-category.png)

**Roles.** Each role is a set of permissions. The Administrator role is protected. A role that still has users can only be deleted after choosing a role to move them to.

![Role list](screenshots/app/desktop/41-admin-roles.png)

![Editing a role's permissions](screenshots/app/desktop/42-admin-edit-role.png)

![Adding a role](screenshots/app/desktop/43-admin-new-role.png)

![Deleting a role requires choosing a replacement](screenshots/app/desktop/48-admin-delete-role-needs-reassignment.png)

**A closed ticket** is read-only, and only an administrator can reopen it.

![Closed ticket with the reopen button](screenshots/app/desktop/44-admin-closed-ticket.png)

## 7. Dark theme

The application follows the device's light or dark setting unless the user picks one in Settings.

![Sign-in, dark](screenshots/app/desktop-dark/01-sign-in.png)

![Sign-in error, dark](screenshots/app/desktop-dark/02-sign-in-wrong-password.png)

![All tickets, dark](screenshots/app/desktop-dark/03-workspace-all-tickets.png)

![Ticket, dark](screenshots/app/desktop-dark/04-ticket-staff-view.png)

![Settings, dark](screenshots/app/desktop-dark/05-settings.png)

## 8. Phone layout

On a phone the same pages show one at a time. A bottom bar with Inbox, Tickets, and Settings replaces the sidebar, the ticket views sit in a row of chips above the list, and ticket details fold away until needed. The list filters sit behind a **Filters** button, which shows how many filters are on.

| Sign in                                           | Requester list                                                        | Requester ticket                                                    | New ticket                                                        |
| ------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------- |
| ![Sign in](screenshots/app/mobile/01-sign-in.png) | ![Requester list](screenshots/app/mobile/02-requester-my-tickets.png) | ![Requester ticket](screenshots/app/mobile/03-requester-ticket.png) | ![New ticket](screenshots/app/mobile/04-requester-new-ticket.png) |

| Requester inbox                                                   | Agent list                                                     | Navigation drawer                                                     | Agent ticket                                                |
| ----------------------------------------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------- |
| ![Requester inbox](screenshots/app/mobile/05-requester-inbox.png) | ![Agent list](screenshots/app/mobile/06-agent-all-tickets.png) | ![Navigation drawer](screenshots/app/mobile/07-navigation-drawer.png) | ![Agent ticket](screenshots/app/mobile/08-agent-ticket.png) |

| Details expanded                                                                 | Reply composer                                                        | Agent new ticket                                                    | Search results                                                  |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------- |
| ![Details expanded](screenshots/app/mobile/09-agent-ticket-details-expanded.png) | ![Reply composer](screenshots/app/mobile/10-agent-reply-composer.png) | ![Agent new ticket](screenshots/app/mobile/11-agent-new-ticket.png) | ![Search results](screenshots/app/mobile/12-search-results.png) |

| Inbox                                         | Settings                                            | Users                                               | Roles                                               |
| --------------------------------------------- | --------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------- |
| ![Inbox](screenshots/app/mobile/13-inbox.png) | ![Settings](screenshots/app/mobile/14-settings.png) | ![Users](screenshots/app/mobile/15-admin-users.png) | ![Roles](screenshots/app/mobile/16-admin-roles.png) |

| Edit role                                                   | Categories                                                    | Add user                                                  | Administrator drawer                                                           |
| ----------------------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------ |
| ![Edit role](screenshots/app/mobile/17-admin-edit-role.png) | ![Categories](screenshots/app/mobile/18-admin-categories.png) | ![Add user](screenshots/app/mobile/19-admin-new-user.png) | ![Administrator drawer](screenshots/app/mobile/20-admin-navigation-drawer.png) |

| Filters open                                                     | A filter applied                                                      | Changes combined                                                             |
| ---------------------------------------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| ![Filters open](screenshots/app/mobile/21-list-filters-open.png) | ![A filter applied](screenshots/app/mobile/22-list-filter-active.png) | ![Changes combined](screenshots/app/mobile/23-changes-in-a-row-combined.png) |

## 9. Production concepts (not built)

These mockups show what I would add for a production version. Claude made them by editing the running application in the browser and capturing the result, so they match the real interface. Numbered markers show what changed, and the panel beside each image explains it. The reasoning behind them is in the [architecture](architecture.md#6-file-attachments-planned-not-built) and the [security and data recovery plan](security-and-recovery-plan.md).

**Single sign-on.** Sign-in goes through the organization's identity provider, and one emergency administrator account remains.

![Single sign-on sign-in page concept](screenshots/production-concepts/01-sso-sign-in.png)

**MFA for every account.** Passkeys, security keys, and authenticator apps are offered. Text-message and email codes are deliberately left out.

![MFA required for every account concept](screenshots/production-concepts/02-mfa-required-for-every-account.png)

**Managing sign-in methods** from Settings.

![Sign-in methods in settings concept](screenshots/production-concepts/03-settings-sign-in-methods.png)

**Administering an account that signs in through SSO.**

![Administrator view of an SSO account concept](screenshots/production-concepts/06-admin-user-with-sso.png)

**Attachments on a ticket.** A file is as private as the message it's attached to, and new uploads wait for a malware scan.

![Ticket attachments concept](screenshots/production-concepts/04-ticket-attachments.png)

**Adding files to a reply.**

![Reply composer with attachments concept](screenshots/production-concepts/05-composer-attachments.png)

**On a phone.**

| SSO sign-in                                                                          | Attachments                                                                                 |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| ![SSO sign-in on a phone](screenshots/production-concepts/mobile-01-sso-sign-in.png) | ![Attachments on a phone](screenshots/production-concepts/mobile-04-ticket-attachments.png) |
