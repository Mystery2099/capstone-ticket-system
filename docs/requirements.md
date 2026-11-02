# Requirements

**Course:** CISY 8503, Open Source Database Lab. Scope may change with professor feedback.

## Purpose

A fictional small support team needs a way to submit requests, assign tickets and track progress. The application should demonstrate relational database modeling, constraints, queries, transactions, security and recovery, without turning into a full help desk product.

See [roles and workflow](roles-and-workflow.md) for built-in roles and
[permissions](permissions.md) for custom capabilities.

## Functional requirements

| ID    | Requirement                                                                                                                                                                                                            |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-01 | Provisioned users can sign in/out through Better Auth; public signup is disabled.                                                                                                                                      |
| FR-02 | An authorized user can create a ticket with a subject, description and category. New tickets default to Normal priority. Agents and admins can open a ticket for another enabled user and assign it while creating it. |
| FR-03 | Requesters see only their tickets; agents and administrators see all tickets.                                                                                                                                          |
| FR-04 | Tickets support Open, In Progress, On Hold, Resolved and Closed.                                                                                                                                                       |
| FR-05 | Agents/admins can assign tickets to one enabled agent/admin and change status, category and priority.                                                                                                                  |
| FR-06 | Users can post public comments on accessible, non-Closed tickets; agents/admins can also create and read internal notes.                                                                                               |
| FR-07 | Requesters can reopen their own Resolved tickets. Administrators alone can reopen Closed tickets.                                                                                                                      |
| FR-08 | Tickets can be filtered/searched by supported views and fields.                                                                                                                                                        |
| FR-09 | Administrators can manage categories and account roles/enabled state.                                                                                                                                                  |
| FR-10 | Important ticket changes generate server-written activity history in the same transaction.                                                                                                                             |

## Nonfunctional requirements

Server-side access checks, relational constraints, parameterized database access, tracked migrations, accessible responsive UI, tested backups/restoration, and environment-managed secrets. The app will be usable from desktop and phone browsers without requiring a native client or PWA.

## Out of scope

Email delivery/integration, attachments, command palette, open self-registration, push updates, offline support, multi-tenant organizations and complex reports.

Acceptance evidence is listed in the [test and demo plan](test-and-demo-plan.md).
