import "server-only";

import { createDb, type Db } from "./client";
import { getDatabaseConfig } from "./config";

// Reuse one connection pool across hot reloads in development
const globalForDb = globalThis as unknown as { db?: Db };

export const db = globalForDb.db ?? createDb(getDatabaseConfig()).db;

if (process.env.NODE_ENV !== "production") {
  globalForDb.db = db;
}
