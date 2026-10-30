# Initial Requirements — Web Baseline v0.4

**Course:** CISY 8503 Applied Database Management  
**Lab:** Open Source Database Lab  
**Status:** Proposed requirements, not yet finalized by Professor Enke

## Purpose
A fictional small internal support organization needs a consistent way to submit, categorize, assign and track requests. The scenario is hypothetical; no real stakeholder interviews have been conducted. This application demonstrates relational data modeling, security, queries and multi-user workflows.

## Initial roles
- **Requester:** creates and views their own tickets.
- **Agent:** responds to tickets and handles assignments.
- **Administrator:** manages user roles and categories.

Initially one role per user and one assignee per ticket, subject to change.

## Functional requirements
| ID | Requirement | Phase |
|---|---|---|
| FR-01 | Users can sign in and sign out. | MVP |
| FR-02 | Requesters create a ticket with title, description and category. | MVP |
| FR-03 | Users view only tickets they are allowed to access. | MVP |
| FR-04 | Tickets have statuses and timestamps. | MVP |
| FR-05 | Agents update status and assignment. | Workflow |
| FR-06 | Authorized users add comments. | Workflow |
| FR-07 | Users can search and filter accessible tickets. | Workflow |
| FR-08 | Admins manage categories and roles. | Workflow |
| FR-09 | Important ticket changes create history records. | Workflow |

## Nonfunctional requirements
- Modern desktop browsers supported; layout adapts to smaller widths.
- PostgreSQL is accessible only through SvelteKit server code.
- Constraints and server validation prevent invalid data.
- Authorization is server-enforced.
- Schema migrations, tests, and backups are documented.
- Credentials remain outside version control; fictional sample data only.
- Significant requirement changes are logged.

## UI scope
Simple sidebar, ticket list and ticket details in a split view on desktop. shadcn-svelte components with compact sizing, readable light/dark themes and sensible keyboard behavior. Optional PWA installation is not an initial requirement.

## Out of scope
Native desktop app, Kotlin/Ktor backend, email notifications, attachments, real-time chat, offline synchronization, multi-tenancy, complex analytics, and cloud deployment.

## Acceptance evidence
A seeded requester can sign in and create a persisted ticket; a second requester cannot access it directly. An agent can make an authorized update with history recorded consistently. Invalid foreign keys are rejected, migrations run safely, and test results are documented.

## Open questions
Exact visibility and status policies, authentication implementation, and final lab documentation requirements.
