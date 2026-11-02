CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE INDEX "ticket_subject_trgm_idx" ON "ticket" USING gin ("subject" gin_trgm_ops);
