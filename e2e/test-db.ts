import { createDb, type Db } from "../src/db/client";
import { getDatabaseConfig, loadEnvFile } from "../src/db/config";

import { E2E_DATABASE } from "./constants";

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
