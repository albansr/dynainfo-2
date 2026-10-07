CREATE TABLE "changelog_digest_run" (
	"digest_date" text PRIMARY KEY NOT NULL,
	"recipients" integer DEFAULT 0 NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "changelog_subscriber" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"token" text NOT NULL,
	"web_origin" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"unsubscribed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "changelog_subscriber_email_unique" UNIQUE("email"),
	CONSTRAINT "changelog_subscriber_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE INDEX "changelog_subscriber_status_idx" ON "changelog_subscriber" USING btree ("status");