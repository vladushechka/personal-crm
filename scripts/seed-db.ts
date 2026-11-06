import { sql } from "drizzle-orm";

import type { Db } from "../src/db/client";
import { contactGroups, contacts, groups, notes } from "../src/db/schema";

import { generateFakeContacts } from "./fake-contacts";
import { fakeGroupNames, pickFakeGroupNames } from "./fake-groups";

const CHUNK_SIZE = 500;

// Inserts `count` fake contacts with their notes in one transaction
export async function insertFakeContacts(db: Db, count: number) {
  const fakeContacts = generateFakeContacts(count);
  let noteCount = 0;

  await db.transaction(async (tx) => {
    for (let start = 0; start < fakeContacts.length; start += CHUNK_SIZE) {
      const chunk = fakeContacts.slice(start, start + CHUNK_SIZE);

      // Postgres returns rows of a multi-row INSERT ... VALUES in insertion order
      const inserted = await tx
        .insert(contacts)
        .values(chunk.map((fake) => fake.contact))
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
export async function assignFakeFrequencies(db: Db) {
  const updated = await db
    .update(contacts)
    .set({
      keepInTouchFrequency: sql`(array['week', 'month', 'quarter', 'year'])[1 + floor(random() * 4)::int]`,
      keepInTouchSince: sql`now() - random() * interval '180 days'`,
    })
    .where(sql`random() < 0.1`)
    .returning({ id: contacts.id });
  return updated.length;
}

// Creates the fake groups and puts about a third of the contacts in them
export async function assignFakeGroups(db: Db) {
  return db.transaction(async (tx) => {
    const created = await tx
      .insert(groups)
      .values(fakeGroupNames.map((name) => ({ name })))
      .returning();
    const groupIds = new Map(created.map(({ id, name }) => [name, id]));

    const people = await tx.select({ id: contacts.id }).from(contacts);
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
