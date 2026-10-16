import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

import { insertFakeContacts } from "../scripts/seed-db";
import { createDb } from "../src/db/client";
import { getDatabaseConfig, loadEnvFile } from "../src/db/config";

import { E2E_CONTACT_COUNT, E2E_DATABASE } from "./constants";

// Recreates the test database from scratch: migrations + fake contacts
export default async function globalSetup() {
  loadEnvFile();
  const config = getDatabaseConfig();

  if (config.database === E2E_DATABASE) {
    throw new Error(`POSTGRES_DB must not be "${E2E_DATABASE}": that name is reserved for tests`);
  }

  const admin = postgres({ ...config, database: "postgres", max: 1, onnotice: () => {} });
  try {
    await admin.unsafe(`DROP DATABASE IF EXISTS "${E2E_DATABASE}" WITH (FORCE)`);
    await admin.unsafe(`CREATE DATABASE "${E2E_DATABASE}"`);
  } finally {
    await admin.end();
  }

  const { db, client } = createDb({ ...config, database: E2E_DATABASE }, { max: 1 });
  try {
    await migrate(db, { migrationsFolder: "drizzle" });
    await insertFakeContacts(db, E2E_CONTACT_COUNT);
  } finally {
    await client.end();
  }
}
