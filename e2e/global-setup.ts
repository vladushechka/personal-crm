import { chromium, type FullConfig } from "@playwright/test";
import postgres from "postgres";

import { applyMigrations } from "../scripts/migrate-db";
import { findOrCreateUser, insertFakeContacts } from "../scripts/seed-db";
import { createDb } from "../src/db/client";
import { getDatabaseConfig, loadEnvFile } from "../src/db/config";

import { signIn } from "./auth";
import { E2E_CONTACT_COUNT, E2E_DATABASE, E2E_OWNER_EMAIL, E2E_STORAGE_STATE } from "./constants";

// Recreates the test database from scratch: migrations + the owner with fake contacts.
// Then signs the owner in through the real form and the email, for the tests to start signed in
export default async function globalSetup(config: FullConfig) {
  loadEnvFile();
  const database = getDatabaseConfig();

  if (database.database === E2E_DATABASE) {
    throw new Error(`POSTGRES_DB must not be "${E2E_DATABASE}": that name is reserved for tests`);
  }

  const admin = postgres({ ...database, database: "postgres", max: 1, onnotice: () => {} });
  try {
    await admin.unsafe(`DROP DATABASE IF EXISTS "${E2E_DATABASE}" WITH (FORCE)`);
    await admin.unsafe(`CREATE DATABASE "${E2E_DATABASE}"`);
  } finally {
    await admin.end();
  }

  const { db, client } = createDb({ ...database, database: E2E_DATABASE }, { max: 1 });
  try {
    await applyMigrations(client);
    await insertFakeContacts(db, await findOrCreateUser(db, E2E_OWNER_EMAIL), E2E_CONTACT_COUNT);
  } finally {
    await client.end();
  }

  const { baseURL, channel } = config.projects[0].use;
  const browser = await chromium.launch({ channel });
  try {
    const page = await browser.newPage({ baseURL });
    await signIn(page, E2E_OWNER_EMAIL);
    await page.context().storageState({ path: E2E_STORAGE_STATE });
  } finally {
    await browser.close();
  }
}
