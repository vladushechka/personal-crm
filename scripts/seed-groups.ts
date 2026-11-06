// One-off for a database seeded before groups existed: pnpm db:seed:groups
// Creates the fake groups and puts about a third of contacts in them. Does nothing if any group
// already exists, so groups the user made are never touched.

import { count } from "drizzle-orm";

import { createDb } from "../src/db/client";
import { getDatabaseConfig, loadEnvFile } from "../src/db/config";
import { groups } from "../src/db/schema";

import { assignFakeGroups } from "./seed-db";

async function main() {
  loadEnvFile();

  const { db, client } = createDb(getDatabaseConfig(), { max: 1 });
  try {
    const [{ value: existing }] = await db.select({ value: count() }).from(groups);
    if (existing > 0) {
      console.log(`${existing} groups already exist, nothing changed.`);
      return;
    }

    const result = await assignFakeGroups(db);
    console.log(`Created ${result.groupCount} groups, ${result.contactCount} contacts are in them.`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
