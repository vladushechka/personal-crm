import { randomUUID } from "node:crypto";

import { and, eq, sql } from "drizzle-orm";

import type { Db } from "../src/db/client";
import { contactGroups, contacts, groups, notes, users } from "../src/db/schema";

import { generateFakeContacts } from "./fake-contacts";
import { fakeGroupNames, pickFakeGroupNames } from "./fake-groups";

const CHUNK_SIZE = 500;

// The owner of the demo data: the user with this email, created if there is none yet.
// Signing in later with the same email finds this user. Returns the user's id
export async function findOrCreateUser(db: Db, email: string) {
  const normalized = email.trim().toLowerCase();
  await db
    .insert(users)
    .values({ id: randomUUID(), name: "", email: normalized, emailVerified: true })
    .onConflictDoNothing({ target: users.email });
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, normalized));
  return user.id;
}

// The owner from the settings (OWNER_EMAIL in .env): demo data belongs to them
export async function ownerFromSettings(db: Db) {
  const email = process.env.OWNER_EMAIL;
  if (!email) {
    throw new Error("OWNER_EMAIL is not set in .env: demo data belongs to the owner");
  }
  return findOrCreateUser(db, email);
}

// Inserts `count` fake contacts of the owner with their notes in one transaction
export async function insertFakeContacts(db: Db, ownerId: string, count: number) {
  const fakeContacts = generateFakeContacts(count);
  let noteCount = 0;

  await db.transaction(async (tx) => {
    for (let start = 0; start < fakeContacts.length; start += CHUNK_SIZE) {
      const chunk = fakeContacts.slice(start, start + CHUNK_SIZE);

      // Postgres returns rows of a multi-row INSERT ... VALUES in insertion order
      const inserted = await tx
        .insert(contacts)
        .values(chunk.map((fake) => ({ ...fake.contact, ownerId })))
        .returning({ id: contacts.id });

      const noteRows = chunk.flatMap((fake, index) =>
        fake.notes.map((note) => ({ ...note, contactId: inserted[index].id })),
      );
      if (noteRows.length > 0) {
        await tx.insert(notes).values(noteRows);
        noteCount += noteRows.length;
      }
    }
  });

  return { contactCount: fakeContacts.length, noteCount };
}

// About every tenth contact gets a random "how often to talk" chosen sometime in the last half
// year, so the "Пора связаться" block has people in it. Returns how many contacts got one
export async function assignFakeFrequencies(db: Db, ownerId: string) {
  const updated = await db
    .update(contacts)
    .set({
      keepInTouchFrequency: sql`(array['week', 'month', 'quarter', 'year'])[1 + floor(random() * 4)::int]`,
      keepInTouchSince: sql`now() - random() * interval '180 days'`,
    })
    .where(and(eq(contacts.ownerId, ownerId), sql`random() < 0.1`))
    .returning({ id: contacts.id });
  return updated.length;
}

// Creates the owner's fake groups and puts about a third of the owner's contacts in them
export async function assignFakeGroups(db: Db, ownerId: string) {
  return db.transaction(async (tx) => {
    const created = await tx
      .insert(groups)
      .values(fakeGroupNames.map((name) => ({ ownerId, name })))
      .returning();
    const groupIds = new Map(created.map(({ id, name }) => [name, id]));

    const people = await tx
      .select({ id: contacts.id })
      .from(contacts)
      .where(eq(contacts.ownerId, ownerId));
    const members = people.flatMap(({ id }) =>
      pickFakeGroupNames().map((name) => ({ contactId: id, groupId: groupIds.get(name)! })),
    );
    for (let start = 0; start < members.length; start += CHUNK_SIZE) {
      await tx.insert(contactGroups).values(members.slice(start, start + CHUNK_SIZE));
    }

    return {
      groupCount: created.length,
      contactCount: new Set(members.map(({ contactId }) => contactId)).size,
    };
  });
}
