import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import type postgres from "postgres";

// Applies the migrations from drizzle/, all new ones in one transaction.
// Migration 0003 gives the contacts and groups that existed before sign-in to the owner: it reads
// the owner's email from the Postgres setting app.owner_email, set here on the same connection.
// So the client must have exactly one connection (max: 1)
export async function applyMigrations(
  client: postgres.Sql,
  {
    ownerEmail = "",
    migrationsFolder = "drizzle",
  }: { ownerEmail?: string; migrationsFolder?: string } = {},
) {
  await client`select set_config('app.owner_email', ${ownerEmail}, false)`;
  await migrate(drizzle(client), { migrationsFolder });
}
