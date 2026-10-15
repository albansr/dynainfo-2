CREATE TYPE "public"."support_ticket_priority" AS ENUM('high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."support_ticket_status" AS ENUM('open', 'in_progress', 'resolved', 'closed');--> statement-breakpoint
CREATE TYPE "public"."support_ticket_type" AS ENUM('error', 'data', 'access', 'suggestion');--> statement-breakpoint
CREATE TABLE "support_message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"author_is_agent" boolean NOT NULL,
	"internal" boolean DEFAULT false NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_screenshot" (
	"ticket_id" uuid PRIMARY KEY NOT NULL,
	"mime" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"data" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_ticket" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" serial NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "support_ticket_type" NOT NULL,
	"subject" text NOT NULL,
	"description" text NOT NULL,
	"status" "support_ticket_status" DEFAULT 'open' NOT NULL,
	"priority" "support_ticket_priority" DEFAULT 'medium' NOT NULL,
	"context" jsonb NOT NULL,
	"web_origin" text NOT NULL,
	"changelog_entry_id" text,
	"last_activity_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "support_ticket_number_unique" UNIQUE("number")
);
--> statement-breakpoint
ALTER TABLE "support_message" ADD CONSTRAINT "support_message_ticket_id_support_ticket_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_ticket"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_message" ADD CONSTRAINT "support_message_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_screenshot" ADD CONSTRAINT "support_screenshot_ticket_id_support_ticket_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_ticket"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_ticket" ADD CONSTRAINT "support_ticket_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "support_message_ticket_created_idx" ON "support_message" USING btree ("ticket_id","created_at");--> statement-breakpoint
CREATE INDEX "support_ticket_user_activity_idx" ON "support_ticket" USING btree ("user_id","last_activity_at");--> statement-breakpoint
CREATE INDEX "support_ticket_status_idx" ON "support_ticket" USING btree ("status");--> statement-breakpoint
CREATE INDEX "support_ticket_status_resolved_idx" ON "support_ticket" USING btree ("status","resolved_at");