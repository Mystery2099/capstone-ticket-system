# Architecture

I'm keeping this project as one SvelteKit application rather than adding a separate backend service. SvelteKit server code handles session validation, access rules, input validation and PostgreSQL operations through Drizzle; the browser only receives data it is allowed to see.

[System architecture diagram](diagrams/system-architecture.mmd) · [Authentication flow](diagrams/authentication-flow.mmd)

## Stack and responsibilities

| Layer | Choice | Responsibility |
|---|---|---|
| UI | SvelteKit, Svelte 5, Tailwind 4, shadcn-svelte/Bits UI | Ticket screens and responsive navigation |
| Server | SvelteKit server routes/actions | Validation, permissions, ticket workflows and transactions |
| Authentication | Better Auth | Email/password login, sessions and auth-managed tables |
| Database access | Drizzle ORM and Drizzle Kit | Typed queries and tracked migrations |
| Database | PostgreSQL | Relational integrity, indexes and persisted application data |

Better Auth manages identity, but it does not automatically enforce who may see a ticket or private note. Those rules belong in server-side application logic. A disabled user's existing session must not grant ticket access.

## Deployment

Local development and testing come first. Azure App Service and Azure Database for PostgreSQL are optional deployment choices and should only be configured after the full local workflow passes. Fictional demo data only; no credentials in version control.

## Implementation boundaries

- Public registration is disabled; demo users are created through a supported server-only setup procedure.
- Authentication schema is generated from the installed Better Auth version and incorporated into our Drizzle schema. Do not hand-maintain an independent SQL migration for it.
- Ticket mutations that require audit events use a single transaction.
- Server queries exclude private notes before responding to requesters.
- No separate Ktor service or Compose desktop application is planned.
