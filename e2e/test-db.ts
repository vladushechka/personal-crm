import { eq } from "drizzle-orm";

import { createDb, type Db } from "../src/db/client";
import { getDatabaseConfig, loadEnvFile } from "../src/db/config";
import { users } from "../src/db/schema";

import { E2E_DATABASE, E2E_OWNER_EMAIL } from "./constants";

// Tests move dates into the past straight in the test database: the app has no test hooks,
// and waiting a month for a deadline is not an option
export async function withTestDb<T>(fn: (db: Db) => Promise<T>): Promise<T> {
  loadEnvFile();
  const { db, client } = createDb({ ...getDatabaseConfig(), database: E2E_DATABASE }, { max: 1 });
  try {
    return await fn(db);
  } finally {
    await client.end();
  }
}

// The user the tests are signed in as: rows the tests add straight to the database belong to them
export async function e2eOwnerId() {
  const [owner] = await withTestDb((db) =>
    db.select({ id: users.id }).from(users).where(eq(users.email, E2E_OWNER_EMAIL)),
  );
  return owner.id;
}
