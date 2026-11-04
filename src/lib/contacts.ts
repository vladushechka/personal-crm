import "server-only";

import { and, asc, count, desc, eq, isNotNull, max, sql, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { contacts, notes, type Contact, type KeepInTouchFrequency } from "@/db/schema";

import type { ContactInput } from "./contact-schema";

export type ContactListItem = {
  id: number;
  name: string;
  about: string | null;
  howWeMet: string | null;
};

// Lowercase and treat "ё" as "е", so "Алена" finds "Алёна"
function normalizeForSearch(value: string) {
  return value.toLowerCase().replaceAll("ё", "е");
}

function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

// Every word of the query must occur in the name, in any order:
// "петр иван" finds "Иван Петров"
function nameMatches(query: string): SQL | undefined {
  const words = normalizeForSearch(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return undefined;

  return and(
    ...words.map(
      (word) =>
        sql`translate(lower(${contacts.name}), 'ё', 'е') like ${`%${escapeLikePattern(word)}%`}`,
    ),
  );
}

export async function listContacts(query = ""): Promise<ContactListItem[]> {
  return db
    .select({
      id: contacts.id,
      name: contacts.name,
      about: contacts.about,
      howWeMet: contacts.howWeMet,
    })
    .from(contacts)
    .where(nameMatches(query))
    .orderBy(asc(contacts.name), asc(contacts.id));
}

export async function countContacts(): Promise<number> {
  const [row] = await db.select({ value: count() }).from(contacts);
  return row?.value ?? 0;
}

export async function getContact(id: number): Promise<Contact | null> {
  const [contact] = await db.select().from(contacts).where(eq(contacts.id, id));
  return contact ?? null;
}

export async function getContactWithNotes(id: number) {
  const contact = await getContact(id);
  if (!contact) return null;

  const contactNotes = await db
    .select()
    .from(notes)
    .where(eq(notes.contactId, id))
    .orderBy(desc(notes.createdAt), desc(notes.id));

  return { ...contact, notes: contactNotes };
}

export async function contactExists(id: number): Promise<boolean> {
  const [row] = await db.select({ id: contacts.id }).from(contacts).where(eq(contacts.id, id));
  return Boolean(row);
}

export async function createContact(input: ContactInput): Promise<number> {
  const [row] = await db.insert(contacts).values(input).returning({ id: contacts.id });
  return row.id;
}

// Returns false if there is no such contact (e.g. it was deleted in another browser)
export async function updateContact(id: number, input: ContactInput): Promise<boolean> {
  const [row] = await db
    .update(contacts)
    .set(input)
    .where(eq(contacts.id, id))
    .returning({ id: contacts.id });
  return Boolean(row);
}

export async function addNote(contactId: number, body: string): Promise<void> {
  await db.insert(notes).values({ contactId, body });
}

// The date stays the original one, so the note keeps its place in the list.
// Returns false if the contact has no such note (e.g. it was deleted in another browser)
export async function updateNote(contactId: number, noteId: number, body: string): Promise<boolean> {
  const [row] = await db
    .update(notes)
    .set({ body })
    .where(and(eq(notes.id, noteId), eq(notes.contactId, contactId)))
    .returning({ id: notes.id });
  return Boolean(row);
}

export async function deleteNote(contactId: number, noteId: number): Promise<void> {
  await db.delete(notes).where(and(eq(notes.id, noteId), eq(notes.contactId, contactId)));
}

// A new frequency restarts the countdown for a contact without notes; null clears both.
// Returns false if there is no such contact (e.g. it was deleted in another browser)
export async function setKeepInTouch(
  contactId: number,
  frequency: KeepInTouchFrequency | null,
): Promise<boolean> {
  const [row] = await db
    .update(contacts)
    .set({
      keepInTouchFrequency: frequency,
      keepInTouchSince: frequency ? sql`now()` : null,
    })
    .where(eq(contacts.id, contactId))
    .returning({ id: contacts.id });
  return Boolean(row);
}

export type ContactToReachOut = {
  id: number;
  name: string;
  frequency: KeepInTouchFrequency;
  lastNoteAt: Date | null;
  since: Date;
};

// Date of each contact's latest note
const lastNotes = db
  .select({ contactId: notes.contactId, lastNoteAt: max(notes.createdAt).as("last_note_at") })
  .from(notes)
  .groupBy(notes.contactId)
  .as("last_notes");

// The last conversation is the latest note, or the day the frequency was chosen if there are
// no notes. Months, quarters and years are calendar ones, as Postgres interval arithmetic does
const dueAt = sql`coalesce(${lastNotes.lastNoteAt}, ${contacts.keepInTouchSince}) + case ${contacts.keepInTouchFrequency}
  when 'week' then interval '7 days'
  when 'month' then interval '1 month'
  when 'quarter' then interval '3 months'
  when 'year' then interval '1 year'
end`;

// Contacts whose time to talk has passed; the earliest due date, i.e. the most days overdue, first
export async function listContactsToReachOut(): Promise<ContactToReachOut[]> {
  const rows = await db
    .select({
      id: contacts.id,
      name: contacts.name,
      frequency: contacts.keepInTouchFrequency,
      lastNoteAt: lastNotes.lastNoteAt,
      since: contacts.keepInTouchSince,
    })
    .from(contacts)
    .leftJoin(lastNotes, eq(lastNotes.contactId, contacts.id))
    .where(and(isNotNull(contacts.keepInTouchFrequency), sql`${dueAt} < now()`))
    .orderBy(sql`${dueAt}`, asc(contacts.name), asc(contacts.id));

  // Both are set together, so a contact with a frequency always has "since"
  return rows.map((row) => ({
    ...row,
    frequency: row.frequency!,
    since: row.since!,
  }));
}

// The contact's notes are deleted by the database too (on delete cascade).
// Returns the deleted contact's name, or null if there was no such contact
export async function deleteContact(id: number): Promise<string | null> {
  const [row] = await db
    .delete(contacts)
    .where(eq(contacts.id, id))
    .returning({ name: contacts.name });
  return row?.name ?? null;
}
