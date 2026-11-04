CREATE TABLE "notification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipient_id" text NOT NULL,
	"ticket_id" uuid NOT NULL,
	"actor_id" text,
	"kind" text NOT NULL,
	"comment_id" uuid,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone,
	CONSTRAINT "notification_kind_valid" CHECK ("notification"."kind" in ('comment', 'internal_note', 'assigned', 'status'))
);
--> statement-breakpoint
CREATE TABLE "ticket_follower" (
	"ticket_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ticket_follower_ticket_id_user_id_pk" PRIMARY KEY("ticket_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_recipient_id_user_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_ticket_id_ticket_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."ticket"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_comment_id_ticket_comment_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."ticket_comment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_follower" ADD CONSTRAINT "ticket_follower_ticket_id_ticket_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."ticket"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_follower" ADD CONSTRAINT "ticket_follower_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notification_recipient_created_idx" ON "notification" USING btree ("recipient_id","created_at");--> statement-breakpoint
CREATE INDEX "notification_recipient_unread_idx" ON "notification" USING btree ("recipient_id") WHERE "notification"."read_at" is null;--> statement-breakpoint
CREATE INDEX "ticket_follower_user_idx" ON "ticket_follower" USING btree ("user_id");--> statement-breakpoint
-- Existing tickets start with the people already involved as followers: the requester, the
-- assignee and everyone who has commented. No notifications are created for past activity.
INSERT INTO "ticket_follower" ("ticket_id", "user_id")
SELECT "id", "requester_id" FROM "ticket"
UNION
SELECT "id", "assigned_to_user_id" FROM "ticket" WHERE "assigned_to_user_id" IS NOT NULL
UNION
SELECT "ticket_id", "author_id" FROM "ticket_comment"
ON CONFLICT DO NOTHING;
