import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// How often the user wants to talk to a contact
export const keepInTouchFrequencies = ["week", "month", "quarter", "year"] as const;
export type KeepInTouchFrequency = (typeof keepInTouchFrequencies)[number];

// A person the user knows personally
export const contacts = pgTable(
  "contacts",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
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
  },
  (table) => [
    index("contacts_name_idx").on(table.name),
    check(
      "contacts_keep_in_touch_frequency_check",
      sql`${table.keepInTouchFrequency} in ('week', 'month', 'quarter', 'year')`,
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
// "Семья" and "семья" are one group: the database refuses a second one
export const groups = pgTable(
  "groups",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("groups_lower_name_idx").on(sql`lower(${table.name})`)],
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

export type Contact = typeof contacts.$inferSelect;
export type NewContact = typeof contacts.$inferInsert;
export type Note = typeof notes.$inferSelect;
export type NewNote = typeof notes.$inferInsert;
