ALTER TABLE "contacts" ADD COLUMN "birthday_day" smallint;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "birthday_month" smallint;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "birthday_year" smallint;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_birthday_day_month_check" CHECK (("contacts"."birthday_day" is null) = ("contacts"."birthday_month" is null));--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_birthday_date_check" CHECK ("contacts"."birthday_month" between 1 and 12 and "contacts"."birthday_day" between 1 and case
        when "contacts"."birthday_month" = 2 then 29
        when "contacts"."birthday_month" in (4, 6, 9, 11) then 30
        else 31 end);--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_birthday_year_check" CHECK ("contacts"."birthday_year" is null or ("contacts"."birthday_day" is not null and "contacts"."birthday_year" >= 1900));