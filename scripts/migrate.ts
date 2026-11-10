// Applies the database migrations: `pnpm db:migrate` locally, the "migrate" container on the server.
// OWNER_EMAIL names the owner of the data that existed before sign-in (migration 0003)

import { createDb } from "../src/db/client";
import { getDatabaseConfig, loadEnvFile } from "../src/db/config";

import { applyMigrations } from "./migrate-db";

async function main() {
  loadEnvFile();

  const { client } = createDb(getDatabaseConfig(), { max: 1 });
  try {
    await applyMigrations(client, { ownerEmail: process.env.OWNER_EMAIL });
    console.log("Migrations applied.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
