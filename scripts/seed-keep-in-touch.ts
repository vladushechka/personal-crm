// One-off for a database seeded before "Пора связаться" existed: pnpm db:seed:keep-in-touch
// Gives about every tenth contact a random "how often to talk". Does nothing if any contact
// already has one, so a choice the user made is never overwritten.

import { count, isNotNull } from "drizzle-orm";

import { createDb } from "../src/db/client";
import { getDatabaseConfig, loadEnvFile } from "../src/db/config";
import { contacts } from "../src/db/schema";

import { assignFakeFrequencies } from "./seed-db";

async function main() {
  loadEnvFile();

  const { db, client } = createDb(getDatabaseConfig(), { max: 1 });
  try {
    const [{ value: existing }] = await db
      .select({ value: count() })
      .from(contacts)
      .where(isNotNull(contacts.keepInTouchFrequency));
    if (existing > 0) {
      console.log(`${existing} contacts already have a "how often to talk", nothing changed.`);
      return;
    }

    const withFrequency = await assignFakeFrequencies(db);
    console.log(`${withFrequency} contacts got a "how often to talk".`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
