import "server-only";

import { and, asc, count, desc, eq, inArray, isNotNull, max, sql, type SQL } from "drizzle-orm";

import { getDb } from "@/db";
import { safely } from "@/db/safe-query";
import {
  contactGroups,
  contacts,
  groups,
  notes,
  type Contact,
  type KeepInTouchFrequency,
} from "@/db/schema";

import type { ContactInput } from "./contact-schema";
import { pickContactsToReachOut, type ContactToReachOut } from "./keep-in-touch";

// Every function takes the id of the signed-in user (session.ts) first and touches only that
// user's rows: a contact of someone else looks the same as a contact that doesn't exist

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

function ownContact(ownerId: string, contactId: number) {
  return and(eq(contacts.id, contactId), eq(contacts.ownerId, ownerId));
}

// Ids of the user's contacts: notes have no owner of their own, they follow their contact
function ownContactIds(ownerId: string, contactId: number) {
  return getDb().select({ id: contacts.id }).from(contacts).where(ownContact(ownerId, contactId));
}

export async function listContacts(
  ownerId: string,
  query = "",
  groupId?: number,
): Promise<ContactListItem[]> {
  const db = getDb();
  const inGroup = groupId
    ? inArray(
        contacts.id,
        db
          .select({ id: contactGroups.contactId })
          .from(contactGroups)
          .innerJoin(groups, eq(groups.id, contactGroups.groupId))
          .where(and(eq(contactGroups.groupId, groupId), eq(groups.ownerId, ownerId))),
      )
    : undefined;

  return safely(
    db
      .select({
        id: contacts.id,
        name: contacts.name,
        about: contacts.about,
        howWeMet: contacts.howWeMet,
      })
      .from(contacts)
      .where(and(eq(contacts.ownerId, ownerId), nameMatches(query), inGroup))
      .orderBy(asc(contacts.name), asc(contacts.id)),
  );
}

export async function countContacts(ownerId: string): Promise<number> {
  const [row] = await getDb()
    .select({ value: count() })
    .from(contacts)
    .where(eq(contacts.ownerId, ownerId));
  return row?.value ?? 0;
}

export async function getContact(ownerId: string, id: number): Promise<Contact | null> {
  const [contact] = await getDb().select().from(contacts).where(ownContact(ownerId, id));
  return contact ?? null;
}

export async function getContactWithNotes(ownerId: string, id: number) {
  const contact = await getContact(ownerId, id);
  if (!contact) return null;

  const contactNotes = await getDb()
    .select()
    .from(notes)
    .where(eq(notes.contactId, contact.id))
    .orderBy(desc(notes.createdAt), desc(notes.id));

  return { ...contact, notes: contactNotes };
}

export async function contactExists(ownerId: string, id: number): Promise<boolean> {
  const [row] = await getDb()
    .select({ id: contacts.id })
    .from(contacts)
    .where(ownContact(ownerId, id));
  return Boolean(row);
}

export async function createContact(ownerId: string, input: ContactInput): Promise<number> {
  const [row] = await safely(
    getDb()
      .insert(contacts)
      .values({ ...input, ownerId })
      .returning({ id: contacts.id }),
  );
  return row.id;
}

// Returns false if the user has no such contact (e.g. it was deleted in another browser)
export async function updateContact(
  ownerId: string,
  id: number,
  input: ContactInput,
): Promise<boolean> {
  const [row] = await safely(
    getDb()
      .update(contacts)
      .set(input)
      .where(ownContact(ownerId, id))
      .returning({ id: contacts.id }),
  );
  return Boolean(row);
}

// Returns false if the user has no such contact
export async function addNote(ownerId: string, contactId: number, body: string): Promise<boolean> {
  // One statement: the note is added only if the contact is the user's
  const rows = await safely(
    getDb().execute(sql`
      insert into ${notes} (${sql.identifier(notes.contactId.name)}, ${sql.identifier(notes.body.name)})
      select ${contacts.id}, ${body} from ${contacts}
      where ${ownContact(ownerId, contactId)}
      returning ${sql.identifier(notes.id.name)}`),
  );
  return rows.length > 0;
}

// The date stays the original one, so the note keeps its place in the list.
// Returns false if the user's contact has no such note (e.g. it was deleted in another browser)
export async function updateNote(
  ownerId: string,
  contactId: number,
  noteId: number,
  body: string,
): Promise<boolean> {
  const [row] = await safely(
    getDb()
      .update(notes)
      .set({ body })
      .where(and(eq(notes.id, noteId), inArray(notes.contactId, ownContactIds(ownerId, contactId))))
      .returning({ id: notes.id }),
  );
  return Boolean(row);
}

export async function deleteNote(ownerId: string, contactId: number, noteId: number) {
  await getDb()
    .delete(notes)
    .where(and(eq(notes.id, noteId), inArray(notes.contactId, ownContactIds(ownerId, contactId))));
}

// A new frequency restarts the countdown for a contact without notes; null clears both.
// Returns false if the user has no such contact (e.g. it was deleted in another browser)
export async function setKeepInTouch(
  ownerId: string,
  contactId: number,
  frequency: KeepInTouchFrequency | null,
): Promise<boolean> {
  const [row] = await getDb()
    .update(contacts)
    .set({
      keepInTouchFrequency: frequency,
      keepInTouchSince: frequency ? sql`now()` : null,
    })
    .where(ownContact(ownerId, contactId))
    .returning({ id: contacts.id });
  return Boolean(row);
}

// The user's contacts whose time to talk has passed, the most overdue first
// (rules in keep-in-touch.ts)
export async function listContactsToReachOut(ownerId: string): Promise<ContactToReachOut[]> {
  // Date of each contact's latest note
  const lastNotes = getDb()
    .select({ contactId: notes.contactId, lastNoteAt: max(notes.createdAt).as("last_note_at") })
    .from(notes)
    .groupBy(notes.contactId)
    .as("last_notes");

  const rows = await getDb()
    .select({
      id: contacts.id,
      name: contacts.name,
      frequency: contacts.keepInTouchFrequency,
      lastNoteAt: lastNotes.lastNoteAt,
      since: contacts.keepInTouchSince,
    })
    .from(contacts)
    .leftJoin(lastNotes, eq(lastNotes.contactId, contacts.id))
    .where(and(eq(contacts.ownerId, ownerId), isNotNull(contacts.keepInTouchFrequency)));

  // Both are set together, so a contact with a frequency always has "since"
  const withFrequency = rows.map((row) => ({
    ...row,
    frequency: row.frequency!,
    since: row.since!,
  }));
  return pickContactsToReachOut(withFrequency, new Date());
}

// The contact's notes are deleted by the database too (on delete cascade).
// Returns the deleted contact's name, or null if the user had no such contact
export async function deleteContact(ownerId: string, id: number): Promise<string | null> {
  const [row] = await getDb()
    .delete(contacts)
    .where(ownContact(ownerId, id))
    .returning({ name: contacts.name });
  return row?.name ?? null;
}
