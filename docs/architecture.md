# Architecture

One SvelteKit application serves desktop and mobile browsers. Server routes and
actions validate sessions, permissions, and input before accessing PostgreSQL.
The browser never connects directly to the database.

| Layer                                       | Responsibility                                     |
| ------------------------------------------- | -------------------------------------------------- |
| Svelte 5, Tailwind 4, shadcn-svelte/Bits UI | Responsive ticket workspace                        |
| SvelteKit server routes/actions             | Validation, authorization, workflows, transactions |
| Better Auth                                 | Passwords, sessions, MFA, auth tables              |
| Drizzle ORM / Kit                           | Queries, schema, tracked migrations                |
| PostgreSQL                                  | Persistence, constraints, indexes                  |

Ticket changes and their events commit together. Server queries filter internal
notes before serialization. Account state and saved permissions are loaded on each
request, so disabled accounts and stale sessions cannot retain access.

See [authentication](auth-integration.md), [request flow](request-lifecycle.md),
[database design](database-design.md), and [hosting](azure-student-deployment.md).
[Architecture diagram](diagrams/system-architecture.mmd).

Proposed message formatting: [Markdown feasibility and integration](markdown-feasibility.md).
