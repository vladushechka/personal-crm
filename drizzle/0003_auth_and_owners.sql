CREATE TABLE "magic_link_sends" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "magic_link_sends_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"email" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "contacts_name_idx";--> statement-breakpoint
DROP INDEX "groups_lower_name_idx";--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "owner_id" text;--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "owner_id" text;--> statement-breakpoint
-- Hand-written, not generated: contacts and groups that existed before sign-in go to the owner.
-- The owner's email comes from the setting app.owner_email, which scripts/migrate.ts takes from
-- OWNER_EMAIL. Notes and group members follow their contacts and groups. An empty database
-- needs no email. Without it the whole migration fails and the database stays as it was
DO $$
DECLARE
  owner_email text := lower(trim(coalesce(current_setting('app.owner_email', true), '')));
  owner_user_id text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "contacts") AND NOT EXISTS (SELECT 1 FROM "groups") THEN
    RETURN;
  END IF;
  IF owner_email = '' THEN
    RAISE EXCEPTION 'OWNER_EMAIL is not set: it names the owner of the existing contacts and groups';
  END IF;

  INSERT INTO "users" ("id", "name", "email", "email_verified")
  VALUES (gen_random_uuid()::text, '', owner_email, true)
  ON CONFLICT ("email") DO NOTHING;
  SELECT "id" INTO owner_user_id FROM "users" WHERE "email" = owner_email;

  UPDATE "contacts" SET "owner_id" = owner_user_id;
  UPDATE "groups" SET "owner_id" = owner_user_id;
END $$;--> statement-breakpoint
ALTER TABLE "contacts" ALTER COLUMN "owner_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "groups" ALTER COLUMN "owner_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "magic_link_sends_email_sent_at_idx" ON "magic_link_sends" USING btree ("email","sent_at");--> statement-breakpoint
CREATE INDEX "accounts_userId_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_userId_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verifications_identifier_idx" ON "verifications" USING btree ("identifier");--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contacts_owner_id_name_idx" ON "contacts" USING btree ("owner_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "groups_owner_id_lower_name_idx" ON "groups" USING btree ("owner_id",lower("name"));