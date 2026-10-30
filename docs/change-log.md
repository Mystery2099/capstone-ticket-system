# Requirements and Architecture Change Log

## 2026-10-30 — Baseline v0.1
Initial ticketing proposal using a Compose Multiplatform desktop client, Ktor API and PostgreSQL. Intended requester, agent and admin roles; one assigned agent per ticket.

## 2026-10-30 — Web-first baseline v0.4
**Origin:** Professor Enke encouraged making the application a web app.  
**Decision:** Replace Compose/Ktor with SvelteKit full-stack, using PostgreSQL and Drizzle. Keep the core ticketing scenario, relational database focus and desktop-oriented split-view UX.  
**Reason:** simpler access and demonstration for multiple users, less setup and maintenance for a course-only project.  
**Impact:** architecture, requirements, development plan and UI implementation guidance changed; initial database schema still needs independent review.  
**Status:** Planning decision; implementation not started.

## Future requirement changes
Record the exact request, date, requester, prior behavior, new expected behavior, impact on schema/security/UI, migration and test approach, and completion evidence. Do not invent instructor requests.
