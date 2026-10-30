# Needs Assessment — Initial Draft

**Project:** Capstone Ticket System  
**Course:** CISY 8503 Applied Database Management  
**Scenario:** Fictional internal support team  
**Status:** Proposed planning document; no real stakeholder interviews conducted

## Problem
A small internal support team needs a consistent place to submit requests and track progress. In this hypothetical scenario, information could otherwise be scattered across conversations or informal notes, making it harder to tell which issues are open, who is responsible and what has already been done.

## Stakeholders and needs
Requesters need a straightforward way to submit issues and check their own requests. Support agents need an organized queue, assignment information, statuses and comments. An administrator needs limited ways to manage users, roles and categories. These are assumed needs for the fictional scenario, not findings from stakeholder interviews.

## Proposed solution
A small web application with a responsive ticket workspace and a shared PostgreSQL database. SvelteKit handles browser screens and server operations in one project. PostgreSQL stores relational records, enforces important constraints and supports transactions.

## Initial success criteria
A requester can authenticate, create a ticket and see it persisted. Authorized agents can update tickets and record comments; unauthorized users cannot access someone else's private requests. The database remains consistent when invalid references or conflicting operations are attempted.

## Constraints
This is a 100-point database lab rather than a commercial system. A usable web interface is valuable, but the main technical evidence should be database modeling, queries, constraints, safe updates, migrations, security and recovery. Use fictional sample data only. Avoid elaborate dashboards, third-party integrations and offline synchronization unless newly required.

## Uncertainties to investigate
Exact ticket visibility, assignment rules, status transitions, secure sessions, schema structure, indexing based on expected queries, concurrency and backup/restore. More detailed technical documentation should focus on these uncertainties.

## Validation and next steps
Review this high-level needs assessment with Professor Enke and record any changes. Follow it with an ER diagram, explicit database design rationale and implementation/testing evidence. Do not claim this document represents final stakeholder approval.
