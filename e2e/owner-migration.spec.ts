// Migration 0003 gives everything that existed before sign-in to the owner from the settings.
// Runs on its own temporary database and needs no browser

import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, test } from "@playwright/test";
import postgres from "postgres";

import { applyMigrations } from "../scripts/migrate-db";
import { createDb } from "../src/db/client";
import { getDatabaseConfig, loadEnvFile, type DatabaseConfig } from "../src/db/config";

const DATABASE = "personal_crm_migration_test";
const LAST_MIGRATION_BEFORE_SIGN_IN = 2; // 0002_groups

// A copy of the migrations folder as it was before sign-in
function migrationsBeforeSignIn() {
  const folder = mkdtempSync(join(tmpdir(), "migrations-before-sign-in-"));
  cpSync("drizzle", folder, { recursive: true });
  const journalPath = join(folder, "meta", "_journal.json");
  const journal = JSON.parse(readFileSync(journalPath, "utf8")) as { entries: { idx: number }[] };
  journal.entries = journal.entries.filter(({ idx }) => idx <= LAST_MIGRATION_BEFORE_SIGN_IN);
  writeFileSync(journalPath, JSON.stringify(journal));
  return folder;
}

// A database with the schema and some data from before sign-in
async function withDatabaseBeforeSignIn(fn: (client: postgres.Sql) => Promise<void>) {
  loadEnvFile();
  const config: DatabaseConfig = getDatabaseConfig();
  const admin = postgres({ ...config, database: "postgres", max: 1, onnotice: () => {} });
  await admin.unsafe(`DROP DATABASE IF EXISTS "${DATABASE}" WITH (FORCE)`);
  await admin.unsafe(`CREATE DATABASE "${DATABASE}"`);

  const folder = migrationsBeforeSignIn();
  const { client } = createDb({ ...config, database: DATABASE }, { max: 1 });
  try {
    await applyMigrations(client, { migrationsFolder: folder });
    await client`insert into contacts (name) values ('Анна'), ('Борис'), ('Вера')`;
    await client`insert into notes (contact_id, body)
      select id, 'Заметка о ' || name from contacts where name in ('Анна', 'Борис')`;
    await client`insert into groups (name) values ('Семья'), ('Теннис')`;
    await client`insert into contact_groups (contact_id, group_id)
      select contacts.id, groups.id from contacts, groups where contacts.name = 'Анна'`;
    await fn(client);
  } finally {
    await client.end();
    rmSync(folder, { recursive: true, force: true });
    await admin.unsafe(`DROP DATABASE IF EXISTS "${DATABASE}" WITH (FORCE)`);
    await admin.end();
  }
}

async function countRows(client: postgres.Sql) {
  const [row] = await client`select
    (select count(*) from contacts)::int as contacts,
    (select count(*) from notes)::int as notes,
    (select count(*) from groups)::int as groups,
    (select count(*) from contact_groups)::int as "contactGroups"`;
  return row;
}

test("existing contacts, notes and groups go to the owner from the settings, none is lost", async () => {
  await withDatabaseBeforeSignIn(async (client) => {
    const before = await countRows(client);

    await applyMigrations(client, { ownerEmail: "  Owner@Example.COM " });

    const users = await client`select id, email from users`;
    expect(users).toHaveLength(1);
    expect(users[0].email).toBe("owner@example.com");
    expect(await countRows(client)).toEqual(before);
    const [owners] = await client`select
      (select count(*) from contacts where owner_id = ${users[0].id})::int as contacts,
      (select count(*) from groups where owner_id = ${users[0].id})::int as groups`;
    expect(owners).toEqual({ contacts: before.contacts, groups: before.groups });
  });
});

test("without the owner email the migration stops and changes nothing", async () => {
  await withDatabaseBeforeSignIn(async (client) => {
    const before = await countRows(client);

    await expect(applyMigrations(client, {})).rejects.toThrow(/OWNER_EMAIL/);

    const [state] = await client`select
      to_regclass('users') is null as "noUsersTable",
      not exists (select 1 from information_schema.columns
        where table_name = 'contacts' and column_name = 'owner_id') as "noOwnerColumn"`;
    expect(state).toEqual({ noUsersTable: true, noOwnerColumn: true });
    expect(await countRows(client)).toEqual(before);
  });
});
