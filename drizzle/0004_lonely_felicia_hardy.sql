CREATE TABLE "application_role" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"permissions" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "application_role_name_unique" ON "application_role" USING btree (lower("name"));--> statement-breakpoint
INSERT INTO application_role (id, name, permissions) VALUES
('requester', 'Requester', '["reopenOwnResolvedTickets"]'::jsonb),
('agent', 'Agent', '["viewAllTickets", "createTicketsForOthers", "assignTickets", "receiveAssignments", "setTicketPriority", "setTicketStatus", "setTicketCategory", "useInternalNotes", "reopenOwnResolvedTickets"]'::jsonb),
('admin', 'Administrator', '["viewAllTickets", "createTicketsForOthers", "assignTickets", "receiveAssignments", "setTicketPriority", "setTicketStatus", "setTicketCategory", "useInternalNotes", "reopenOwnResolvedTickets", "reopenClosedTickets", "manageAdministration"]'::jsonb);
--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_role_application_role_id_fk" FOREIGN KEY ("role") REFERENCES "public"."application_role"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_role_idx" ON "user" USING btree ("role");