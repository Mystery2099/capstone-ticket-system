-- Text saved before rich text was written as plain text, so existing rows are marked plain
-- and keep showing exactly as typed. Rows added from now on default to Markdown.
ALTER TABLE "ticket" ADD COLUMN "description_format" text DEFAULT 'plain' NOT NULL;--> statement-breakpoint
ALTER TABLE "ticket" ALTER COLUMN "description_format" SET DEFAULT 'markdown';--> statement-breakpoint
ALTER TABLE "ticket_comment" ADD COLUMN "body_format" text DEFAULT 'plain' NOT NULL;--> statement-breakpoint
ALTER TABLE "ticket_comment" ALTER COLUMN "body_format" SET DEFAULT 'markdown';--> statement-breakpoint
ALTER TABLE "ticket" ADD CONSTRAINT "ticket_description_format_valid" CHECK ("ticket"."description_format" in ('plain', 'markdown'));--> statement-breakpoint
ALTER TABLE "ticket_comment" ADD CONSTRAINT "ticket_comment_body_format_valid" CHECK ("ticket_comment"."body_format" in ('plain', 'markdown'));
