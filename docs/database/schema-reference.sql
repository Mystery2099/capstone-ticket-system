-- Design reference only, NOT an executable Drizzle migration.
-- Build equivalent Drizzle table definitions and generate a tracked migration.
-- Written before Better Auth was adopted: auth tables (user/session/account) are
-- now generated from Better Auth, so app_user here is historical naming.
-- PostgreSQL 16+ baseline; uses built-in gen_random_uuid().

CREATE TABLE app_user (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  password_hash text NOT NULL,
  display_name text NOT NULL,
  role text NOT NULL DEFAULT 'requester' CHECK (role IN ('requester','agent','admin')),
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_user_email_not_blank CHECK (length(btrim(email)) > 0),
  CONSTRAINT app_user_name_not_blank CHECK (length(btrim(display_name)) > 0),
  CONSTRAINT app_user_password_hash_not_blank CHECK (length(btrim(password_hash)) > 0)
);
CREATE UNIQUE INDEX app_user_email_ci_uq ON app_user (lower(email));

CREATE TABLE category (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  active boolean NOT NULL DEFAULT true
);
CREATE UNIQUE INDEX category_name_ci_uq ON category (lower(name));

CREATE TABLE ticket_status (
  code text PRIMARY KEY,
  label text NOT NULL UNIQUE,
  sort_order integer NOT NULL UNIQUE CHECK (sort_order > 0)
);
INSERT INTO ticket_status (code,label,sort_order) VALUES
  ('open','Open',1),
  ('in_progress','In Progress',2),
  ('on_hold','On Hold',3),
  ('resolved','Resolved',4),
  ('closed','Closed',5);

CREATE TABLE ticket (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  subject text NOT NULL CHECK (length(btrim(subject)) > 0),
  description text NOT NULL CHECK (length(btrim(description)) > 0),
  requester_id uuid NOT NULL REFERENCES app_user(id) ON DELETE RESTRICT,
  assigned_to_user_id uuid REFERENCES app_user(id) ON DELETE RESTRICT,
  category_id uuid NOT NULL REFERENCES category(id) ON DELETE RESTRICT,
  status_code text NOT NULL DEFAULT 'open' REFERENCES ticket_status(code) ON DELETE RESTRICT,
  -- Requester-created tickets always use the default. Role-based changes are enforced by SvelteKit.
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ticket_timestamps_order CHECK (updated_at >= created_at)
);

CREATE TABLE ticket_comment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES ticket(id) ON DELETE RESTRICT,
  author_id uuid NOT NULL REFERENCES app_user(id) ON DELETE RESTRICT,
  body text NOT NULL CHECK (length(btrim(body)) > 0),
  is_internal boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ticket_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES ticket(id) ON DELETE RESTRICT,
  actor_id uuid REFERENCES app_user(id) ON DELETE RESTRICT,
  event_type text NOT NULL CHECK (length(btrim(event_type)) > 0),
  details jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(details) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Ordered list access patterns (the primary keys/unique constraints have indexes already).
CREATE INDEX ticket_requester_recent_idx ON ticket (requester_id, updated_at DESC, id);
CREATE INDEX ticket_assignee_recent_idx ON ticket (assigned_to_user_id, updated_at DESC, id)
  WHERE assigned_to_user_id IS NOT NULL;
CREATE INDEX ticket_unassigned_recent_idx ON ticket (updated_at DESC, id)
  WHERE assigned_to_user_id IS NULL AND status_code <> 'closed';
CREATE INDEX ticket_status_recent_idx ON ticket (status_code, updated_at DESC, id);
CREATE INDEX ticket_category_idx ON ticket (category_id);
CREATE INDEX ticket_comment_thread_idx ON ticket_comment (ticket_id, created_at, id);
CREATE INDEX ticket_event_thread_idx ON ticket_event (ticket_id, created_at, id);
-- Optional later, if public-only comment retrieval needs it:
-- CREATE INDEX ticket_public_comments_idx ON ticket_comment(ticket_id,created_at,id)
--   WHERE is_internal = false;
