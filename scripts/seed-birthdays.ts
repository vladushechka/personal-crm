// One-off for a local database seeded before birthdays existed: pnpm db:seed:birthdays
// Gives about a third of the owner's contacts a random birthday. Does nothing if any contact
// already has one, so a date the user typed is never overwritten. Local only: never on a server

import { count, isNotNull } from "drizzle-orm";

import { createDb } from "../src/db/client";
import { getDatabaseConfig, loadEnvFile } from "../src/db/config";
import { contacts } from "../src/db/schema";

import { assignFakeBirthdays, ownerFromSettings } from "./seed-db";

async function main() {
  loadEnvFile();

  const { db, client } = createDb(getDatabaseConfig(), { max: 1 });
  try {
    const [{ value: existing }] = await db
      .select({ value: count() })
      .from(contacts)
      .where(isNotNull(contacts.birthdayDay));
    if (existing > 0) {
      console.log(`${existing} contacts already have a birthday, nothing changed.`);
      return;
    }

    const withBirthday = await assignFakeBirthdays(db, await ownerFromSettings(db));
    console.log(`${withBirthday} contacts got a birthday.`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
