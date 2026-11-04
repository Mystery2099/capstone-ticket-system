-- Built-in Agent and Administrator roles can edit a ticket's subject and description.
-- Custom roles are left alone; administrators grant it to them in the role editor.
UPDATE "application_role"
SET "permissions" = "permissions" || '["editTicketContent"]'::jsonb
WHERE "id" IN ('agent', 'admin')
	AND NOT "permissions" @> '["editTicketContent"]'::jsonb;
