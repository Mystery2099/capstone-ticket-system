# Initial Requirements — Baseline v0.1

**Course:** CISY 8503 Applied Database Management  
**Lab:** Open Source Database Lab  
**Project:** Independent cross-platform ticket management application  
**Status:** Proposed starting scope; subject to Professor Enke's changes and approval

## 1. Problem and purpose
A small team needs a central place to submit support requests and track their progress. Requests currently lack a consistent structure for ownership, status, categorization, and history. This project will demonstrate how an application can use a relational database to organize that information while supporting multiple users.

The goal is not to build a commercial help desk suite. The goal is a working software application that demonstrates database design, integrity, queries, security, and the ability to respond to changing requirements.

## 2. Intended users
- **Requester:** submits tickets and checks their own requests.
- **Agent:** reviews, updates, and responds to tickets.
- **Administrator:** manages categories and user roles and can view all tickets.

A user may have only one role in v0.1. This is a deliberate assumption to revisit if requirements change.

## 3. Functional requirements
| ID | Requirement | Initial milestone |
|---|---|---|
| FR-01 | Users can sign in with an account. | MVP |
| FR-02 | Requesters can create tickets with a title, description, and category. | MVP |
| FR-03 | Users can view ticket lists and ticket details as permitted by their role. | MVP |
| FR-04 | Every ticket has a status and creation/update timestamps. | MVP |
| FR-05 | Agents can update a ticket status. | Later baseline |
| FR-06 | Agents can assign a ticket to one agent. | Later baseline |
| FR-07 | Authorized users can post comments on a ticket. | Later baseline |
| FR-08 | Users can filter tickets by status and category. | Later baseline |
| FR-09 | Administrators can manage categories and user role assignments. | Later baseline |
| FR-10 | The system records important ticket changes in an audit/history table. | Later baseline |

## 4. Nonfunctional requirements
- **NFR-01:** Linux and Windows desktop builds are primary targets; macOS is a potential later target, not an initial test commitment.
- **NFR-02:** The client communicates with a shared backend API; it never connects directly to PostgreSQL.
- **NFR-03:** Database constraints enforce valid relationships and required fields in addition to server-side validation.
- **NFR-04:** Permissions are enforced on the server, not only by hiding UI controls.
- **NFR-05:** Schema changes are tracked in versioned migration files, with tests for important database operations.
- **NFR-06:** Configuration secrets are never committed to version control.
- **NFR-07:** Backups and restore steps are documented and tested before final submission.
- **NFR-08:** Documentation explains setup, the data model, test evidence, and changes in requirements.

## 5. Out of scope for initial version
- Email notifications and integrations
- File attachments
- Mobile applications
- Customer-facing knowledge base
- Real-time chat or push updates
- Multi-organization tenancy
- Complex reporting dashboards

These may be reconsidered if new requirements call for them.

## 6. Assumptions and open questions
1. Project scenario is a generic internal support team, not a hospital or actual employer.
2. One role per user initially, and one assigned agent per ticket.
3. PostgreSQL runs separately from the desktop client. The development environment can host the server and database on one machine.
4. All sample user and ticket data will be fictional.
5. Confirm with Professor Enke whether the lab expects specific database features, particular documentation formats, or a minimum number of reports.

## 7. Initial acceptance checks
- A seeded requester signs in and can create a ticket.
- The created ticket appears in PostgreSQL and is visible in the requester's ticket list.
- Another requester cannot access that ticket through a direct API call.
- An agent can see assigned/eligible tickets based on the chosen policy.
- Invalid category IDs are rejected; deleting referenced data does not silently orphan tickets.
- Reapplying an already-applied migration does not recreate tables or corrupt data (managed by the migration runner).
