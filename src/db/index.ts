import "server-only";

import { createDb, type Db } from "./client";
import { getDatabaseConfig } from "./config";

// One connection pool, kept across hot reloads in development
const globalForDb = globalThis as unknown as { db?: Db };

// Created on the first query, not on import: building the app needs no database settings
export function getDb(): Db {
  globalForDb.db ??= createDb(getDatabaseConfig()).db;
  return globalForDb.db;
}
