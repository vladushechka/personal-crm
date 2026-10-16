import "server-only";

import { and, asc, count, desc, eq, sql, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { contacts, notes } from "@/db/schema";

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

export async function getContactWithNotes(id: number) {
  const [contact] = await db.select().from(contacts).where(eq(contacts.id, id));
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

export async function addNote(contactId: number, body: string): Promise<void> {
  await db.insert(notes).values({ contactId, body });
}
