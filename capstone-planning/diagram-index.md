# Diagram and Documentation Index

Each Mermaid diagram now lives in its own `.mmd` file under `diagrams/`, rather than being embedded inside a longer Markdown document. This makes the diagrams easier to edit, render, and reuse in the capstone presentation. The Markdown documents keep the explanation, assumptions, and decisions, with links to the corresponding diagram files.

## Diagrams

| Diagram | File | Context |
|---|---|---|
| System architecture | [`diagrams/system-architecture.mmd`](diagrams/system-architecture.mmd) | [`architecture-and-build-plan.md`](architecture-and-build-plan.md) |
| Entity relationship | [`diagrams/entity-relationship.mmd`](diagrams/entity-relationship.mmd) | [`database-design.md`](database-design.md) |
| Ticket lifecycle | [`diagrams/ticket-lifecycle.mmd`](diagrams/ticket-lifecycle.mmd) | [`roles-and-workflow.md`](roles-and-workflow.md) |
| Site map | [`diagrams/site-map.mmd`](diagrams/site-map.mmd) | [`site-map.md`](site-map.md) |
| System context | [`diagrams/system-context.mmd`](diagrams/system-context.mmd) | [`request-lifecycle.md`](request-lifecycle.md) |
| Create ticket sequence | [`diagrams/create-ticket-sequence.mmd`](diagrams/create-ticket-sequence.mmd) | [`request-lifecycle.md`](request-lifecycle.md) |
| Internal notes visibility | [`diagrams/internal-notes-visibility.mmd`](diagrams/internal-notes-visibility.mmd) | [`request-lifecycle.md`](request-lifecycle.md) |
| Status update transaction | [`diagrams/status-update-transaction.mmd`](diagrams/status-update-transaction.mmd) | [`request-lifecycle.md`](request-lifecycle.md) |

## Planning documents

- [`database-design.md`](database-design.md): proposed tables, constraints, normalization, and indexing.
- [`roles-and-workflow.md`](roles-and-workflow.md): permissions and ticket status rules.
- [`architecture-and-build-plan.md`](architecture-and-build-plan.md): application structure and implementation order.
- [`site-map.md`](site-map.md): routes and role-specific navigation.
- [`request-lifecycle.md`](request-lifecycle.md): data-flow explanations and transaction decisions.
- [`test-and-demo-plan.md`](test-and-demo-plan.md): validation and demonstration scenarios.

These are still planning drafts. Before implementing the PostgreSQL schema, we should review the database decisions against the supplied Supabase PostgreSQL best-practices skill and any relevant supporting rules.

The ticket lifecycle diagram now includes administrator-only reopening of Closed tickets. The ERD remains unchanged because the new permissions do not require new relationships.
