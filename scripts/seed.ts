// Fills an empty database with fake contacts: pnpm db:seed [count]
// Does nothing if the database already has contacts, so real data is never mixed with fake data.

import { count } from "drizzle-orm";

import { createDb } from "../src/db/client";
import { getDatabaseConfig, loadEnvFile } from "../src/db/config";
import { contacts } from "../src/db/schema";

import { insertFakeContacts } from "./seed-db";

const DEFAULT_COUNT = 1000;

async function main() {
  loadEnvFile();

  const requested = Number(process.argv[2] ?? DEFAULT_COUNT);
  if (!Number.isInteger(requested) || requested < 1) {
    throw new Error(`Contact count must be a positive integer, got "${process.argv[2]}"`);
  }

  const { db, client } = createDb(getDatabaseConfig(), { max: 1 });
  try {
    const [{ value: existing }] = await db.select({ value: count() }).from(contacts);
    if (existing > 0) {
      console.log(`The database already has ${existing} contacts, seeding skipped.`);
      return;
    }

    const result = await insertFakeContacts(db, requested);
    console.log(`Added ${result.contactCount} contacts and ${result.noteCount} notes.`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
