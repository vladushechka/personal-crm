import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { users } from "./auth-schema";

export * from "./auth-schema";

// How often the user wants to talk to a contact
export const keepInTouchFrequencies = ["week", "month", "quarter", "year"] as const;
export type KeepInTouchFrequency = (typeof keepInTouchFrequencies)[number];

// A person the user knows personally
export const contacts = pgTable(
  "contacts",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    // Whose contact this is: every query filters by it. Notes belong to the contact's owner
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    // Who this person is, e.g. "former colleague, designer"
    about: text("about"),
    howWeMet: text("how_we_met"),
    phone: text("phone"),
    email: text("email"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    keepInTouchFrequency: text("keep_in_touch_frequency").$type<KeepInTouchFrequency>(),
    // When the current frequency was chosen: the countdown starts here while there are no notes
    keepInTouchSince: timestamp("keep_in_touch_since", { withTimezone: true }),
    // Birthday: day (1-31) and month (1-12) are set together, the year is optional
    birthdayDay: smallint("birthday_day"),
    birthdayMonth: smallint("birthday_month"),
    birthdayYear: smallint("birthday_year"),
  },
  (table) => [
    index("contacts_owner_id_name_idx").on(table.ownerId, table.name),
    check(
      "contacts_keep_in_touch_frequency_check",
      sql`${table.keepInTouchFrequency} in ('week', 'month', 'quarter', 'year')`,
    ),
    check(
      "contacts_birthday_day_month_check",
      sql`(${table.birthdayDay} is null) = (${table.birthdayMonth} is null)`,
    ),
    // A day that exists in that month; 29 February is fine, a year is checked by the app
    check(
      "contacts_birthday_date_check",
      sql`${table.birthdayMonth} between 1 and 12 and ${table.birthdayDay} between 1 and case
        when ${table.birthdayMonth} = 2 then 29
        when ${table.birthdayMonth} in (4, 6, 9, 11) then 30
        else 31 end`,
    ),
    check(
      "contacts_birthday_year_check",
      sql`${table.birthdayYear} is null or (${table.birthdayDay} is not null and ${table.birthdayYear} >= 1900)`,
    ),
  ],
);

// A note about a contact, usually written after a conversation
export const notes = pgTable(
  "notes",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    contactId: integer("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("notes_contact_id_created_at_idx").on(table.contactId, table.createdAt)],
);

// A circle of people the user names themselves, e.g. "Семья" or "Теннис".
// "Семья" and "семья" of one user are one group: the database refuses a second one.
// Another user may have their own "Семья"
export const groups = pgTable(
  "groups",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("groups_owner_id_lower_name_idx").on(table.ownerId, sql`lower(${table.name})`),
  ],
);

// Who is in which group. Deleting a contact or a group removes its rows here
export const contactGroups = pgTable(
  "contact_groups",
  {
    contactId: integer("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    groupId: integer("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.contactId, table.groupId] }),
    index("contact_groups_group_id_idx").on(table.groupId),
  ],
);

// Every sign-in email sent, for the limit of 3 emails per address in 10 minutes
export const magicLinkSends = pgTable(
  "magic_link_sends",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    email: text("email").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("magic_link_sends_email_sent_at_idx").on(table.email, table.sentAt)],
);

export type Contact = typeof contacts.$inferSelect;
export type NewContact = typeof contacts.$inferInsert;
export type Note = typeof notes.$inferSelect;
export type NewNote = typeof notes.$inferInsert;
