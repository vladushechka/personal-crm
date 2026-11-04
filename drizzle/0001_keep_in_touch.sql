ALTER TABLE "contacts" ADD COLUMN "keep_in_touch_frequency" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "keep_in_touch_since" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_keep_in_touch_frequency_check" CHECK ("contacts"."keep_in_touch_frequency" in ('week', 'month', 'quarter', 'year'));