ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "dyna_role" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "scope" text;