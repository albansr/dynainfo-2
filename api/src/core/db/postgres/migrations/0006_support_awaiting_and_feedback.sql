ALTER TABLE "support_ticket" ADD COLUMN "awaiting_team" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "support_ticket" ADD COLUMN "satisfied" boolean;--> statement-breakpoint
CREATE INDEX "support_ticket_awaiting_idx" ON "support_ticket" USING btree ("awaiting_team","last_activity_at");