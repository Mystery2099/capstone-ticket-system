# Requirements: Support Ticket Management System

**Course:** CISY 8503 Applied Database Management  
**Lab:** Open Source Database Lab  
**Student:** Mathew Kennedy-Brewer  
**Status:** Current as of November 5, 2026  
**Project:** [Capstone Ticket System](https://github.com/Mystery2099/capstone-ticket-system)

## Introduction

This document lists what the ticket system is required to do. The [needs assessment](needs-assessment.md) explains why each need exists; here I state the requirements themselves so they can be checked against the application and the [test and demonstration plan](test-and-demo-plan.md). The scope may still change based on Professor Enke's feedback, and any change he requests is reflected here.

## 1. Purpose

A fictional small support team needs a way to submit requests, assign tickets, and track progress. The application should demonstrate relational database modeling, constraints, queries, transactions, security, and recovery without turning into a full help desk product. The built-in roles and the custom capabilities administrators can grant are described in [roles and permissions](roles-and-permissions.md).

## 2. Functional requirements

Each requirement has an identifier so I can refer to it from tests and the demonstration. FR-12 and FR-13 were added after the original proposal.

| ID    | Requirement                                                                                                                                                                                                                     |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-01 | Provisioned users can sign in and out through Better Auth; public signup is disabled.                                                                                                                                           |
| FR-02 | An authorized user can create a ticket with a subject, description, and category. New tickets default to Normal priority. Agents and administrators can open a ticket for another enabled user and assign it while creating it. |
| FR-03 | Requesters see only their own tickets; agents and administrators see all tickets.                                                                                                                                               |
| FR-04 | Tickets support the Open, In Progress, On Hold, Resolved, and Closed statuses.                                                                                                                                                  |
| FR-05 | Agents and administrators can assign a ticket to one enabled agent or administrator and change its status, category, and priority.                                                                                              |
| FR-06 | Users can post public comments on accessible tickets that are not Closed; agents and administrators can also create and read internal notes.                                                                                    |
| FR-07 | Requesters can reopen their own Resolved tickets. Only administrators can reopen Closed tickets.                                                                                                                                |
| FR-08 | Tickets can be filtered and searched by the supported views and fields.                                                                                                                                                         |
| FR-09 | Administrators can manage categories, roles, and whether accounts are enabled.                                                                                                                                                  |
| FR-10 | Important ticket changes generate server-written activity history in the same transaction as the change.                                                                                                                        |
| FR-11 | Descriptions, replies, and notes support basic rich-text formatting without visible Markdown.                                                                                                                                   |
| FR-12 | Comments, assignments, and Resolved, Closed, or reopened status changes notify the people involved through an in-app inbox, without revealing internal notes to people who cannot read them.                                    |
| FR-13 | Staff can edit a ticket's subject and description, and each edit appears in the ticket's timeline.                                                                                                                              |

## 3. Nonfunctional requirements

Access checks have to happen on the server, because hiding a button in the browser does not stop someone from sending the request directly. Relational constraints should protect the data even if the application makes a mistake, and every query should be parameterized so user input never becomes part of the SQL text. The schema has to be reproducible through tracked migrations rather than manual changes to individual tables.

The interface should be accessible and responsive enough to use from both desktop and phone browsers, without requiring a native client or an installable web app. Secrets should be managed through environment settings and never committed to the repository. Backups only count if they have been restored successfully, so the recovery process needs to be tested rather than assumed; the [security and data recovery plan](security-and-recovery-plan.md) describes how.

## 4. Out of scope

Email delivery and email-to-ticket integration, attachments, a command palette, open self-registration, push notifications, offline support, multi-tenant organizations, and complex reports are outside the requirements. I decided not to implement image or file attachments in this project; the [architecture document](architecture.md#6-file-attachments-planned-not-built) describes how I would add them. The design mockups in `design/` are visual references rather than additional requirements.

## Conclusion

These requirements describe a small but complete ticket system whose core behavior depends on the database: ownership, a controlled lifecycle, private notes, and history that always matches the data. The evidence that each requirement is met is listed in the [test and demonstration plan](test-and-demo-plan.md).
