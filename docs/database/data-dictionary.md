# Database Data Dictionary

> **Reference draft, written before Better Auth was adopted.** Better Auth now owns the user/session/account tables, so cross-check column names against `src/lib/server/ticket-schema.ts`, `src/lib/server/auth-schema.ts`, and the [implemented database design](../database-design.md); the `app_user` naming here is historical.

This describes the proposed first schema, not an implemented database. **PK** means primary key, **FK** means foreign key, and **required** means `NOT NULL`.

## app_user

| Column          | Type        | Rules or purpose                                              |
| --------------- | ----------- | ------------------------------------------------------------- |
| `id`            | uuid        | PK, generated UUID                                            |
| `email`         | text        | Required; unique when compared in lowercase                   |
| `password_hash` | text        | Required; hashed using a vetted password hashing library      |
| `display_name`  | text        | Required, nonblank                                            |
| `role`          | text        | Required; `requester`, `agent`, or `admin`; default requester |
| `banned`        | boolean     | Default false                                                 | True when an administrator disables the account; blocks sign-in and access |
| `created_at`    | timestamptz | Required; default current timestamp                           |

## category

| Column   | Type    | Rules or purpose                         |
| -------- | ------- | ---------------------------------------- |
| `id`     | uuid    | PK                                       |
| `name`   | text    | Required, nonblank, unique ignoring case |
| `active` | boolean | Required; default true                   |

## ticket_status

| Column       | Type    | Rules or purpose                                           |
| ------------ | ------- | ---------------------------------------------------------- |
| `code`       | text    | PK; `open`, `in_progress`, `on_hold`, `resolved`, `closed` |
| `label`      | text    | Required and unique, human-readable name                   |
| `sort_order` | integer | Required, positive and unique                              |

## ticket

| Column                | Type        | Rules or purpose                                                                                  |
| --------------------- | ----------- | ------------------------------------------------------------------------------------------------- |
| `id`                  | uuid        | PK                                                                                                |
| `ticket_number`       | bigint      | Generated identity, unique, for display                                                           |
| `subject`             | text        | Required, nonblank                                                                                |
| `description`         | text        | Required, nonblank; initial request description                                                   |
| `requester_id`        | uuid        | Required FK to `app_user`                                                                         |
| `assigned_to_user_id` | uuid        | Optional FK to `app_user`; role/banned check in server transaction                                |
| `category_id`         | uuid        | Required FK to `category`                                                                         |
| `status_code`         | text        | Required FK to `ticket_status`; default open                                                      |
| `priority`            | text        | Required; low, normal or high; default normal. Only agents/admins can change it (server-enforced) |
| `created_at`          | timestamptz | Required; default current timestamp                                                               |
| `updated_at`          | timestamptz | Required; default current timestamp; updated on meaningful changes                                |

## ticket_comment

| Column        | Type        | Rules or purpose                                                         |
| ------------- | ----------- | ------------------------------------------------------------------------ |
| `id`          | uuid        | PK                                                                       |
| `ticket_id`   | uuid        | Required FK to `ticket`                                                  |
| `author_id`   | uuid        | Required FK to `app_user`                                                |
| `body`        | text        | Required, nonblank                                                       |
| `is_internal` | boolean     | Required; default false; server checks visibility and posting permission |
| `created_at`  | timestamptz | Required; default current timestamp                                      |

## ticket_event

| Column       | Type        | Rules or purpose                                                        |
| ------------ | ----------- | ----------------------------------------------------------------------- |
| `id`         | uuid        | PK                                                                      |
| `ticket_id`  | uuid        | Required FK to `ticket`                                                 |
| `actor_id`   | uuid        | Optional FK to `app_user` for system-created events                     |
| `event_type` | text        | Required, nonblank; application-defined event name                      |
| `details`    | jsonb       | Required JSON object, default `{}`; must not include internal-note text |
| `created_at` | timestamptz | Required; default current timestamp                                     |

## Normalization notes

The core data is organized around third normal form: ticket rows refer to user, category and status records instead of copying their names, and repeating comments/events live in their own tables. The `details` JSONB object handles event-specific values, not ticket attributes that need relational constraints. There are no derived totals stored in the initial schema.
