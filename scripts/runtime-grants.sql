-- Run as the schema owner after migrations, in a dedicated application database.
-- The application login must not own tables, be a superuser, or inherit the
-- migration role. Provision its password/identity outside this script.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'capstone_runtime') THEN
    CREATE ROLE capstone_runtime NOLOGIN;
  END IF;
END $$;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO capstone_runtime;
GRANT SELECT, INSERT, UPDATE ON public."user", public.category, public.ticket TO capstone_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.account, public.session,
  public.verification, public.two_factor TO capstone_runtime;
GRANT SELECT ON public.ticket_status TO capstone_runtime;
GRANT SELECT, INSERT ON public.ticket_comment, public.ticket_event, public.security_event TO capstone_runtime;
GRANT USAGE ON SEQUENCE public.ticket_ticket_number_seq TO capstone_runtime;
-- Then grant capstone_runtime to your separately provisioned application login.
-- Do not grant this login membership in the schema-owner/migration role.
-- Reapply after schema changes; no broad default privileges are granted.

GRANT SELECT, INSERT, UPDATE, DELETE ON application_role TO capstone_runtime;
