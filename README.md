# Capstone Ticket System

An independent, small multi-user ticket management application for the CISY 8503 Open Source Database Lab.

## Proposed stack
- Desktop client: Kotlin + Compose Multiplatform (Linux and Windows first)
- Backend: Kotlin + Ktor, exposing a JSON HTTP API
- Database: PostgreSQL
- Build: Gradle Kotlin DSL
- Migrations: versioned SQL files (tooling to be selected)

## Status
**Planning / baseline v0.1.** The initial requirements and schema are proposals, not professor-approved final specifications. No application code has been implemented yet.

## Documents
- [Requirements](docs/requirements.md)
- [Architecture](docs/architecture.md)
- [Database design](docs/database-design.md)
- [Development plan](docs/development-plan.md)
- [Change log](docs/change-log.md)

## First demonstration target
A desktop client can log in, list tickets, create a ticket, and open a ticket's details. A Ktor server mediates database access; PostgreSQL holds all persistent ticket data. Include a database diagram, initial migration, sample seed data, and at least a few tested queries.

## Security principles
The desktop client never receives database credentials. Database access stays on the server. Server endpoints enforce permissions and validate inputs. Passwords will only be stored using an established password-hashing implementation (algorithm/library chosen during implementation), never plaintext.
