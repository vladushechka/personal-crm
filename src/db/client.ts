import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import type { DatabaseConfig } from "./config";
import * as schema from "./schema";

export function createDb(config: DatabaseConfig, options: { max?: number } = {}) {
  const client = postgres({ ...config, max: options.max ?? 10 });
  return { db: drizzle(client, { schema }), client };
}

export type Db = ReturnType<typeof createDb>["db"];
