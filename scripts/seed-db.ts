import type { Db } from "../src/db/client";
import { contacts, notes } from "../src/db/schema";

import { generateFakeContacts } from "./fake-contacts";

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
